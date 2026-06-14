import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import rideshare from '../src/data/rideshare.json';
import type { LevelConfig } from '../src/lib/game/schema';

function run(engine: GameEngine, ticks: number) {
  for (let i = 0; i < ticks; i++) engine.update();
}

function comp(engine: GameEngine, id: string) {
  return engine.components[id];
}

describe('rideshare showcase level', () => {
  it('is healthy at baseline (no scaling needed)', () => {
    const engine = new GameEngine();
    engine.loadLevel(rideshare as unknown as LevelConfig);
    run(engine, 15);

    // Every component should be healthy or at worst warning at baseline load.
    for (const c of Object.values(engine.components)) {
      const err = c.metrics.error_rate?.value ?? 0;
      expect(err, `${c.name} error_rate`).toBeLessThan(5);
    }
    // Queue should fully drain (egress 2200 > ingest 2000) -> backlog near zero.
    expect(comp(engine, 'gps-queue').metrics.current_message_count!.value).toBeLessThan(2000);
  });

  it('saturates Matching + Geo Cache under a 7x rider surge, then recovers after scaling', () => {
    const engine = new GameEngine();
    engine.loadLevel(rideshare as unknown as LevelConfig);
    run(engine, 12);

    // Force the surge deterministically (don't rely on probability).
    engine.traffics['ride_request'].nominalValue = 400 * 7;
    run(engine, 6);

    const matchErr = comp(engine, 'matching-service').metrics.error_rate!.value;
    const cacheErr = comp(engine, 'geo-cache').metrics.error_rate!.value;
    expect(matchErr, 'matching should drop traffic under surge').toBeGreaterThan(10);
    expect(cacheErr, 'geo-cache pool should saturate under surge').toBeGreaterThan(10);

    // Operator response: scale the whole read path (surge cascades to Trip DB too).
    comp(engine, 'matching-service').attributes.cpu.limit = 160;
    comp(engine, 'geo-cache').attributes.connections.limit = 40000;
    comp(engine, 'trip-db').attributes.connections.limit = 7000;
    run(engine, 10);

    expect(comp(engine, 'matching-service').metrics.error_rate!.value).toBeLessThan(5);
    expect(comp(engine, 'geo-cache').metrics.error_rate!.value).toBeLessThan(5);
  });

  it('grows queue backlog under a GPS storm until drain rate is raised', () => {
    const engine = new GameEngine();
    engine.loadLevel(rideshare as unknown as LevelConfig);
    run(engine, 12);

    engine.traffics['driver_gps'].nominalValue = 2000 * 3; // 6000 ingest vs 2200 drain
    run(engine, 8);
    const backlogPeak = comp(engine, 'gps-queue').metrics.current_message_count!.value;
    expect(backlogPeak, 'backlog should build up').toBeGreaterThan(5000);

    comp(engine, 'gps-queue').attributes.egress.limit = 7000;
    comp(engine, 'location-worker').attributes.cpu.limit = 120;
    run(engine, 20);
    const backlogAfter = comp(engine, 'gps-queue').metrics.current_message_count!.value;
    expect(backlogAfter, 'backlog should drain after raising egress').toBeLessThan(backlogPeak);
  });

  it('cascades third-party Stripe latency into Payment Service P99', () => {
    const engine = new GameEngine();
    engine.loadLevel(rideshare as unknown as LevelConfig);
    run(engine, 12);
    const baselinePaymentLatency = comp(engine, 'payment-service').metrics.latency!.value;

    // Inject the Stripe degradation effect directly.
    const stripeEffect = engine.statusEffects.find((e) => e.name === 'Stripe Regional Degradation');
    expect(stripeEffect, 'effect should exist').toBeTruthy();
    stripeEffect!.isActive = true;
    run(engine, 4);

    const degradedPaymentLatency = comp(engine, 'payment-service').metrics.latency!.value;
    expect(
      degradedPaymentLatency,
      'payment latency should rise due to downstream Stripe'
    ).toBeGreaterThan(baselinePaymentLatency);
  });
});

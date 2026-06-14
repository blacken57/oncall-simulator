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

  it('saturates the read path under a rider surge, then recovers with MODEST scaling', () => {
    const engine = new GameEngine();
    engine.loadLevel(rideshare as unknown as LevelConfig);
    run(engine, 12);

    // Friday surge: multiplier 3 => 4x volume (base + base*3).
    engine.traffics['ride_request'].nominalValue = 400 * 4;
    run(engine, 6);

    // Trip DB read path is the first to saturate (matching fans out x2 reads).
    expect(
      comp(engine, 'trip-db').metrics.error_rate!.value,
      'trip-db read pool should saturate under surge'
    ).toBeGreaterThan(10);

    // Operator response: scale the read path to MODEST levels — well under max.
    // (The whole point of the rebalance: you should never need to slide to max.)
    comp(engine, 'matching-service').attributes.cpu.limit = 70; // max 200  -> 35%
    comp(engine, 'trip-db').attributes.connections.limit = 7000; // max 20000 -> 35%
    run(engine, 12);

    expect(comp(engine, 'matching-service').metrics.error_rate!.value).toBeLessThan(5);
    expect(comp(engine, 'trip-db').metrics.error_rate!.value).toBeLessThan(5);

    // Assert the recovery used <50% of every slider it touched.
    expect(comp(engine, 'matching-service').attributes.cpu.limit).toBeLessThan(
      comp(engine, 'matching-service').attributes.cpu.maxLimit * 0.5
    );
    expect(comp(engine, 'trip-db').attributes.connections.limit).toBeLessThan(
      comp(engine, 'trip-db').attributes.connections.maxLimit * 0.5
    );
  });

  it('grows queue backlog under a GPS storm until drain rate is raised', () => {
    const engine = new GameEngine();
    engine.loadLevel(rideshare as unknown as LevelConfig);
    run(engine, 12);

    // GPS storm: multiplier 1 => 2x volume = 4000 ingest vs 3000 drain.
    engine.traffics['driver_gps'].nominalValue = 2000 * 2;
    run(engine, 8);
    const backlogPeak = comp(engine, 'gps-queue').metrics.current_message_count!.value;
    expect(backlogPeak, 'backlog should build up').toBeGreaterThan(2000);

    comp(engine, 'gps-queue').attributes.egress.limit = 6000;
    comp(engine, 'location-worker').attributes.cpu.limit = 80;
    run(engine, 20);
    const backlogAfter = comp(engine, 'gps-queue').metrics.current_message_count!.value;
    expect(backlogAfter, 'backlog should drain after raising egress').toBeLessThan(backlogPeak);
  });

  it('does not flood the consumer when drain rate is raised above real load', () => {
    // Regression: QueueNode.preTick() used to reserve its full egress limit as
    // downstream demand regardless of buffered messages, so cranking the drain
    // rate slider inflated phantom demand and saturated the Location Worker.
    const engine = new GameEngine();
    engine.loadLevel(rideshare as unknown as LevelConfig);
    run(engine, 12);

    // Real GPS load unchanged; operator maxes the drain rate to "stay ahead".
    comp(engine, 'gps-queue').attributes.egress.limit = 20000;
    run(engine, 5);

    expect(comp(engine, 'location-worker').metrics.error_rate!.value).toBeLessThan(5);
    expect(comp(engine, 'gps-queue').metrics.current_message_count!.value).toBeLessThan(2000);
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

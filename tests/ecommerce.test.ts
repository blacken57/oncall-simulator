import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import { getLevel } from '../src/lib/game/levels';

describe('Ecommerce Megastore Integration', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    const level = getLevel('ecommerce-megastore');
    if (level) {
      // Disable noise and variance for deterministic testing
      level.components.forEach((c) => {
        if (c.physics) c.physics.noise_factor = 0;
      });
      level.traffics.forEach((t) => {
        t.base_variance = 0;
      });
      engine.loadLevel(level);
    }
  });

  it('should propagate traffic from gateway to services', () => {
    // Before any ticks
    expect(engine.components['api-gateway'].metrics.incoming.value).toBe(0);
    expect(engine.components['search-service'].metrics.incoming.value).toBe(0);

    // After 1st tick
    engine.update();

    expect(engine.components['api-gateway'].metrics.incoming.value).toBeGreaterThan(0);
    expect(engine.components['search-service'].metrics.incoming.value).toBeGreaterThan(0);
    expect(engine.components['search-db'].metrics.incoming.value).toBeGreaterThan(0);

    // Let's check the volume. Search traffic is exactly 1000 (no noise).
    const searchIncoming = engine.components['search-service'].metrics.incoming.value;
    const searchDBIncoming = engine.components['search-db'].metrics.incoming.value;

    expect(searchIncoming).toBe(1000);
    expect(searchDBIncoming).toBe(3000); // Multiplier 3
  });

  it('should handle order service -> order db and inventory sync', () => {
    engine.update();

    const orderIncoming = engine.components['order-service'].metrics.incoming.value;
    const orderDBIncoming = engine.components['order-db'].metrics.incoming.value;

    expect(orderIncoming).toBe(100); // exactly 100
    expect(orderDBIncoming).toBe(400); // Multiplier 4

    const inventoryIncoming = engine.components['inventory-service'].metrics.incoming.value;
    expect(inventoryIncoming).toBe(100);
  });

  it('should trigger the scheduled inventory sync at tick 20', () => {
    // Advanced 19 times. Job runs on tick 20.
    for (let i = 0; i < 19; i++) {
      engine.update();
    }

    // Check baseline before sync
    const inventoryDB = engine.components['inventory-db'];

    // Run tick 20
    engine.update();

    // Inventory Service capacity is 16 * 200 = 3200.
    // Demand at tick 20 is Checkout(100) + Scheduled(200) = 300.
    // No saturation!
    // inventory_sync_traffic (200) -> inventory_db_queries (multiplier 10) -> 2000.
    // Checkout traffic (100) -> inventory updates (multiplier 1) -> 100 queries.
    // Total should be exactly 2100.
    expect(inventoryDB.metrics.incoming.value).toBe(2100);
  });

  it('should propagate latency spikes during Search DB reindexing', () => {
    // 1. Get baseline latency
    engine.update();
    const baselineLat = engine.components['search-service'].metrics.latency.value;

    // 2. Force the reindexing status effect
    const reindexEffect = engine.statusEffects.find((e) => e.name === 'Search DB Reindexing');
    expect(reindexEffect).toBeDefined();
    // @ts-ignore
    reindexEffect.isActive = true;
    // @ts-ignore
    reindexEffect.turnsRemaining = 5;

    // 3. Update and check propagation
    engine.update();
    const spikeLat = engine.components['search-service'].metrics.latency.value;
    const dbLat = engine.components['search-db'].metrics.latency.value;

    // Search Service (Compute): 20ms base + (1000 req * 0.05 load_factor) = 70ms local processing.
    // Search DB (Storage): 50ms base.
    // Baseline: 70ms (local) + 3 * 50ms (deps) = 220ms.
    // Spike: Reindexing targets search-db with multiplier 2.3.
    // search-db localized latency = 50ms * (1 + 2.3) = 165ms.
    // Search Service final latency = 70ms (local) + 3 * 165ms (deps) = 70 + 495 = 565ms.

    expect(dbLat).toBe(165);
    expect(baselineLat).toBe(220);
    expect(spikeLat).toBe(565);
  });
});

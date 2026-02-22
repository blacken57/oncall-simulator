import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import { getLevel } from '../src/lib/game/levels';

describe('Ecommerce Megastore Integration', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    const level = getLevel('ecommerce-megastore');
    if (level) engine.loadLevel(level);
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

    // Let's check the volume. Search traffic is 1000 + noise.
    const searchIncoming = engine.components['search-service'].metrics.incoming.value;
    const searchDBIncoming = engine.components['search-db'].metrics.incoming.value;

    // Gateway has capacity 4000 (16*250), demand is 1600. No saturation.
    expect(searchIncoming).toBeGreaterThan(900);
    expect(searchDBIncoming).toBeCloseTo(searchIncoming * 3, -1); // Multiplier 3
  });

  it('should handle order service -> order db and inventory sync', () => {
    engine.update();

    const orderIncoming = engine.components['order-service'].metrics.incoming.value;
    const orderDBIncoming = engine.components['order-db'].metrics.incoming.value;

    expect(orderIncoming).toBeGreaterThan(0);
    expect(orderDBIncoming).toBeCloseTo(orderIncoming * 4, -1); // Multiplier 4

    const inventoryIncoming = engine.components['inventory-service'].metrics.incoming.value;
    expect(inventoryIncoming).toBeGreaterThan(0);
  });

  it('should trigger the scheduled inventory sync at tick 60', () => {
    // Advanced 59 times. Job runs on tick 60.
    for (let i = 0; i < 59; i++) {
      engine.update();
    }

    // Check baseline before sync
    const inventoryDB = engine.components['inventory-db'];

    // Run tick 60
    engine.update();

    // Inventory Service capacity is 16 * 200 = 3200.
    // Demand at tick 60 is Checkout(100) + Scheduled(2000) = 2100.
    // No saturation!
    // inventory_sync_traffic (2000) -> inventory_db_queries (multiplier 10) -> 20000.
    // Checkout traffic (100) -> inventory updates (multiplier 1) -> 100 queries.
    // Total should be around 20100.
    expect(inventoryDB.metrics.incoming.value).toBeGreaterThan(20000);
  });
});

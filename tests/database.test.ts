import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

describe('Database Physics', () => {
  const level: LevelConfig = {
    id: 'db-test',
    name: 'DB Test',
    description: 'Testing database-specific physics',
    components: [
      {
        id: 'db-1',
        name: 'DB 1',
        type: 'database',
        physics: {
          latency_base_ms: 10,
          latency_load_factor: 0.1,
          saturation_threshold_percent: 80,
          saturation_penalty_factor: 5,
          consumption_rates: {
            storage: 0.1 // 0.1 GB per request
          }
        },
        attributes: {
          connections: {
            name: 'Conn',
            unit: 'count',
            initialLimit: 100,
            minLimit: 1,
            maxLimit: 1000,
            costPerUnit: 1
          },
          storage: {
            name: 'Store',
            unit: 'GB',
            initialLimit: 1000,
            minLimit: 1,
            maxLimit: 10000,
            costPerUnit: 1
          }
        },
        metrics: {
          query_latency: { name: 'Lat', unit: 'ms' },
          error_rate: { name: 'Err', unit: '%' }
        },
        traffic_routes: [
          {
            name: 'query',
            base_latency_ms: 10,
            outgoing_traffics: []
          }
        ]
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'query',
        target_component_name: 'DB 1',
        value: 50,
        base_variance: 0
      }
    ],
    statusEffects: []
  };

  it('should calculate failure rate based on connection limit', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    // Demand 50, Limit 100. Failure rate 0.
    engine.update();
    const db = engine.components['db-1'];
    expect(db.metrics.error_rate.value).toBe(0);

    // Increase demand to 150. Limit 100.
    engine.traffics['query'].nominalValue = 150;
    engine.update();
    // Demand 150, Limit 100. Failure rate = (150 - 100) / 150 = 50 / 150 = 1/3 = 33.33%
    expect(db.metrics.error_rate.value).toBeCloseTo(33.33, 1);
  });

  it('should increase storage usage based on traffic', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    const db = engine.components['db-1'];
    expect(db.attributes.storage.current).toBe(0);

    // 50 requests * 0.1 GB/req = 5 GB
    engine.update();
    expect(db.attributes.storage.current).toBeCloseTo(5, 1);

    // 50 more requests = 10 GB total
    engine.update();
    expect(db.attributes.storage.current).toBeCloseTo(10, 1);
  });

  it('should apply sharp latency spike when connection utilization exceeds threshold', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    // Saturation threshold is 80% (80 connections).
    // Baseline: 50 connections. 50/100 = 50% utilization (below 80).
    engine.update();
    const db = engine.components['db-1'];
    // Latency = 10ms base + (50 reqs * 0.1 load factor) = 15ms
    // No saturation penalty.
    expect(db.metrics.query_latency.value).toBeCloseTo(15, 1);

    // 90 connections. 90/100 = 90% utilization (above 80).
    engine.traffics['query'].nominalValue = 90;
    engine.update();
    // Latency = 10ms base + (90 reqs * 0.1 load factor) = 19ms
    // Saturation penalty = 1 + penalty_factor (5) = 6x
    // Total = 19 * 6 = 114ms
    expect(db.metrics.query_latency.value).toBeCloseTo(114, 1);
  });
});

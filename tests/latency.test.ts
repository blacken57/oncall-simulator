import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

describe('Latency Physics & Propagation', () => {
  let engine: GameEngine;

  const level: LevelConfig = {
    id: 'latency-test',
    name: 'Latency Test',
    description: 'Testing complex latency scenarios',
    components: [
      {
        id: 'service-a',
        name: 'Service A',
        type: 'compute',
        physics: {
          latency_base_ms: 10,
          latency_load_factor: 0.5, // 100 reqs -> 50ms extra
          resource_base_usage: { cpu: 0 },
          noise_factor: 0,
          request_capacity_per_unit: 10
        },
        attributes: {
          cpu: {
            name: 'CPU',
            unit: 'cores',
            initialLimit: 100,
            minLimit: 1,
            maxLimit: 100,
            costPerUnit: 1
          }
        },
        metrics: { latency: { name: 'Lat', unit: 'ms' } },
        traffic_routes: [
          {
            name: 'route-a',
            base_latency_ms: 10,
            outgoing_traffics: [{ name: 'traffic-b', multiplier: 2 }]
          }
        ]
      },
      {
        id: 'service-b',
        name: 'Service B',
        type: 'compute',
        physics: {
          latency_base_ms: 20,
          latency_load_factor: 0,
          resource_base_usage: { cpu: 0 },
          noise_factor: 0,
          request_capacity_per_unit: 10
        },
        attributes: {
          cpu: {
            name: 'CPU',
            unit: 'cores',
            initialLimit: 100,
            minLimit: 1,
            maxLimit: 100,
            costPerUnit: 1
          }
        },
        metrics: { latency: { name: 'Lat', unit: 'ms' } },
        traffic_routes: [
          {
            name: 'traffic-b',
            base_latency_ms: 20,
            outgoing_traffics: [{ name: 'traffic-db', multiplier: 1 }]
          }
        ]
      },
      {
        id: 'db',
        name: 'DB',
        type: 'database',
        physics: {
          latency_base_ms: 5,
          latency_load_factor: 0,
          noise_factor: 0
        },
        attributes: {
          connections: {
            name: 'Conn',
            unit: 'count',
            initialLimit: 1000,
            minLimit: 1,
            maxLimit: 1000,
            costPerUnit: 1
          }
        },
        metrics: { query_latency: { name: 'Lat', unit: 'ms' } },
        traffic_routes: [
          {
            name: 'traffic-db',
            base_latency_ms: 5,
            outgoing_traffics: []
          }
        ]
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'route-a',
        target_component_name: 'Service A',
        value: 100,
        base_variance: 0
      },
      { type: 'internal', name: 'traffic-b', target_component_name: 'Service B' },
      { type: 'internal', name: 'traffic-db', target_component_name: 'DB' }
    ],
    statusEffects: [
      {
        type: 'component',
        name: 'DB Slowdown',
        component_affected: 'db',
        metric_affected: 'query_latency',
        multiplier: 1.0, // Double latency
        materialization_probability: 0,
        resolution_ticks: 1,
        max_instances_at_once: 1
      }
    ]
  };

  beforeEach(() => {
    engine = new GameEngine();
    engine.loadLevel(level);
  });

  it('should propagate baseline latency correctly through the chain', () => {
    engine.update();

    const db = engine.components['db'];
    const serviceB = engine.components['service-b'];
    const serviceA = engine.components['service-a'];

    // DB: 5ms base. No load factor.
    expect(db.metrics.query_latency.value).toBeCloseTo(5, 1);

    // Service B: 20ms base + (1 call * 5ms DB) = 25ms
    expect(serviceB.metrics.latency.value).toBeCloseTo(25, 1);

    // Service A:
    // local processing = 10ms base + (100 req * 0.5 load_factor) = 60ms
    // dependencies = 2 calls * 25ms (from Service B) = 50ms
    // total = 60 + 50 = 110ms
    expect(serviceA.metrics.latency.value).toBeCloseTo(110, 1);
  });

  it('should propagate doubled DB latency to parents correctly', () => {
    // 1. Activate DB Slowdown
    const effect = engine.statusEffects.find((e) => e.name === 'DB Slowdown');
    // @ts-ignore
    effect.isActive = true;
    // @ts-ignore
    effect.turnsRemaining = 5;

    engine.update();

    const db = engine.components['db'];
    const serviceB = engine.components['service-b'];
    const serviceA = engine.components['service-a'];

    // DB: 5ms base * 2 (multiplier 1.0) = 10ms
    expect(db.metrics.query_latency.value).toBeCloseTo(10, 1);

    // Service B: 20ms base + (1 call * 10ms DB) = 30ms
    expect(serviceB.metrics.latency.value).toBeCloseTo(30, 1);

    // Service A:
    // local processing = 60ms (10 base + 50 load)
    // dependencies = 2 calls * 30ms (from Service B) = 60ms
    // total = 60 + 60 = 120ms
    expect(serviceA.metrics.latency.value).toBeCloseTo(120, 1);
  });

  it('should apply saturation penalties on top of propagated latency', () => {
    const serviceB = engine.components['service-b'];
    // Manual saturation for this test:
    // Capacity is 10 CPU * 10 req/GCU = 100.
    // 200 demand -> 200% utilization.
    // factor = (200 - 80) * 0.1 = 12. Uncapped penalty = 1 + 144 = 145x.
    // With 100x cap: penalty = 100x. Local latency = 20ms * 100 = 2000ms.
    // DB dependency = 5ms. Service B total = 2000 + 5 = 2005ms.
    serviceB.attributes.cpu.limit = 10;

    engine.update();

    // Service B: 20ms (route base) * 100 (capped penalty) + 5ms (DB) = 2005ms.
    expect(serviceB.metrics.latency.value).toBeCloseTo(2005, -1);

    // Service A now sees ~2005ms from B.
    // Service A: 60ms (local) + 2 calls * 2005ms = 60 + 4010 = 4070ms.
    const serviceA = engine.components['service-a'];
    expect(serviceA.metrics.latency.value).toBeCloseTo(4070, -1);
  });
});

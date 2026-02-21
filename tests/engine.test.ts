import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

describe('GameEngine Integration', () => {
  const baseLevel: LevelConfig = {
    id: 'test',
    name: 'Test Level',
    description: 'Level for integration testing',
    components: [
      {
        id: 'server',
        name: 'Server',
        type: 'compute',
        physics: { request_capacity_per_unit: 100 },
        attributes: {
          gcu: { name: 'GCU', unit: 'GCU', initialLimit: 10, minLimit: 1, maxLimit: 100, costPerUnit: 1 },
          ram: { name: 'RAM', unit: 'GB', initialLimit: 8, minLimit: 1, maxLimit: 64, costPerUnit: 1 }
        },
        metrics: {
          latency: { name: 'Lat', unit: 'ms' },
          error_rate: { name: 'Err', unit: '%' }
        },
        traffic_routes: [
          {
            name: 'inflow',
            outgoing_traffics: [{ name: 'dbflow', multiplier: 1 }]
          }
        ]
      },
      {
        id: 'db',
        name: 'DB',
        type: 'database',
        physics: { request_capacity_per_unit: 1 },
        attributes: {
          connections: { name: 'Conn', unit: 'count', initialLimit: 100, minLimit: 1, maxLimit: 1000, costPerUnit: 1 },
          storage: { name: 'Store', unit: 'GB', initialLimit: 100, minLimit: 1, maxLimit: 1000, costPerUnit: 1 }
        },
        metrics: {
          query_latency: { name: 'Lat', unit: 'ms' },
          error_rate: { name: 'Err', unit: '%' }
        },
        traffic_routes: [
          {
            name: 'dbflow',
            outgoing_traffics: []
          }
        ]
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'inflow',
        target_component_name: 'Server',
        value: 150, // Demand on DB is 150. Capacity is 100.
        base_variance: 0
      },
      {
        type: 'internal',
        name: 'dbflow',
        target_component_name: 'DB'
      }
    ],
    statusEffects: [],
    scheduledJobs: [
      {
        name: 'Job 1',
        targetName: 'Server',
        schedule: { interval: 10 },
        affectedAttributes: [{ name: 'gcu', multiplier: -0.5 }],
        emittedTraffic: []
      }
    ]
  };

  it('should apply fair proportional failure using two-pass logic', () => {
    const engine = new GameEngine();
    engine.loadLevel(baseLevel);
    
    engine.update();
    
    const db = engine.components['db'];
    const server = engine.components['server'];
    const traffic = engine.traffics['inflow'];
    
    // DB: Demand 150, Capacity 100. Failure rate 0.33...
    expect(db.metrics.error_rate.value).toBeCloseTo(33.33, 1);
    
    // Server: Receives 150, but DB only accepts 100.
    // Server error rate should be ~33.3% because of the cascading dependency failure.
    expect(server.metrics.error_rate.value).toBeCloseTo(33.33, 1);
    
    // Traffic object itself should reflect history correctly
    expect(traffic.actualValue).toBe(150);
    expect(traffic.successHistory[0]).toBeCloseTo(100, 0);
  });

  it('should handle sequential short-circuiting properly', () => {
    // If DB is 100% down, downstream dependencies should not be called
    const level = JSON.parse(JSON.stringify(baseLevel));
    level.components[1].attributes.connections.initialLimit = 0; // DB fully down
    
    // Add another dependency AFTER the DB
    level.components[0].traffic_routes[0].outgoing_traffics.push({ name: 'otherflow', multiplier: 1 });
    level.components.push({
      id: 'other',
      name: 'Other',
      type: 'compute',
      attributes: {
        gcu: { name: 'GCU', unit: 'GCU', initialLimit: 10, minLimit: 1, maxLimit: 100, costPerUnit: 1 },
        ram: { name: 'RAM', unit: 'GB', initialLimit: 8, minLimit: 1, maxLimit: 64, costPerUnit: 1 }
      },
      metrics: {
        latency: { name: 'Lat', unit: 'ms' },
        error_rate: { name: 'Err', unit: '%' },
        incoming: { name: 'In', unit: 'req/s' }
      },
      traffic_routes: [{ name: 'otherflow', outgoing_traffics: [] }]
    });
    level.traffics.push({ type: 'internal', name: 'otherflow', target_component_name: 'Other' });

    const engine = new GameEngine();
    engine.loadLevel(level);
    engine.update();

    const other = engine.components['other'];
    // DB 100% fail means Server success is 0, so 'Other' node should receive 0 incoming traffic
    expect(other.incomingTrafficVolume).toBe(0);
  });

  it('should run scheduled jobs at the correct interval', () => {
    const engine = new GameEngine();
    engine.loadLevel(baseLevel);
    
    // Initial GCU limit is 10
    const server = engine.components['server'];
    expect(server.attributes.gcu.limit).toBe(10);
    
    // Fast-forward 10 ticks
    for (let i = 0; i < 9; i++) engine.update();
    expect(server.attributes.gcu.limit).toBe(10); // Not yet
    
    engine.update(); // Tick 10
    // Multiplier -0.5: 10 + (10 * -0.5) = 5
    expect(server.attributes.gcu.limit).toBe(5);
  });
});

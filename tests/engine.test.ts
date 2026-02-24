import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import { TrafficStatusEffect } from '../src/lib/game/statusEffects.svelte';
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
          gcu: {
            name: 'GCU',
            unit: 'GCU',
            initialLimit: 10,
            minLimit: 1,
            maxLimit: 100,
            costPerUnit: 1
          },
          ram: {
            name: 'RAM',
            unit: 'GB',
            initialLimit: 8,
            minLimit: 1,
            maxLimit: 64,
            costPerUnit: 1
          }
        },
        metrics: {
          latency: { name: 'Lat', unit: 'ms' },
          error_rate: { name: 'Err', unit: '%' }
        },
        alerts: [],
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
            initialLimit: 100,
            minLimit: 1,
            maxLimit: 1000,
            costPerUnit: 1
          }
        },
        metrics: {
          query_latency: { name: 'Lat', unit: 'ms' },
          error_rate: { name: 'Err', unit: '%' }
        },
        alerts: [],
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

  it('should throw an error when loading a level with an unknown component type', () => {
    const engine = new GameEngine();
    const invalidLevel = JSON.parse(JSON.stringify(baseLevel));
    invalidLevel.components[0].type = 'unknown-type';

    expect(() => engine.loadLevel(invalidLevel)).toThrow('Unknown component type: unknown-type');
  });

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
    level.components[0].traffic_routes[0].outgoing_traffics.push({
      name: 'otherflow',
      multiplier: 1
    });
    level.components.push({
      id: 'other',
      name: 'Other',
      type: 'compute',
      attributes: {
        gcu: {
          name: 'GCU',
          unit: 'GCU',
          initialLimit: 10,
          minLimit: 1,
          maxLimit: 100,
          costPerUnit: 1
        },
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

  it('should allow scheduled jobs to target attribute value (utilization) instead of limit', () => {
    const level = JSON.parse(JSON.stringify(baseLevel));
    // Disable noise, base usage, and consumption for isolation
    level.components[0].physics = {
      resource_base_usage: { ram: 0, gcu: 0 },
      consumption_rates: { ram: 0 },
      noise_factor: 0
    };
    level.traffics[0].value = 0; // No traffic to generate usage
    level.scheduledJobs = [
      {
        name: 'Clear Cache',
        targetName: 'server',
        schedule: { interval: 1 },
        affectedAttributes: [
          {
            name: 'ram',
            target: 'value',
            multiplier: -1.0 // Clear all usage
          }
        ],
        emittedTraffic: []
      }
    ];

    const engine = new GameEngine();
    engine.loadLevel(level);

    const server = engine.components['server'];
    const ram = server.attributes['ram'];

    // Manually set some usage
    ram.update(4);
    expect(ram.current).toBe(4);
    expect(ram.limit).toBe(8);

    engine.update();

    // Limit should be UNTOUCHED (8), but current usage should be CLEARED (0)
    expect(ram.limit).toBe(8);
    expect(ram.current).toBe(0);
  });

  it('should allow scheduled jobs to increase attribute limits using offset and multiplier', () => {
    const level = JSON.parse(JSON.stringify(baseLevel));
    level.scheduledJobs = [
      {
        name: 'Auto-scale GCU',
        targetName: 'server',
        schedule: { interval: 1 },
        affectedAttributes: [
          {
            name: 'gcu',
            target: 'limit',
            multiplier: 0.5, // +50%
            offset: 2 // +2 units
          }
        ],
        emittedTraffic: []
      }
    ];

    const engine = new GameEngine();
    engine.loadLevel(level);

    const server = engine.components['server'];

    // Initial limit is 10
    expect(server.attributes.gcu.limit).toBe(10);

    engine.update();

    // New limit: 10 + (10 * 0.5) + 2 = 17
    expect(server.attributes.gcu.limit).toBe(17);
  });

  it('should enforce maxHistory limit on all telemetry arrays', () => {
    const engine = new GameEngine();
    engine.loadLevel(baseLevel);

    const traffic = engine.traffics['inflow'];
    const server = engine.components['server'];
    const latencyMetric = server.metrics.latency;

    // Run 70 ticks (maxHistory is 60)
    for (let i = 0; i < 70; i++) {
      engine.update();
    }

    expect(traffic.successHistory.length).toBe(60);
    expect(traffic.failureHistory.length).toBe(60);
    expect(traffic.latencyHistory.length).toBe(60);
    expect(latencyMetric.history.length).toBe(60);
  });

  it('should propagate latency additively through dependency chains', () => {
    const level: LevelConfig = {
      id: 'latency-test',
      name: 'Latency Test',
      description: 'Testing latency propagation',
      components: [
        {
          id: 'upstream',
          name: 'Upstream',
          type: 'compute',
          attributes: {
            gcu: {
              name: 'GCU',
              unit: 'GCU',
              initialLimit: 10,
              minLimit: 1,
              maxLimit: 100,
              costPerUnit: 1
            },
            ram: {
              name: 'RAM',
              unit: 'GB',
              initialLimit: 8,
              minLimit: 1,
              maxLimit: 64,
              costPerUnit: 1
            }
          },
          metrics: {
            latency: { name: 'Lat', unit: 'ms' },
            error_rate: { name: 'Err', unit: '%' }
          },
          traffic_routes: [
            {
              name: 'request',
              base_latency_ms: 100,
              outgoing_traffics: [{ name: 'dependency', multiplier: 3 }]
            }
          ]
        },
        {
          id: 'downstream',
          name: 'Downstream',
          type: 'compute',
          attributes: {
            gcu: {
              name: 'GCU',
              unit: 'GCU',
              initialLimit: 10,
              minLimit: 1,
              maxLimit: 100,
              costPerUnit: 1
            },
            ram: {
              name: 'RAM',
              unit: 'GB',
              initialLimit: 8,
              minLimit: 1,
              maxLimit: 64,
              costPerUnit: 1
            }
          },
          metrics: {
            latency: { name: 'Lat', unit: 'ms' },
            error_rate: { name: 'Err', unit: '%' }
          },
          traffic_routes: [
            {
              name: 'dependency',
              base_latency_ms: 20,
              outgoing_traffics: []
            }
          ]
        }
      ],
      traffics: [
        {
          type: 'external',
          name: 'request',
          target_component_name: 'Upstream',
          value: 10,
          base_variance: 0
        },
        {
          type: 'internal',
          name: 'dependency',
          target_component_name: 'Downstream'
        }
      ],
      statusEffects: []
    };

    const engine = new GameEngine();
    engine.loadLevel(level);
    engine.update();

    // Downstream latency = 20ms
    // Upstream latency = 100ms (base) + (3 calls * 20ms) = 160ms
    const upstream = engine.components['upstream'];
    const traffic = engine.traffics['request'];

    expect(upstream.metrics.latency.value).toBe(160);
    expect(traffic.latencyHistory[0]).toBe(160);
  });

  it('should handle TrafficStatusEffect with warning_config', () => {
    const level = JSON.parse(JSON.stringify(baseLevel));
    level.statusEffects = [
      {
        type: 'traffic',
        name: 'Flash Sale',
        traffic_affected: 'inflow',
        multiplier: 4.0, // 5x total
        materialization_probability: 1.0, // Always materialize
        turnsRemaining: 2,
        warning_config: {
          delay_ticks: 3,
          ticket_title: 'Flash Sale Warning',
          ticket_description: 'A flash sale will start in 3 ticks!'
        }
      }
    ];

    const engine = new GameEngine();
    engine.loadLevel(level);

    // Tick 1: Warning starts
    engine.update();
    const effect = engine.statusEffects[0] as TrafficStatusEffect;
    expect(effect.isWarning).toBe(true);
    expect(effect.isActive).toBe(false);
    expect(effect.delayRemaining).toBe(3); // delay_ticks starts at 3
    expect(engine.tickets.length).toBe(1);
    expect(engine.tickets[0].title).toBe('Flash Sale Warning');
    expect(engine.traffics['inflow'].actualValue).toBe(150); // No effect yet

    // Tick 2
    engine.update();
    expect(effect.isWarning).toBe(true);
    expect(effect.delayRemaining).toBe(2);

    // Tick 3
    engine.update();
    expect(effect.isWarning).toBe(true);
    expect(effect.delayRemaining).toBe(1);

    // Tick 4: Warning finishes, isActive becomes true
    engine.update();
    expect(effect.isWarning).toBe(false);
    expect(effect.isActive).toBe(true);
    expect(effect.turnsRemaining).toBe(2); // initialTurnsRemaining (starts at 2)
    expect(engine.traffics['inflow'].actualValue).toBe(750); // Effect applied!
  });

  it('should materialize TrafficStatusEffect and affect traffic volume', () => {
    const level = JSON.parse(JSON.stringify(baseLevel));
    level.statusEffects = [
      {
        type: 'traffic',
        name: 'Flash Sale',
        traffic_affected: 'inflow',
        multiplier: 4.0, // 5x total
        materialization_probability: 1.0, // Always materialize
        turnsRemaining: 2
      }
    ];

    const engine = new GameEngine();
    engine.loadLevel(level);

    // Initial tick: Status effect is NOT active yet (tick() hasn't run)
    // Actually, tick() runs BEFORE traffic calculation in engine.update()
    engine.update();

    const effect = engine.statusEffects[0];
    expect(effect.isActive).toBe(true);
    expect(engine.notifications.length).toBe(1);
    expect(engine.notifications[0].message).toContain('Flash Sale');

    const traffic = engine.traffics['inflow'];
    // baseValue is 150. With 5x it should be 750.
    expect(traffic.actualValue).toBe(750);

    engine.update(); // Tick 2 (turnsRemaining 2 -> 1)
    expect(effect.isActive).toBe(true);
    expect(traffic.actualValue).toBe(750);

    engine.update(); // Tick 3 (turnsRemaining 1 -> 0, becomes inactive)
    expect(effect.isActive).toBe(false);
    expect(traffic.actualValue).toBe(150);
  });

  it('should respect custom apply_delay in queueAction', () => {
    const engine = new GameEngine();
    engine.loadLevel(baseLevel);

    const server = engine.components['server'];
    const ram = server.attributes['ram'];

    // initial ram limit is 8.
    // Apply a change with 10 ticks delay
    engine.queueAction('server', 'ram', 16, 10);

    // After 5 ticks, it should still be 8
    for (let i = 0; i < 5; i++) engine.update();
    expect(ram.limit).toBe(8);

    // After 5 more ticks (total 10), it should be 16
    for (let i = 0; i < 5; i++) engine.update();
    expect(ram.limit).toBe(16);
  });
});

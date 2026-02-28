import { describe, it, expect, vi } from 'vitest';
import { ScheduledJob } from '../src/lib/game/scheduledJobs.svelte';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

// Minimal level config shared across unit tests
const baseLevel: LevelConfig = {
  id: 'sj-test',
  name: 'Scheduled Job Test',
  description: 'Level for scheduled job testing',
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
          minLimit: 0,
          maxLimit: 100
        }
      },
      metrics: {
        latency: { name: 'Lat', unit: 'ms' },
        error_rate: { name: 'Err', unit: '%' }
      },
      alerts: [],
      traffic_routes: [{ name: 'inflow', outgoing_traffics: [] }]
    }
  ],
  traffics: [
    {
      type: 'external',
      name: 'inflow',
      target_component_name: 'Server',
      value: 0,
      base_variance: 0
    }
  ],
  statusEffects: [],
  scheduledJobs: []
};

describe('ScheduledJob.shouldRun()', () => {
  it('returns false at tick 0', () => {
    const job = new ScheduledJob({
      name: 'Job',
      targetName: 'Server',
      schedule: { interval: 5 },
      affectedAttributes: [],
      emittedTraffic: []
    });
    expect(job.shouldRun(0)).toBe(false);
  });

  it('returns true at each interval multiple', () => {
    const job = new ScheduledJob({
      name: 'Job',
      targetName: 'Server',
      schedule: { interval: 5 },
      affectedAttributes: [],
      emittedTraffic: []
    });
    expect(job.shouldRun(5)).toBe(true);
    expect(job.shouldRun(10)).toBe(true);
    expect(job.shouldRun(15)).toBe(true);
  });

  it('returns false between interval multiples', () => {
    const job = new ScheduledJob({
      name: 'Job',
      targetName: 'Server',
      schedule: { interval: 5 },
      affectedAttributes: [],
      emittedTraffic: []
    });
    expect(job.shouldRun(1)).toBe(false);
    expect(job.shouldRun(3)).toBe(false);
    expect(job.shouldRun(7)).toBe(false);
    expect(job.shouldRun(9)).toBe(false);
  });
});

describe('ScheduledJob.run() — attribute effects', () => {
  it('applies multiplier to attribute limit', () => {
    const engine = new GameEngine();
    engine.loadLevel(JSON.parse(JSON.stringify(baseLevel)));

    const server = engine.components['server'];
    expect(server.attributes.gcu.limit).toBe(10);

    const job = new ScheduledJob({
      name: 'Shrink',
      targetName: 'Server',
      schedule: { interval: 1 },
      affectedAttributes: [{ name: 'gcu', multiplier: 0.5 }],
      emittedTraffic: []
    });

    job.run(engine, 1);

    // 10 + (10 * 0.5) = 15
    expect(server.attributes.gcu.limit).toBe(15);
  });

  it('applies offset to attribute limit', () => {
    const engine = new GameEngine();
    engine.loadLevel(JSON.parse(JSON.stringify(baseLevel)));

    const server = engine.components['server'];

    const job = new ScheduledJob({
      name: 'Drain',
      targetName: 'Server',
      schedule: { interval: 1 },
      affectedAttributes: [{ name: 'gcu', offset: -3 }],
      emittedTraffic: []
    });

    job.run(engine, 1);

    // 10 + 0 + (-3) = 7
    expect(server.attributes.gcu.limit).toBe(7);
  });

  it('clamps attribute limit to 0 (no negatives)', () => {
    const engine = new GameEngine();
    const level = JSON.parse(JSON.stringify(baseLevel));
    level.components[0].attributes.gcu.initialLimit = 2;
    engine.loadLevel(level);

    const server = engine.components['server'];

    const job = new ScheduledJob({
      name: 'Destroy',
      targetName: 'Server',
      schedule: { interval: 1 },
      affectedAttributes: [{ name: 'gcu', offset: -100 }],
      emittedTraffic: []
    });

    job.run(engine, 1);

    expect(server.attributes.gcu.limit).toBe(0);
  });

  it('calls attr.update() when target is "value"', () => {
    const engine = new GameEngine();
    engine.loadLevel(JSON.parse(JSON.stringify(baseLevel)));

    const server = engine.components['server'];
    const attr = server.attributes.gcu;
    attr.update(8); // Set current usage to 8
    expect(attr.current).toBe(8);

    const job = new ScheduledJob({
      name: 'Clear',
      targetName: 'Server',
      schedule: { interval: 1 },
      affectedAttributes: [{ name: 'gcu', target: 'value', multiplier: -1.0 }],
      emittedTraffic: []
    });

    job.run(engine, 1);

    // 8 + (8 * -1.0) + 0 = 0
    expect(attr.current).toBe(0);
    // limit must not change
    expect(attr.limit).toBe(10);
  });

  it('silently skips when targetName matches no component', () => {
    const engine = new GameEngine();
    engine.loadLevel(JSON.parse(JSON.stringify(baseLevel)));

    const server = engine.components['server'];
    const originalLimit = server.attributes.gcu.limit;

    const job = new ScheduledJob({
      name: 'Ghost',
      targetName: 'NonExistentComponent',
      schedule: { interval: 1 },
      affectedAttributes: [{ name: 'gcu', offset: -5 }],
      emittedTraffic: []
    });

    expect(() => job.run(engine, 1)).not.toThrow();
    expect(server.attributes.gcu.limit).toBe(originalLimit);
  });

  it('silently skips when effect.name matches no attribute', () => {
    const engine = new GameEngine();
    engine.loadLevel(JSON.parse(JSON.stringify(baseLevel)));

    const server = engine.components['server'];
    const originalLimit = server.attributes.gcu.limit;

    const job = new ScheduledJob({
      name: 'Bad Attr',
      targetName: 'Server',
      schedule: { interval: 1 },
      affectedAttributes: [{ name: 'nonexistent_attr', offset: 999 }],
      emittedTraffic: []
    });

    expect(() => job.run(engine, 1)).not.toThrow();
    expect(server.attributes.gcu.limit).toBe(originalLimit);
  });
});

describe('ScheduledJob.run() — emittedTraffic', () => {
  it('calls recordDemand and handleTraffic for each emitted traffic entry', () => {
    const engine = new GameEngine();
    engine.loadLevel(JSON.parse(JSON.stringify(baseLevel)));

    const recordSpy = vi.spyOn(engine, 'recordDemand');
    const handleSpy = vi.spyOn(engine, 'handleTraffic');

    const job = new ScheduledJob({
      name: 'Traffic Emitter',
      targetName: 'Server',
      schedule: { interval: 1 },
      affectedAttributes: [],
      emittedTraffic: [{ name: 'inflow', value: 50 }]
    });

    job.run(engine, 1);

    expect(recordSpy).toHaveBeenCalledWith('inflow', 50);
    expect(handleSpy).toHaveBeenCalledWith('inflow', 50);
  });
});

describe('ScheduledJob integration via GameEngine', () => {
  it('runs job at the correct tick interval via engine.update()', () => {
    const level: LevelConfig = JSON.parse(JSON.stringify(baseLevel));
    level.scheduledJobs = [
      {
        name: 'Shrink GCU',
        targetName: 'Server',
        schedule: { interval: 10 },
        affectedAttributes: [{ name: 'gcu', multiplier: -0.5 }],
        emittedTraffic: []
      }
    ];

    const engine = new GameEngine();
    engine.loadLevel(level);

    const server = engine.components['server'];
    expect(server.attributes.gcu.limit).toBe(10);

    for (let i = 0; i < 9; i++) engine.update();
    expect(server.attributes.gcu.limit).toBe(10); // Not yet

    engine.update(); // Tick 10: job runs
    // 10 + (10 * -0.5) = 5
    expect(server.attributes.gcu.limit).toBe(5);
  });
});

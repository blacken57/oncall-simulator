import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import { validateLevel } from '../src/lib/game/validator';
import type { LevelConfig } from '../src/lib/game/schema';

describe('QueueNode Physics & Alerts', () => {
  const level: LevelConfig = {
    id: 'queue-test',
    name: 'Queue Test',
    description: 'Verifying queue behavior',
    components: [
      {
        id: 'producer',
        name: 'Producer',
        type: 'compute',
        attributes: {
          gcu: {
            name: 'GCU',
            unit: 'C',
            initialLimit: 10,
            minLimit: 1,
            maxLimit: 10
          }
        },
        metrics: {},
        traffic_routes: [
          {
            name: 'inflow',
            outgoing_traffics: [{ name: 'to-queue', multiplier: 1 }]
          }
        ]
      },
      {
        id: 'my-queue',
        name: 'My Queue',
        type: 'queue',
        attributes: {
          backlog: {
            name: 'Backlog',
            unit: 'msg',
            initialLimit: 100,
            minLimit: 10,
            maxLimit: 1000
          },
          egress: {
            name: 'Egress',
            unit: 'msg/s',
            initialLimit: 10,
            minLimit: 0,
            maxLimit: 100
          }
        },
        metrics: {
          current_message_count: { name: 'Count', unit: 'msg' },
          incoming_message_count: { name: 'In', unit: 'msg' },
          egress_failures: { name: 'Fail', unit: 'msg' },
          error_rate: { name: 'Err', unit: '%' }
        },
        alerts: [],
        traffic_routes: [
          {
            name: 'to-queue',
            outgoing_traffics: [{ name: 'from-queue', multiplier: 1 }]
          }
        ]
      },
      {
        id: 'consumer',
        name: 'Consumer',
        type: 'compute',
        attributes: {
          gcu: {
            name: 'GCU',
            unit: 'C',
            initialLimit: 10,
            minLimit: 1,
            maxLimit: 10
          }
        },
        metrics: {
          incoming: { name: 'In', unit: 'req' }
        },
        traffic_routes: [
          {
            name: 'from-queue',
            outgoing_traffics: []
          }
        ]
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'inflow',
        target_component_name: 'Producer',
        value: 50,
        base_variance: 0
      },
      { type: 'internal', name: 'to-queue', target_component_name: 'My Queue' },
      { type: 'internal', name: 'from-queue', target_component_name: 'Consumer' }
    ],
    statusEffects: []
  };

  it('should immediately push messages and accumulate the rest', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    // Tick 1: In 50. pushRate is 10.
    // It should immediately push 10 and keep 40 in backlog.
    engine.update();
    const queue = engine.components['my-queue'];
    expect(queue.metrics.current_message_count.value).toBe(40);
    expect(queue.attributes.egress.current).toBe(10);

    // Tick 2: In 50. Backlog 40. Total available 90. pushRate is 10.
    // It should push 10. New backlog 40 + 50 - 10 = 80.
    engine.update();
    expect(queue.metrics.current_message_count.value).toBe(80);
    expect(queue.attributes.egress.current).toBe(10);

    const consumer = engine.components['consumer'];
    // History array for incoming
    expect(consumer.metrics.incoming.value).toBe(10);
  });

  it('should fail with error_rate when queue is full', () => {
    const engine = new GameEngine();
    const fullLevel = JSON.parse(JSON.stringify(level));
    fullLevel.components[1].attributes.backlog.initialLimit = 20;
    engine.loadLevel(fullLevel);

    // Tick 1: In 50. Backlog 0. Max 20. pushRate 10.
    // Available space = 20 - 0 + 10 = 30.
    // Demand = 50. Failure rate = (50 - 30) / 50 = 40%.
    // Accepts 30. Fails 20. error_rate = 20/50 = 40%.
    // Process push pushes 10.
    // newCount = 0 + 30 - 10 = 20.
    engine.update();
    const queue = engine.components['my-queue'];
    expect(queue.metrics.error_rate.value).toBe(40); // 20/50
    expect(queue.metrics.current_message_count.value).toBe(20);

    // Tick 2: In 50. Backlog 20. pushRate 10. Max 20.
    // Available space = 20 - 20 + 10 = 10.
    // Demand 50. Failure rate = (50 - 10) / 50 = 80%.
    // Accepts 10. Fails 40. error_rate = 80%.
    // Process push pushes 10.
    // newCount = 20 + 10 - 10 = 20.
    engine.update();
    expect(queue.metrics.error_rate.value).toBe(80); // 40/50
    expect(queue.metrics.current_message_count.value).toBe(20);
  });

  it('should trigger alerts and generate tickets', () => {
    const engine = new GameEngine();
    const alertLevel = JSON.parse(JSON.stringify(level));
    // Set max to 50 so it fills up quickly
    alertLevel.components[1].attributes.backlog.initialLimit = 50;
    engine.loadLevel(alertLevel);
    engine.warmupTicks = 0;

    // Tick 1: incoming 50 > outgoing 10.
    // Backlog becomes 40.
    engine.update();
    const queue = engine.components['my-queue'];

    expect(queue.statusTriggers['large_fill_rate']).toBe('critical');

    const ticketFill = engine.tickets.find((t) => t.alertName === 'large_fill_rate');
    expect(ticketFill).toBeDefined();

    // Tick 2: incoming 50. Space available is 10 (since it pushes 10).
    // Fills queue to max (50).
    engine.update();
    expect(queue.statusTriggers['Queue Near Full']).toBe('critical');

    const ticketFull = engine.tickets.find((t) => t.alertName === 'Queue Near Full');
    expect(ticketFull).toBeDefined();
  });

  it('should count egress_failures and only reduce backlog by successful pushes on partial rejection', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    // Tick 1: Normal operation. In=50, Push=10. Backlog=40.
    engine.update();
    const queue = engine.components['my-queue'];
    expect(queue.metrics.current_message_count.value).toBe(40);

    // Reduce consumer capacity to 5 req/s (half the egress rate of 10).
    // Consumer: gcu.limit=0.25, request_capacity_per_unit=20 → capacity = 0.25 * 20 = 5.
    // demand (from preTick)=10, failureRate=(10-5)/10=0.5, successfulVolume=round(10*0.5)=5.
    engine.components['consumer'].attributes.gcu.limit = 0.25;

    // Tick 2: In=50 (all accepted, queue still has space). Backlog=40.
    // Attempted push=10, consumer accepts 5.
    // egress_failures = 10 - 5 = 5. newBacklog = 40 + 50 - 5 = 85.
    engine.update();
    expect(queue.metrics.egress_failures.value).toBe(5);
    expect(queue.metrics.current_message_count.value).toBe(85);
  });

  it('should validate that multipliers must be 1 for queue routes', () => {
    const invalidLevel = JSON.parse(JSON.stringify(level));
    invalidLevel.components[1].traffic_routes[0].outgoing_traffics[0].multiplier = 2;

    const errors = validateLevel(invalidLevel);
    expect(errors.some((e) => e.message.includes('Queue multipliers MUST be 1'))).toBe(true);
  });

  it('should handle fan-out to multiple consumers correctly', () => {
    const fanoutLevel = JSON.parse(JSON.stringify(level));
    // Increase max to avoid capping in the test
    fanoutLevel.components[1].attributes.backlog.initialLimit = 1000;
    // Add another consumer
    fanoutLevel.components.push({
      id: 'consumer-2',
      name: 'Consumer 2',
      type: 'compute',
      attributes: {
        gcu: { name: 'GCU', unit: 'C', initialLimit: 10, minLimit: 1, maxLimit: 10 }
      },
      metrics: { incoming: { name: 'In', unit: 'req' } },
      traffic_routes: [{ name: 'from-queue-2', outgoing_traffics: [] }]
    });
    // Add traffic definition
    fanoutLevel.traffics.push({
      type: 'internal',
      name: 'from-queue-2',
      target_component_name: 'Consumer 2'
    });
    // Update queue route to fan-out
    fanoutLevel.components[1].traffic_routes[0].outgoing_traffics.push({
      name: 'from-queue-2',
      multiplier: 1
    });

    const engine = new GameEngine();
    engine.loadLevel(fanoutLevel);

    engine.update(); // Tick 1: In 50. Push 10. Backlog 40.
    engine.update(); // Tick 2: In 50. Push 10. Backlog 80.

    const queue = engine.components['my-queue'];
    expect(queue.attributes.egress.current).toBe(10);
    expect(engine.components['consumer'].metrics.incoming.value).toBe(10);
    expect(engine.components['consumer-2'].metrics.incoming.value).toBe(10);

    // Now restrict Consumer 2 capacity drastically
    engine.components['consumer-2'].attributes.gcu.limit = 0;

    engine.update(); // Tick 3: In 50. Backlog 80. Push 10.
    // Consumer 2 rejects all 10.
    // Egress attempts should still be 10.
    expect(queue.attributes.egress.current).toBe(10);
    // Egress failures should be 10.
    expect(queue.metrics.egress_failures.value).toBe(10);
    // Backlog should be 130 (nothing was subtracted because 0 was successful).
    expect(queue.metrics.current_message_count.value).toBe(80 + 50 - 0); // 130
  });

  it('should validate consumer types', () => {
    const invalidLevel = JSON.parse(JSON.stringify(level));
    // Target a database
    invalidLevel.components.push({
      id: 'bad-consumer',
      name: 'Bad Consumer',
      type: 'database',
      attributes: {
        connections: {
          name: 'Conn',
          unit: 'C',
          initialLimit: 10,
          minLimit: 1,
          maxLimit: 10
        }
      },
      metrics: {},
      traffic_routes: [{ name: 'to-db', outgoing_traffics: [] }]
    });
    invalidLevel.traffics.push({
      type: 'internal',
      name: 'to-db',
      target_component_name: 'Bad Consumer'
    });
    invalidLevel.components[1].traffic_routes[0].outgoing_traffics[0].name = 'to-db';

    const errors = validateLevel(invalidLevel);
    expect(
      errors.some((e) =>
        e.message.includes('targets invalid consumer "Bad Consumer" of type "database"')
      )
    ).toBe(true);
  });
});

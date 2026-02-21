import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

describe('Tickets System', () => {
  const level: LevelConfig = {
    id: 'test-tickets',
    name: 'Ticket Test',
    description: 'Verifying ticket generation',
    components: [
      {
        id: 'bad-server',
        name: 'Bad Server',
        type: 'compute',
        physics: {
            request_capacity_per_unit: 10,
            status_thresholds: {
                gcu_util: { warning: 80, critical: 90 }
            }
        },
        attributes: {
          gcu: { name: 'GCU', unit: 'GCU', initialLimit: 1, minLimit: 1, maxLimit: 10, costPerUnit: 1 },
          ram: { name: 'RAM', unit: 'GB', initialLimit: 8, minLimit: 1, maxLimit: 64, costPerUnit: 1 }
        },
        metrics: {
          latency: { name: 'Lat', unit: 'ms' },
          error_rate: { name: 'Err', unit: '%' }
        },
        traffic_routes: []
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'inflow',
        target_component_name: 'Bad Server',
        value: 100, // 100 requests on 10 capacity = 1000% utilization (definitely critical)
        base_variance: 0
      }
    ],
    statusEffects: []
  };

  it('should generate a ticket when a component goes critical', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    expect(engine.tickets).toHaveLength(0);

    engine.update(); // Tick 1: Status becomes critical

    expect(engine.components['bad-server'].status).toBe('critical');
    expect(engine.tickets).toHaveLength(1);
    expect(engine.tickets[0].title).toContain('CRITICAL: Bad Server failure');
    expect(engine.tickets[0].status).toBe('open');
  });

  it('should NOT generate duplicate tickets for the same component if one is already open', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    engine.update(); // Tick 1: Status becomes critical, ticket generated
    expect(engine.tickets).toHaveLength(1);

    engine.update(); // Tick 2: Still critical, should NOT generate new ticket
    expect(engine.tickets).toHaveLength(1);
  });
});
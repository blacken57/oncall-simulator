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
          request_capacity_per_unit: 10
        },
        attributes: {
          gcu: {
            name: 'GCU',
            unit: 'GCU',
            initialLimit: 1,
            minLimit: 1,
            maxLimit: 10
          },
          ram: {
            name: 'RAM',
            unit: 'GB',
            initialLimit: 8,
            minLimit: 1,
            maxLimit: 64
          }
        },
        metrics: {
          latency: { name: 'Lat', unit: 'ms' },
          error_rate: { name: 'Err', unit: '%' }
        },
        alerts: [
          {
            name: 'GCU Critical',
            metric: 'gcu',
            warning_threshold: 80,
            critical_threshold: 90,
            direction: 'above'
          },
          {
            name: 'Error Spike',
            metric: 'error_rate',
            warning_threshold: 1,
            critical_threshold: 5,
            direction: 'above'
          }
        ],
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

  it('should generate a ticket when an alert goes critical', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    expect(engine.tickets).toHaveLength(0);

    engine.update(); // Tick 1: Status becomes critical

    expect(engine.components['bad-server'].status).toBe('critical');
    expect(engine.tickets).toHaveLength(2);
    expect(engine.tickets[0].title).toContain('GCU Critical');
    expect(engine.tickets[0].status).toBe('open');
  });

  it('should generate multiple tickets if multiple alerts are critical', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    // Manually trigger another critical alert
    // ComputeNode.tick will recalculate gcu, but let's assume we can trigger error_rate too
    // We can simulate this by making the calculateFailureRate return > 5%
    // Our Bad Server has 10 capacity, 100 demand => 90% failure rate.

    engine.update();

    expect(engine.tickets).toHaveLength(2);
    const titles = engine.tickets.map((t) => t.title);
    expect(titles).toContain('CRITICAL: Bad Server - GCU Critical');
    expect(titles).toContain('CRITICAL: Bad Server - Error Spike');
  });

  it('should NOT generate duplicate tickets for the same alert if one is already open', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    engine.update();
    expect(engine.tickets).toHaveLength(2);

    engine.update();
    expect(engine.tickets).toHaveLength(2);
  });

  it('should raise a new ticket if a ticket was resolved but the issue persists', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    engine.update(); // Tick 1: Status becomes critical, 2 tickets generated
    expect(engine.tickets).toHaveLength(2);

    // Manually resolve one of the tickets
    const ticketId = engine.tickets[0].id;
    const ticket = engine.tickets.find((t) => t.id === ticketId)!;
    ticket.status = 'resolved';

    // Update again. Since the issue (inflow=100) still exists, a NEW ticket should be cut.
    engine.update();

    const openTicketsForThatAlert = engine.tickets.filter(
      (t) => t.alertName === ticket.alertName && t.status === 'open'
    );
    expect(openTicketsForThatAlert).toHaveLength(1);
    expect(engine.tickets.length).toBe(3); // 1 resolved, 2 open (1 new, 1 from before)
  });
});

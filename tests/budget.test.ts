import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

describe('Budget and Cost Calculations', () => {
  const level: LevelConfig = {
    id: 'budget-test',
    name: 'Budget Test',
    description: 'Testing spend and budget logic',
    components: [
      {
        id: 'comp-1',
        name: 'Component 1',
        type: 'compute',
        attributes: {
          gcu: {
            name: 'GCU',
            unit: 'GCU',
            initialLimit: 10,
            minLimit: 1,
            maxLimit: 100,
            costPerUnit: 5
          },
          ram: {
            name: 'RAM',
            unit: 'GB',
            initialLimit: 16,
            minLimit: 1,
            maxLimit: 128,
            costPerUnit: 2
          }
        },
        metrics: {},
        traffic_routes: []
      },
      {
        id: 'comp-2',
        name: 'Component 2',
        type: 'database',
        attributes: {
          connections: {
            name: 'Conn',
            unit: 'count',
            initialLimit: 100,
            minLimit: 1,
            maxLimit: 1000,
            costPerUnit: 0.5
          }
        },
        metrics: {},
        traffic_routes: []
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'dummy',
        target_component_name: 'Component 1',
        value: 0
      }
    ],
    statusEffects: []
  };

  it('should calculate initial currentSpend correctly', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    // Comp 1: (10 * 5) + (16 * 2) = 50 + 32 = 82
    // Comp 2: (100 * 0.5) = 50
    // Total: 82 + 50 = 132
    expect(engine.currentSpend).toBe(132);
  });

  it('should update currentSpend when attribute limits change', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    expect(engine.currentSpend).toBe(132);

    // Change Comp 1 GCU limit to 20
    const comp1 = engine.components['comp-1'];
    comp1.attributes.gcu.limit = 20;

    // Comp 1: (20 * 5) + (16 * 2) = 100 + 32 = 132
    // Comp 2: 50
    // Total: 132 + 50 = 182
    expect(engine.currentSpend).toBe(182);
  });

  it('should reflect costs from queued actions after they materialize', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    // Initial spend: 132
    expect(engine.currentSpend).toBe(132);

    // Queue action: Increase RAM to 32 GB (cost increase of 16 * 2 = 32)
    engine.queueAction('comp-1', 'ram', 32, 2);

    engine.update(); // Tick 1: Action pending
    expect(engine.currentSpend).toBe(132);
    expect(engine.components['comp-1'].attributes.ram.limit).toBe(16);

    engine.update(); // Tick 2: Action applied
    expect(engine.components['comp-1'].attributes.ram.limit).toBe(32);

    // New spend: 132 + 32 = 164
    expect(engine.currentSpend).toBe(164);
  });
});

import { describe, it, expect } from 'vitest';
import { validateLevel } from '../src/lib/game/validator';
import type { LevelConfig } from '../src/lib/game/schema';

describe('Level Validator', () => {
  const baseLevel: LevelConfig = {
    id: 'test-level',
    name: 'Test Level',
    description: 'A level for testing',
    components: [
      {
        id: 'comp-1',
        name: 'Component 1',
        type: 'compute',
        attributes: {},
        metrics: {},
        traffic_routes: [
          {
            name: 'traffic-1',
            outgoing_traffics: [{ name: 'internal-1', multiplier: 1 }]
          }
        ]
      },
      {
        id: 'comp-2',
        name: 'Component 2',
        type: 'compute',
        attributes: {},
        metrics: {},
        traffic_routes: [
          {
            name: 'internal-1',
            outgoing_traffics: []
          }
        ]
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'traffic-1',
        target_component_name: 'Component 1',
        value: 100
      },
      {
        type: 'internal',
        name: 'internal-1',
        target_component_name: 'Component 2'
      }
    ],
    statusEffects: []
  };

  it('validates a correct level', () => {
    const errors = validateLevel(baseLevel);
    expect(errors).toHaveLength(0);
  });

  it('catches duplicate component IDs', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.components[1].id = 'comp-1';
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('Duplicate component ID'))).toBe(true);
  });

  it('catches non-existent traffic targets', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.traffics[0].target_component_name = 'Non-Existent';
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('targets non-existent component'))).toBe(true);
  });

  it('catches orphaned internal traffic', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    // Remove the outgoing traffic link
    invalid.components[0].traffic_routes[0].outgoing_traffics = [];
    const errors = validateLevel(invalid);
    expect(
      errors.some((e) => e.message.includes('Internal traffic "internal-1" is never emitted'))
    ).toBe(true);
  });

  it('catches components missing routes for traffic targeting them', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    // Remove the route for internal-1 in Component 2
    invalid.components[1].traffic_routes = [];
    const errors = validateLevel(invalid);
    expect(
      errors.some((e) =>
        e.message.includes('receives traffic "internal-1" but has no route defined')
      )
    ).toBe(true);
  });
});

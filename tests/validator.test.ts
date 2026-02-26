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

  it('catches invalid component types', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.components[0].type = 'invalid-type';
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('Unknown component type'))).toBe(true);
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

  it('catches status effects targeting non-existent components or traffic', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.statusEffects.push({
      type: 'traffic',
      name: 'Bad Effect',
      traffic_affected: 'non-existent',
      multiplier: 2,
      materialization_probability: 0.5,
      turnsRemaining: 1
    });
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('targets non-existent traffic'))).toBe(true);
  });

  it('catches circular traffic dependencies', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    // C1 calls C2. Let's make C2 call C1.
    invalid.traffics.push({
      type: 'internal',
      name: 'back-to-1',
      target_component_name: 'Component 1'
    });
    invalid.components[1].traffic_routes[0].outgoing_traffics.push({
      name: 'back-to-1',
      multiplier: 1
    });
    // Add the missing route for back-to-1 in Component 1
    invalid.components[0].traffic_routes.push({
      name: 'back-to-1',
      outgoing_traffics: []
    });

    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('Circular traffic dependency detected'))).toBe(
      true
    );
  });

  it('catches duplicate component names', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.components[1].name = 'Component 1';
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('Duplicate component name'))).toBe(true);
  });

  it('catches duplicate traffic names', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.traffics[1].name = 'traffic-1';
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('Duplicate traffic name'))).toBe(true);
  });

  it('catches duplicate alert names', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.components[0].alerts = [
      {
        name: 'duplicate-alert',
        metric: 'latency',
        warning_threshold: 50,
        critical_threshold: 100,
        direction: 'above'
      },
      {
        name: 'duplicate-alert',
        metric: 'error_rate',
        warning_threshold: 5,
        critical_threshold: 10,
        direction: 'above'
      }
    ];
    // Add dummy metrics to bypass missing metric check
    invalid.components[0].metrics = {
      latency: { name: 'Lat', unit: 'ms' },
      error_rate: { name: 'Err', unit: '%' }
    };
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('has duplicate alert name'))).toBe(true);
  });

  it('catches alerts referencing missing metrics/attributes', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.components[0].alerts = [
      {
        name: 'bad-alert',
        metric: 'missing_metric',
        warning_threshold: 50,
        critical_threshold: 100,
        direction: 'above'
      }
    ];
    const errors = validateLevel(invalid);
    expect(
      errors.some((e) => e.message.includes('references non-existent metric or attribute'))
    ).toBe(true);
  });

  it('catches scheduled jobs targeting missing attributes', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.scheduledJobs = [
      {
        name: 'Bad Job',
        targetName: 'Component 1',
        schedule: { interval: 10 },
        affectedAttributes: [{ name: 'missing_attr', multiplier: 2 }],
        emittedTraffic: []
      }
    ];
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('targets non-existent attribute'))).toBe(true);
  });

  it('catches scheduled jobs targeting missing components', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.scheduledJobs = [
      {
        name: 'Bad Job',
        targetName: 'Missing Component',
        schedule: { interval: 10 },
        affectedAttributes: [],
        emittedTraffic: []
      }
    ];
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('targets non-existent component'))).toBe(true);
  });

  it('catches component status effects targeting missing components', () => {
    const invalid = JSON.parse(JSON.stringify(baseLevel));
    invalid.statusEffects.push({
      type: 'component',
      name: 'Bad Component Effect',
      component_affected: 'missing-id',
      metric_affected: 'latency',
      materialization_probability: 0.5,
      resolution_condition: { turnsRemaining: 1 },
      max_instances_at_once: 1
    });
    const errors = validateLevel(invalid);
    expect(errors.some((e) => e.message.includes('targets non-existent component'))).toBe(true);
  });
});

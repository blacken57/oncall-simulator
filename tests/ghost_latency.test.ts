import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

describe('Ghost Latency Investigation', () => {
  let engine: GameEngine;

  const level: LevelConfig = {
    id: 'ghost-test',
    name: 'Ghost Test',
    description: 'Isolation test for latency',
    components: [
      {
        id: 'server',
        name: 'Server',
        type: 'compute',
        physics: {
          latency_base_ms: 100,
          latency_load_factor: 0,
          noise_factor: 0,
          resource_base_usage: { cpu: 0 }
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
        traffic_routes: [{ name: 'inflow', base_latency_ms: 100, outgoing_traffics: [] }]
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'inflow',
        target_component_name: 'Server',
        value: 10,
        base_variance: 0
      }
    ],
    statusEffects: []
  };

  beforeEach(() => {
    engine = new GameEngine();
    engine.loadLevel(level);
  });

  it('should report exactly the configured base latency', () => {
    engine.update();
    const server = engine.components['server'];
    // Theoretical: 100ms base + (10 req * 0 load) = 100ms.
    expect(server.metrics.latency.value).toBe(100);
  });

  it('should report exactly 150ms when load factor is 5', () => {
    const serverComp = engine.components['server'];
    serverComp.physics.latency_load_factor = 5;

    engine.update();
    // Theoretical: 100ms base + (10 req * 5 load) = 150ms.
    expect(serverComp.metrics.latency.value).toBe(150);
  });
});

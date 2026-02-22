import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import { getLevel, getAllLevels } from '../src/lib/game/levels';

describe('Level System & Engine Integration', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  it('should list all available levels', () => {
    const levels = getAllLevels();
    expect(levels.length).toBeGreaterThanOrEqual(3);
    expect(levels.map((l) => l.id)).toContain('tutorial');
    expect(levels.map((l) => l.id)).toContain('level-1');
    expect(levels.map((l) => l.id)).toContain('ecommerce-megastore');
  });

  it('should load a level from registry', () => {
    const tutorial = getLevel('tutorial');
    expect(tutorial).toBeDefined();
    engine.loadLevel(tutorial!);
    expect(engine.currentLevelId).toBe('tutorial');
    expect(Object.keys(engine.components).length).toBe(1);
  });

  it('should load the ecommerce-megastore level correctly', () => {
    const level = getLevel('ecommerce-megastore');
    expect(level).toBeDefined();
    engine.loadLevel(level!);
    expect(engine.currentLevelId).toBe('ecommerce-megastore');
    expect(Object.keys(engine.components).length).toBe(9);
    expect(engine.components['api-gateway']).toBeDefined();
    expect(engine.components['search-service']).toBeDefined();
    expect(engine.components['order-service']).toBeDefined();
  });

  it('should handle switching levels correctly', () => {
    const tutorial = getLevel('tutorial')!;
    const level1 = getLevel('level-1')!;

    engine.loadLevel(tutorial);
    expect(engine.currentLevelId).toBe('tutorial');

    engine.loadLevel(level1);
    expect(engine.currentLevelId).toBe('level-1');
    expect(Object.keys(engine.components).length).toBeGreaterThan(1);
    expect(engine.tick).toBe(0); // Reset state
  });

  it('should update the "Incoming" metric in the tutorial component', () => {
    const tutorial = getLevel('tutorial')!;
    engine.loadLevel(tutorial);

    // Initial value is 0 or configured base
    const server = engine.components['basic-server'];
    expect(server.metrics.incoming.value).toBe(0);

    // After one tick
    engine.update();
    expect(server.metrics.incoming.value).toBeGreaterThan(0);
    // After second tick
    const firstVal = server.metrics.incoming.value;
    engine.update();
    const secondVal = server.metrics.incoming.value;

    // With noise, it should most likely change (though very small probability it doesn't)
    // Here we just check it updated at all from 0.
    expect(firstVal).not.toBe(0);
    expect(secondVal).not.toBe(0);
  });

  it('should not crash if updating empty state', () => {
    // Engine starts with empty components/traffics
    expect(() => engine.update()).not.toThrow();
    expect(engine.tick).toBe(0); // Tick should not increment for empty engine
  });
});

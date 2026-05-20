import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

const baseLevel: LevelConfig = {
  id: 'test',
  name: 'Test Level',
  description: 'Timer leak test',
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
      value: 50,
      base_variance: 0
    }
  ],
  statusEffects: [],
  scheduledJobs: []
};

describe('Notification timer cleanup', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clear notification timers on stop()', () => {
    vi.useFakeTimers();
    const engine = new GameEngine();
    engine.loadLevel(baseLevel);

    engine.notify('msg1');
    engine.notify('msg2');
    expect(engine.notifications).toHaveLength(2);

    engine.stop();

    // Advance past the 5s auto-remove timeout
    vi.advanceTimersByTime(10000);

    // Timers were cleared on stop, so notifications should still be present
    expect(engine.notifications).toHaveLength(2);
  });

  it('should clear notification timers on loadLevel()', () => {
    vi.useFakeTimers();
    const engine = new GameEngine();
    engine.loadLevel(baseLevel);

    engine.notify('old notification');
    expect(engine.notifications).toHaveLength(1);

    // Reload clears notifications array and cancels timers
    engine.loadLevel(baseLevel);
    expect(engine.notifications).toHaveLength(0);

    // Old timer should not crash or re-add to the now-empty array
    vi.advanceTimersByTime(10000);
    expect(engine.notifications).toHaveLength(0);
  });

  it('should auto-remove notifications after timeout when engine is running', () => {
    vi.useFakeTimers();
    const engine = new GameEngine();
    engine.loadLevel(baseLevel);

    engine.notify('temporary');
    expect(engine.notifications).toHaveLength(1);

    // Normal behavior: notification auto-removed after 5s
    vi.advanceTimersByTime(5000);
    expect(engine.notifications).toHaveLength(0);
  });
});

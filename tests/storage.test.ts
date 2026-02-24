import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/lib/game/engine.svelte';
import type { LevelConfig } from '../src/lib/game/schema';

describe('Storage Physics', () => {
  const level: LevelConfig = {
    id: 'storage-test',
    name: 'Storage Test',
    description: 'Testing storage-specific physics',
    components: [
      {
        id: 'storage-1',
        name: 'Storage 1',
        type: 'storage',
        physics: {
          consumption_rates: {
            storage_usage: 1 // 1 GB per request
          }
        },
        attributes: {
          storage_usage: {
            name: 'Usage',
            unit: 'GB',
            initialLimit: 100,
            minLimit: 1,
            maxLimit: 1000,
            costPerUnit: 1
          }
        },
        metrics: {
          error_rate: { name: 'Err', unit: '%' },
          fill_rate: { name: 'Fill', unit: 'GB/s' }
        },
        traffic_routes: [
          {
            name: 'write',
            base_latency_ms: 20,
            outgoing_traffics: []
          }
        ]
      }
    ],
    traffics: [
      {
        type: 'external',
        name: 'write',
        target_component_name: 'Storage 1',
        value: 10,
        base_variance: 0
      }
    ],
    statusEffects: []
  };

  it('should increase storage usage and report fill rate', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    const storage = engine.components['storage-1'];
    expect(storage.attributes.storage_usage.current).toBe(0);

    // 10 requests * 1 GB/req = 10 GB
    engine.update();
    expect(storage.attributes.storage_usage.current).toBe(10);
    expect(storage.metrics.fill_rate.value).toBe(10);

    // 10 more requests = 20 GB total
    engine.update();
    expect(storage.attributes.storage_usage.current).toBe(20);
    expect(storage.metrics.fill_rate.value).toBe(10);
  });

  it('should fail with 100% error rate when storage is full', () => {
    const engine = new GameEngine();
    engine.loadLevel(level);

    const storage = engine.components['storage-1'];
    // Fast-forward to fill the storage (Limit 100, 10 GB/tick)
    for (let i = 0; i < 9; i++) engine.update();
    expect(storage.attributes.storage_usage.current).toBe(90);
    expect(storage.metrics.error_rate.value).toBe(0);

    // Fill it to 100 GB
    engine.update();
    expect(storage.attributes.storage_usage.current).toBe(100);
    expect(storage.metrics.error_rate.value).toBe(0); // Not yet, Pass 2 runs before Pass 1 finishes for the next tick?
    // Wait, Pass 2 uses the demand from Pass 1.
    // In StorageNode.calculateFailureRate, it uses storageAttr.utilization.
    // StorageNode.tick (where storage_usage.update is called) happens AFTER Pass 2 in GameEngine.update().

    // So if storage hits 100% in tick N, Pass 2 of tick N+1 should see 100% failure.
    engine.update();
    expect(storage.metrics.error_rate.value).toBe(100);
  });
});

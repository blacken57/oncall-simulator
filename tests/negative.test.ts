import { describe, it, expect, vi } from 'vitest';
import { ComputeNode } from '../src/lib/game/components/compute.svelte';
import { DatabaseNode } from '../src/lib/game/components/database.svelte';
import { StorageNode } from '../src/lib/game/components/storage.svelte';
import type { ComponentConfig } from '../src/lib/game/schema';

describe('Resilience / Negative Testing', () => {
  const mockHandler = {
    recordDemand: vi.fn(),
    handleTraffic: vi.fn(() => ({ successfulVolume: 100, averageLatency: 10 })),
    statusEffects: [],
    getActiveComponentEffects: vi.fn(() => []),
    getActiveTrafficEffects: vi.fn(() => [])
  };

  describe('ComputeNode Resilience', () => {
    it('should not crash when missing optional attributes (ram)', () => {
      const config: ComponentConfig = {
        id: 'c1',
        name: 'Compute',
        type: 'compute',
        attributes: {
          cpu: {
            name: 'CPU',
            unit: 'C',
            initialLimit: 4,
            minLimit: 1,
            maxLimit: 16,
            costPerUnit: 1
          }
        },
        metrics: {},
        alerts: [],
        traffic_routes: []
      };

      const node = new ComputeNode(config);
      // This should not throw even though ram is missing in config but referenced in tick()
      expect(() => node.tick(mockHandler as any)).not.toThrow();
    });

    it('should not crash when missing optional metrics (latency, error_rate, incoming)', () => {
      const config: ComponentConfig = {
        id: 'c1',
        name: 'Compute',
        type: 'compute',
        attributes: {
          cpu: {
            name: 'CPU',
            unit: 'C',
            initialLimit: 4,
            minLimit: 1,
            maxLimit: 16,
            costPerUnit: 1
          }
        },
        metrics: {}, // Empty metrics
        alerts: [],
        traffic_routes: []
      };

      const node = new ComputeNode(config);
      expect(() => node.tick(mockHandler as any)).not.toThrow();
    });

    it('should handle calculateFailureRate even if primary attribute is missing', () => {
      const config: ComponentConfig = {
        id: 'c1',
        name: 'Compute',
        type: 'compute',
        attributes: {}, // No attributes at all
        metrics: {},
        alerts: [],
        traffic_routes: []
      };

      const node = new ComputeNode(config);
      // @ts-ignore
      expect(node.calculateFailureRate(100)).toBe(0);
    });
  });

  describe('DatabaseNode Resilience', () => {
    it('should not crash when missing connections or storage', () => {
      const config: ComponentConfig = {
        id: 'd1',
        name: 'DB',
        type: 'database',
        attributes: {},
        metrics: {},
        alerts: [],
        traffic_routes: []
      };

      const node = new DatabaseNode(config);
      expect(() => node.tick(mockHandler as any)).not.toThrow();
      // @ts-ignore
      expect(node.calculateFailureRate(100)).toBe(0);
    });
  });

  describe('StorageNode Resilience', () => {
    it('should not crash when missing storage_usage', () => {
      const config: ComponentConfig = {
        id: 's1',
        name: 'Storage',
        type: 'storage',
        attributes: {},
        metrics: {},
        alerts: [],
        traffic_routes: []
      };

      const node = new StorageNode(config);
      expect(() => node.tick(mockHandler as any)).not.toThrow();
      // @ts-ignore
      expect(node.calculateFailureRate(100)).toBe(0);
    });
  });
});

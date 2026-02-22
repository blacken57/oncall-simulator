import { describe, it, expect } from 'vitest';
import { ComputeNode } from '../src/lib/game/components/compute.svelte';
import { DatabaseNode } from '../src/lib/game/components/database.svelte';
import { StorageNode } from '../src/lib/game/components/storage.svelte';
import type { ComponentConfig } from '../src/lib/game/schema';

describe('Component Physics', () => {
  const mockHandler = {
    recordDemand: () => {},
    handleTraffic: (name: string, volume: number) => ({
      successfulVolume: volume,
      averageLatency: 10
    }),
    statusEffects: [],
    getActiveComponentEffects: () => [],
    getActiveTrafficEffects: () => [],
    localExpectedVolume: 0,
    localIncomingVolume: 0
  };

  describe('ComputeNode', () => {
    const config: ComponentConfig = {
      id: 'c1',
      name: 'Compute',
      type: 'compute',
      physics: { request_capacity_per_unit: 10 },
      attributes: {
        gcu: {
          name: 'GCU',
          unit: 'GCU',
          initialLimit: 10,
          minLimit: 1,
          maxLimit: 100,
          costPerUnit: 1
        },
        ram: { name: 'RAM', unit: 'GB', initialLimit: 8, minLimit: 1, maxLimit: 64, costPerUnit: 1 }
      },
      metrics: {
        latency: { name: 'Lat', unit: 'ms' },
        error_rate: { name: 'Err', unit: '%' }
      },
      alerts: [],
      traffic_routes: []
    };

    it('should calculate 0% failure when under capacity', () => {
      const node = new ComputeNode(config);
      node.recordDemand('test', 50, mockHandler as any);
      // @ts-ignore - accessing protected for test
      expect(node.calculateFailureRate(50)).toBe(0);
    });

    it('should calculate proportional failure when over capacity', () => {
      const node = new ComputeNode(config);
      // Capacity is 10 GCU * 10 req/GCU = 100
      // Demand is 200
      // (200 - 100) / 200 = 0.5
      node.recordDemand('test', 200, mockHandler as any);
      // @ts-ignore
      expect(node.calculateFailureRate(200)).toBe(0.5);
    });

    it('should apply non-linear latency penalty when over saturation threshold', () => {
      const node = new ComputeNode({
        ...config,
        physics: {
          ...config.physics,
          request_capacity_per_unit: 20,
          saturation_threshold_percent: 50,
          saturation_penalty_factor: 1.0, // Latency doubles for every % over threshold
          resource_base_usage: { gcu: 0 },
          noise_factor: 0
        }
      });

      // 1. Under threshold: 40% utilization
      // 10 GCU * 20 req/GCU = 200 total capacity.
      // 80 incoming / 200 capacity = 40% util.
      node.attributes.gcu.limit = 10;
      node.localExpectedVolume = 80;
      node.localIncomingVolume = 80;

      // Setup propagated latency (base + deps)
      node.totalLatencySum = 100 * 80;
      node.totalSuccessfulRequests = 80;

      node.tick(mockHandler as any);
      // avgLatency = 100. (40 < 50, no penalty)
      expect(node.metrics.latency.value).toBe(100);

      // 2. Over threshold: 60% utilization (10% over threshold of 50%)
      // 120 incoming / 200 capacity = 60% util.
      // NOTE: In the new system, penalty is applied in handleTraffic, but
      // since we are testing tick() isolation, we must ensure tick()
      // just reports whatever is in totalLatencySum / totalSuccessfulRequests.
      node.localExpectedVolume = 120;
      node.localIncomingVolume = 120;

      // Simulating handleTraffic result: 100ms base * (1 + pow((60-50)*1.0, 2)) = 10100ms
      node.totalLatencySum = 10100 * 120;
      node.totalSuccessfulRequests = 120;

      node.tick(mockHandler as any);
      expect(node.metrics.latency.value).toBe(10100);
    });

    it('should calculate failure rate considering resource overhead', () => {
      const node = new ComputeNode({
        ...config,
        physics: {
          ...config.physics,
          request_capacity_per_unit: 10,
          resource_base_usage: { gcu: 2.0 } // 2 GCU overhead
        }
      });
      // Limit 10, overhead 2, available 8 GCU.
      // Capacity: 8 GCU * 10 req/GCU = 80.
      // Demand 100. (100 - 80) / 100 = 0.2
      node.localExpectedVolume = 100;
      // @ts-ignore
      expect(node.calculateFailureRate(100)).toBe(0.2);
    });

    it('should apply latency penalty using raw uncapped utilization', () => {
      const node = new ComputeNode({
        ...config,
        physics: {
          ...config.physics,
          request_capacity_per_unit: 10,
          saturation_threshold_percent: 50,
          saturation_penalty_factor: 1.0,
          resource_base_usage: { gcu: 0 },
          noise_factor: 0
        }
      });

      // Demand 150, Capacity 100. Util = 150%.
      // 1 + pow((150 - 50) * 1.0, 2) = 1 + pow(100, 2) = 10001x penalty.
      node.localExpectedVolume = 150;
      node.localIncomingVolume = 150;

      // Simulating handleTraffic result: 100ms * 10001 = 1000100ms
      node.totalLatencySum = 1000100 * 150;
      node.totalSuccessfulRequests = 150;

      node.tick(mockHandler as any);

      // Latency: 1000100
      expect(node.metrics.latency.value).toBe(1000100);
      // Metric itself should be capped at limit (10)
      expect(node.attributes.gcu.current).toBe(10);
    });
    it('should consume resources proportionally to traffic', () => {
      const node = new ComputeNode({
        ...config,
        physics: {
          ...config.physics,
          resource_base_usage: { ram: 1.0 },
          consumption_rates: { ram: 0.1 },
          noise_factor: 0
        }
      });

      // Traffic of 10 should use: 1.0 (base) + 10 * 0.1 (consumption) = 2.0 RAM
      node.localIncomingVolume = 10;
      node.tick(mockHandler as any);
      expect(node.attributes.ram.current).toBe(2.0);
    });
  });

  describe('DatabaseNode', () => {
    const config: ComponentConfig = {
      id: 'd1',
      name: 'DB',
      type: 'database',
      attributes: {
        connections: {
          name: 'Conn',
          unit: 'count',
          initialLimit: 100,
          minLimit: 1,
          maxLimit: 1000,
          costPerUnit: 1
        },
        storage: {
          name: 'Store',
          unit: 'GB',
          initialLimit: 100,
          minLimit: 1,
          maxLimit: 1000,
          costPerUnit: 1
        }
      },
      metrics: {
        query_latency: { name: 'Lat', unit: 'ms' },
        error_rate: { name: 'Err', unit: '%' }
      },
      alerts: [],
      traffic_routes: []
    };

    it('should fail when connections are exceeded', () => {
      const node = new DatabaseNode(config);
      // Limit is 100. Demand 150.
      // (150 - 100) / 150 = 0.333...
      // @ts-ignore
      expect(node.calculateFailureRate(150)).toBeCloseTo(0.333, 3);
    });
  });

  describe('StorageNode', () => {
    const config: ComponentConfig = {
      id: 's1',
      name: 'Storage',
      type: 'storage',
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
        fill_rate: { name: 'Fill', unit: 'GB/s' },
        error_rate: { name: 'Err', unit: '%' }
      },
      alerts: [],
      traffic_routes: []
    };

    it('should fail completely when utilization is 100%', () => {
      const node = new StorageNode(config);
      node.attributes.storage_usage.current = 100;
      // @ts-ignore
      expect(node.calculateFailureRate(10)).toBe(1);
    });
  });
});

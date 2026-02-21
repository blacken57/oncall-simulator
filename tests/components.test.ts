import { describe, it, expect } from 'vitest';
import { ComputeNode } from '../src/lib/game/components/compute.svelte';
import { DatabaseNode } from '../src/lib/game/components/database.svelte';
import { StorageNode } from '../src/lib/game/components/storage.svelte';
import type { ComponentConfig } from '../src/lib/game/schema';

describe('Component Physics', () => {
  const mockHandler = {
    recordDemand: () => {},
    handleTraffic: () => 100,
    statusEffects: []
  };

  describe('ComputeNode', () => {
    const config: ComponentConfig = {
      id: 'c1',
      name: 'Compute',
      type: 'compute',
      physics: { request_capacity_per_unit: 10 },
      attributes: {
        gcu: { name: 'GCU', unit: 'GCU', initialLimit: 10, minLimit: 1, maxLimit: 100, costPerUnit: 1 },
        ram: { name: 'RAM', unit: 'GB', initialLimit: 8, minLimit: 1, maxLimit: 64, costPerUnit: 1 }
      },
      metrics: {
        latency: { name: 'Lat', unit: 'ms' },
        error_rate: { name: 'Err', unit: '%' }
      },
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
  });

  describe('DatabaseNode', () => {
    const config: ComponentConfig = {
      id: 'd1',
      name: 'DB',
      type: 'database',
      attributes: {
        connections: { name: 'Conn', unit: 'count', initialLimit: 100, minLimit: 1, maxLimit: 1000, costPerUnit: 1 },
        storage: { name: 'Store', unit: 'GB', initialLimit: 100, minLimit: 1, maxLimit: 1000, costPerUnit: 1 }
      },
      metrics: {
        query_latency: { name: 'Lat', unit: 'ms' },
        error_rate: { name: 'Err', unit: '%' }
      },
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
        storage_usage: { name: 'Usage', unit: 'GB', initialLimit: 100, minLimit: 1, maxLimit: 1000, costPerUnit: 1 }
      },
      metrics: {
        fill_rate: { name: 'Fill', unit: 'GB/s' },
        error_rate: { name: 'Err', unit: '%' }
      },
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

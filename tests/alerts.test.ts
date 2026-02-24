import { describe, it, expect } from 'vitest';
import { ComputeNode } from '../src/lib/game/components/compute.svelte';
import type { ComponentConfig } from '../src/lib/game/schema';

describe('Alert Triggering Logic', () => {
  const config: ComponentConfig = {
    id: 'c1',
    name: 'Compute',
    type: 'compute',
    attributes: {
      gcu: {
        name: 'GCU',
        unit: 'GCU',
        initialLimit: 10,
        minLimit: 1,
        maxLimit: 100,
        costPerUnit: 1
      }
    },
    metrics: {
      latency: { name: 'Lat', unit: 'ms' },
      error_rate: { name: 'Err', unit: '%' }
    },
    alerts: [
      {
        name: 'High Latency',
        metric: 'latency',
        warning_threshold: 100,
        critical_threshold: 200,
        direction: 'above'
      },
      {
        name: 'Low Capacity',
        metric: 'gcu',
        warning_threshold: 20, // 20% utilization warning
        critical_threshold: 10, // 10% utilization critical? Wait, if direction is below, then < 10 is critical
        direction: 'below'
      }
    ],
    traffic_routes: []
  };

  it('should trigger "above" alerts correctly', () => {
    const node = new ComputeNode(config);
    // Initialize gcu to be healthy so it doesn't trigger "Low Capacity"
    node.attributes.gcu.current = 5;

    // Healthy
    node.metrics.latency.value = 50;
    // @ts-ignore
    node.checkAlerts();
    expect(node.status).toBe('healthy');
    expect(node.statusTriggers['High Latency']).toBeUndefined();

    // Warning
    node.metrics.latency.value = 150;
    // @ts-ignore
    node.checkAlerts();
    expect(node.status).toBe('warning');
    expect(node.statusTriggers['High Latency']).toBe('warning');

    // Critical
    node.metrics.latency.value = 250;
    // @ts-ignore
    node.checkAlerts();
    expect(node.status).toBe('critical');
    expect(node.statusTriggers['High Latency']).toBe('critical');
  });

  it('should trigger "below" alerts correctly based on utilization', () => {
    const node = new ComputeNode(config);

    // Utilization = (current / limit) * 100
    // Limit is 10.

    // Healthy: current = 5 (50% util)
    node.attributes.gcu.current = 5;
    // @ts-ignore
    node.checkAlerts();
    expect(node.status).toBe('healthy');

    // Warning: current = 1.5 (15% util)
    node.attributes.gcu.current = 1.5;
    // @ts-ignore
    node.checkAlerts();
    expect(node.status).toBe('warning');
    expect(node.statusTriggers['Low Capacity']).toBe('warning');

    // Critical: current = 0.5 (5% util)
    node.attributes.gcu.current = 0.5;
    // @ts-ignore
    node.checkAlerts();
    expect(node.status).toBe('critical');
    expect(node.statusTriggers['Low Capacity']).toBe('critical');
  });

  it('should prioritize critical status over warning when multiple alerts trigger', () => {
    const node = new ComputeNode(config);

    // High Latency (Warning: 150)
    node.metrics.latency.value = 150;
    // Low Capacity (Critical: 0.5)
    node.attributes.gcu.current = 0.5;

    // @ts-ignore
    node.checkAlerts();
    expect(node.status).toBe('critical');
    expect(node.statusTriggers['High Latency']).toBe('warning');
    expect(node.statusTriggers['Low Capacity']).toBe('critical');
  });
});

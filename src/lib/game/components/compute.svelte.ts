import type { ComponentPhysicsConfig } from '../schema';
import { SystemComponent, type TrafficHandler } from './base.svelte';

/**
 * Specialized Component: Compute Node
 */
export class ComputeNode extends SystemComponent {
  type = 'compute';

  protected getDefaultPhysics(): ComponentPhysicsConfig {
    return {
      request_capacity_per_unit: 20,
      latency_base_ms: 50,
      latency_load_factor: 0,
      saturation_threshold_percent: 80,
      saturation_penalty_factor: 0.1,
      resource_base_usage: {
        ram: 1.2
      },
      consumption_rates: {
        ram: 0.005
      },
      noise_factor: 0.5
    };
  }

  protected calculateFailureRate(totalDemand: number): number {
    const primaryAttr = this.attributes.gcu || this.attributes.cpu;
    if (!primaryAttr) return 0;

    const physics = this.physics;
    const resourceBase = physics.resource_base_usage?.gcu ?? physics.resource_base_usage?.cpu ?? 0;
    const capPerUnit = physics.request_capacity_per_unit ?? 20;

    // Actual capacity is limit minus overhead, multiplied by throughput per unit
    const availableResource = Math.max(0, primaryAttr.limit - resourceBase);
    const capacity = availableResource * capPerUnit;

    // Use localExpectedVolume for capacity checks
    if (this.localExpectedVolume > capacity) {
      return (this.localExpectedVolume - capacity) / this.localExpectedVolume;
    }
    return 0;
  }

  protected calculateLocalLatency(baseLatency: number, volume: number): number {
    let localLat = baseLatency;

    // Apply local load factor (per-request latency increase)
    const physics = this.physics;
    const loadFactor = physics.latency_load_factor ?? 0;
    localLat += volume * loadFactor;

    // Apply local saturation penalty based on Pass 1 demand
    const resourceBase = physics.resource_base_usage?.gcu ?? physics.resource_base_usage?.cpu ?? 0;
    const capPerUnit = physics.request_capacity_per_unit ?? 20;
    const demand = this.localExpectedVolume;
    const calculatedValue = resourceBase + demand / capPerUnit;
    const rawUtilization =
      (calculatedValue / (this.attributes.cpu?.limit || this.attributes.gcu?.limit || 1)) * 100;

    const satThreshold = physics.saturation_threshold_percent ?? 80;
    if (rawUtilization > satThreshold) {
      // Non-linear penalty: spikes more aggressively as utilization increases.
      // We use a power of 2 to make it feel more like a real queuing bottleneck.
      const factor = (rawUtilization - satThreshold) * (physics.saturation_penalty_factor ?? 0.1);
      const penalty = Math.min(1 + Math.pow(factor, 2), 100);
      localLat *= penalty;
    }

    return localLat;
  }
  protected override updateResourceMetrics(_handler: TrafficHandler): void {
    const traffic = this.incomingTrafficVolume;
    const physics = this.physics;
    const noiseFactor = physics.noise_factor ?? 0.5;
    const noise = (Math.random() - 0.5) * 2 * noiseFactor;

    // Resource Usage (GCU/CPU)
    const primaryAttr = this.attributes.gcu || this.attributes.cpu;

    if (primaryAttr) {
      const capPerUnit = physics.request_capacity_per_unit ?? 20;
      const resourceBase =
        physics.resource_base_usage?.gcu ?? physics.resource_base_usage?.cpu ?? 0;

      // Uncapped value for physics calculations
      const calculatedValue =
        resourceBase + traffic / capPerUnit + (Math.random() - 0.5) * 2 * noiseFactor;

      // Cap at limit only for the attribute storage (UI)
      primaryAttr.update(Math.min(primaryAttr.limit, calculatedValue));
    }

    // RAM Usage
    if (this.attributes.ram) {
      const ramBase = physics.resource_base_usage?.ram ?? 0;
      const ramUsagePerReq = physics.consumption_rates?.ram ?? 0;
      this.attributes.ram.update(ramBase + traffic * ramUsagePerReq + noise * 0.5);
    }
  }
}

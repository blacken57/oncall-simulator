import type { ComponentPhysicsConfig } from '../schema';
import { SystemComponent, type TrafficHandler } from './base.svelte';

/**
 * Specialized Component: Database Node
 */
export class DatabaseNode extends SystemComponent {
  type = 'database';

  protected getDefaultPhysics(): ComponentPhysicsConfig {
    return {
      request_capacity_per_unit: 1, // 1 connection = 1 request
      latency_base_ms: 10,
      latency_load_factor: 0.2,
      saturation_threshold_percent: 90,
      saturation_penalty_factor: 4, // Sharp latency spike
      consumption_rates: {
        storage: 0.0001
      },
      noise_factor: 2
    };
  }

  protected calculateFailureRate(totalDemand: number): number {
    const connAttr = this.attributes.connections;
    if (!connAttr) return 0;

    const limit = connAttr.limit;
    if (totalDemand > limit) {
      return (totalDemand - limit) / totalDemand;
    }
    return 0;
  }

  /**
   * Applies local Database physics: connection saturation.
   */
  protected calculateLocalLatency(baseLatency: number, volume: number): number {
    let localLat = baseLatency;

    // Apply local load factor (per-request latency increase)
    const physics = this.physics;
    const loadFactor = physics.latency_load_factor ?? 0;
    localLat += volume * loadFactor;

    const connAttr = this.attributes.connections;
    if (connAttr) {
      // Use current demand (Pass 1 volume) for saturation check
      const demand = this.totalExpectedVolume;
      const util = (demand / connAttr.limit) * 100;
      const satThreshold = this.physics.saturation_threshold_percent ?? 90;

      if (util > satThreshold) {
        localLat *= 1 + (this.physics.saturation_penalty_factor ?? 4);
      }
    }
    return localLat;
  }

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    const physics = this.physics;
    const noiseFactor = physics.noise_factor ?? 2;

    // Connections update
    if (this.attributes.connections) {
      this.attributes.connections.update(traffic + Math.random() * noiseFactor);
    }

    if (this.attributes.storage) {
      const growth = traffic * (physics.consumption_rates?.storage ?? 0.0001);
      this.attributes.storage.update(
        Math.min(this.attributes.storage.limit, this.attributes.storage.current + growth)
      );
    }

    super.tick(handler);
  }
}

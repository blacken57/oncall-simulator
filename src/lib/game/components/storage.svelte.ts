import type { ComponentPhysicsConfig } from '../schema';
import { SystemComponent, type TrafficHandler } from './base.svelte';

/**
 * Specialized Component: Storage Node
 */
export class StorageNode extends SystemComponent {
  type = 'storage';

  protected getDefaultPhysics(): ComponentPhysicsConfig {
    return {
      consumption_rates: {
        storage_usage: 0.05
      },
      saturation_threshold_percent: 100
    };
  }

  protected calculateFailureRate(totalDemand: number): number {
    const storageAttr = this.attributes.storage_usage;
    if (!storageAttr) return 0;

    const util = storageAttr.utilization;
    if (util >= 100) return 1; // Total failure
    return 0;
  }

  protected override updateResourceMetrics(_handler: TrafficHandler): void {
    const traffic = this.incomingTrafficVolume;
    const physics = this.physics;

    if (this.attributes.storage_usage) {
      const growth = traffic * (physics.consumption_rates?.storage_usage ?? 0.05);
      this.attributes.storage_usage.growBy(growth);
      if (this.metrics.fill_rate) {
        this.metrics.fill_rate.update(growth);
      }
    }
  }
}

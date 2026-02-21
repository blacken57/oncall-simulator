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
      saturation_threshold_percent: 100,
      status_thresholds: {
        storage_util: { warning: 85, critical: 100 },
        error_rate: { warning: 1, critical: 5 }
      }
    };
  }

  protected calculateFailureRate(totalDemand: number): number {
    const util = this.attributes.storage_usage.utilization;
    if (util >= 100) return 1; // Total failure
    return 0;
  }

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    const physics = this.physics;

    const growth = traffic * (physics.consumption_rates?.storage_usage ?? 0.05);
    this.attributes.storage_usage.update(Math.min(
      this.attributes.storage_usage.limit,
      this.attributes.storage_usage.current + growth
    ));

    this.metrics.fill_rate.update(growth);

    if (this.metrics.error_rate) {
      const errorRate = traffic > 0 ? (this.unsuccessfulTrafficVolume / traffic) * 100 : 0;
      this.metrics.error_rate.update(errorRate);
    }

    if (this.metrics.incoming) {
      this.metrics.incoming.update(traffic);
    }

    this.updateStatus();

    this.incomingTrafficVolume = 0;
    this.unsuccessfulTrafficVolume = 0;
  }

  private updateStatus() {
    const util = this.attributes.storage_usage.utilization;
    const errorRate = this.metrics.error_rate?.value ?? 0;
    const thresholds = this.physics.status_thresholds || {};

    const utilT = thresholds.storage_util || { warning: 85, critical: 100 };
    const errT = thresholds.error_rate || { warning: 1, critical: 5 };

    if (util >= utilT.critical || errorRate > errT.critical) this.status = 'critical';
    else if (util > utilT.warning || errorRate > errT.warning) this.status = 'warning';
    else this.status = 'healthy';
  }
}

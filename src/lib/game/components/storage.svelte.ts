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

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    const physics = this.physics;

    if (this.attributes.storage_usage) {
      const growth = traffic * (physics.consumption_rates?.storage_usage ?? 0.05);
      this.attributes.storage_usage.update(
        Math.min(
          this.attributes.storage_usage.limit,
          this.attributes.storage_usage.current + growth
        )
      );
      if (this.metrics.fill_rate) {
        this.metrics.fill_rate.update(growth);
      }
    }

    if (this.metrics.error_rate) {
      const baseFailureRate = traffic > 0 ? (this.unsuccessfulTrafficVolume / traffic) * 100 : 0;

      // Apply error_rate status effects
      let errMultSum = 0;
      let errOffsetSum = 0;
      const errEffects = this.getActiveComponentEffects(handler).filter(
        (e) => e.metricAffected === 'error_rate'
      );
      for (const e of errEffects) {
        errMultSum += e.multiplier;
        errOffsetSum += e.offset;
      }
      const errorRate = baseFailureRate + baseFailureRate * errMultSum + errOffsetSum;

      this.metrics.error_rate.update(errorRate);
    }

    if (this.metrics.incoming) {
      this.metrics.incoming.update(traffic);
    }

    // Aggregate latency from all routes, including dependencies
    const avgLatency = this.propagatedLatency;

    if (this.metrics.latency) {
      this.metrics.latency.update(avgLatency);
    }

    this.checkAlerts();
  }
}

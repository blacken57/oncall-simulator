import type { ComponentPhysicsConfig } from '../schema';
import type { ComponentStatusEffect } from '../statusEffects.svelte';
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
      latency_load_factor: 0.2,
      saturation_threshold_percent: 80,
      saturation_penalty_factor: 0.1,
      resource_base_usage: {
        ram: 1.2
      },
      consumption_rates: {
        ram: 0.005
      },
      noise_factor: 0.5,
      status_thresholds: {
        gcu_util: { warning: 80, critical: 95 },
        error_rate: { warning: 1, critical: 5 }
      }
    };
  }

  protected calculateFailureRate(totalDemand: number): number {
    const capacity = this.attributes.gcu.limit * (this.physics.request_capacity_per_unit ?? 20);
    if (totalDemand > capacity) {
      return (totalDemand - capacity) / totalDemand;
    }
    return 0;
  }

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    const physics = this.physics;
    const noise = (Math.random() - 0.5) * (physics.noise_factor ?? 0);

    // GCU Usage
    const capPerUnit = physics.request_capacity_per_unit ?? 20;
    const gcuBase = physics.resource_base_usage?.gcu ?? 0;
    this.attributes.gcu.update(
      gcuBase + traffic / capPerUnit + Math.random() * (physics.noise_factor ?? 0.5)
    );

    // RAM Usage
    const ramBase = physics.resource_base_usage?.ram ?? 0;
    const ramUsagePerReq = physics.consumption_rates?.ram ?? 0;
    this.attributes.ram.update(ramBase + traffic * ramUsagePerReq + noise * 0.2);

    const util = this.attributes.gcu.utilization;

    // Aggregate latency from all routes processed this tick
    let avgLatency =
      this.totalSuccessfulRequests > 0 ? this.totalLatencySum / this.totalSuccessfulRequests : 0;

    // Apply utilization-based penalty to the final average
    const satThreshold = physics.saturation_threshold_percent ?? 80;
    if (util > satThreshold) {
      avgLatency *= 1 + (util - satThreshold) * (physics.saturation_penalty_factor ?? 0.1);
    }

    // Apply status effect multipliers: (1 + sum(multipliers)) * base_value + sum(offsets)
    let multiplierSum = 0;
    let offsetSum = 0;
    const activeEffects = handler.statusEffects.filter(
      (e: any) =>
        e.type === 'component' &&
        e.isActive &&
        e.componentAffected === this.id &&
        e.metricAffected === 'latency'
    ) as ComponentStatusEffect[];
    for (const e of activeEffects) {
      multiplierSum += e.multiplier;
      offsetSum += e.offset;
    }
    avgLatency = avgLatency + avgLatency * multiplierSum + offsetSum;

    this.metrics.latency.update(avgLatency);

    // Calculate Error Rate: (failed traffic / total traffic) * 100
    const baseFailureRate = traffic > 0 ? (this.unsuccessfulTrafficVolume / traffic) * 100 : 0;

    // Apply error_rate status effects
    let errMultSum = 0;
    let errOffsetSum = 0;
    const errEffects = handler.statusEffects.filter(
      (e: any) =>
        e.type === 'component' &&
        e.isActive &&
        e.componentAffected === this.id &&
        e.metricAffected === 'error_rate'
    ) as ComponentStatusEffect[];
    for (const e of errEffects) {
      errMultSum += e.multiplier;
      errOffsetSum += e.offset;
    }
    const errorRate = baseFailureRate + baseFailureRate * errMultSum + errOffsetSum;

    this.metrics.error_rate.update(errorRate);

    if (this.metrics.incoming) {
      this.metrics.incoming.update(traffic);
    }

    this.updateStatus();
    this.incomingTrafficVolume = 0; // Reset for next tick
    this.unsuccessfulTrafficVolume = 0;
  }

  private updateStatus() {
    const gcuUtil = this.attributes.gcu.utilization;
    const errorRate = this.metrics.error_rate.value;
    const thresholds = this.physics.status_thresholds || {};

    const gcuT = thresholds.gcu_util || { warning: 80, critical: 95 };
    const errT = thresholds.error_rate || { warning: 1, critical: 5 };

    if (gcuUtil > gcuT.critical || errorRate > errT.critical) this.status = 'critical';
    else if (gcuUtil > gcuT.warning || errorRate > errT.warning) this.status = 'warning';
    else this.status = 'healthy';
  }
}

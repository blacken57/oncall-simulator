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
      noise_factor: 2,
      status_thresholds: {
        conn_util: { warning: 80, critical: 100 },
        error_rate: { warning: 1, critical: 5 }
      }
    };
  }

  protected calculateFailureRate(totalDemand: number): number {
    const limit = this.attributes.connections.limit;
    if (totalDemand > limit) {
      return (totalDemand - limit) / totalDemand;
    }
    return 0;
  }

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    const physics = this.physics;

    // Connections update
    this.attributes.connections.update(traffic + Math.random() * (physics.noise_factor ?? 2));

    const growth = traffic * (physics.consumption_rates?.storage ?? 0.0001);
    this.attributes.storage.update(
      Math.min(this.attributes.storage.limit, this.attributes.storage.current + growth)
    );

    const connUtil = this.attributes.connections.utilization;

    // Aggregate latency from all routes
    let avgLatency =
      this.totalSuccessfulRequests > 0 ? this.totalLatencySum / this.totalSuccessfulRequests : 0;

    const satThreshold = physics.saturation_threshold_percent ?? 90;
    if (connUtil > satThreshold) {
      avgLatency *= 1 + (physics.saturation_penalty_factor ?? 4);
    }

    this.metrics.query_latency.update(avgLatency);

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
    const connUtil = this.attributes.connections.utilization;
    const errorRate = this.metrics.error_rate?.value ?? 0;
    const thresholds = this.physics.status_thresholds || {};

    const connT = thresholds.conn_util || { warning: 80, critical: 100 };
    const errT = thresholds.error_rate || { warning: 1, critical: 5 };

    if (connUtil > connT.critical || errorRate > errT.critical) this.status = 'critical';
    else if (connUtil > connT.warning || errorRate > errT.warning) this.status = 'warning';
    else this.status = 'healthy';
  }
}

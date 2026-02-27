import type { ComponentPhysicsConfig } from '../schema';
import { SystemComponent, type TrafficHandler } from './base.svelte';

/**
 * Specialized Component: External API Node
 *
 * Models third-party API calls (Stripe, Twilio, etc.) with:
 * - Hard quota throttling: traffic above `quota_rps.limit` is dropped proportionally
 * - Fixed per-call latency from route `base_latency_ms` (not load-dependent)
 * - StatusEffect-driven latency and error_rate modifiers (applied by base class)
 */
export class ExternalAPINode extends SystemComponent {
  type = 'external_api';

  protected getDefaultPhysics(): ComponentPhysicsConfig {
    return {
      latency_base_ms: 200,
      noise_factor: 10
    };
  }

  // Hard quota throttling — above quota, excess traffic is dropped proportionally.
  // Uses localExpectedVolume (always equals totalDemand for leaf nodes).
  protected calculateFailureRate(_totalDemand: number): number {
    const quotaAttr = this.attributes.quota_rps;
    if (!quotaAttr || quotaAttr.limit === 0) return 0;

    const demand = this.localExpectedVolume;
    if (demand > quotaAttr.limit) {
      return (demand - quotaAttr.limit) / demand;
    }
    return 0;
  }

  // Fixed latency + jitter. Volume has no effect; only the route's base_latency_ms matters.
  protected calculateLocalLatency(baseLatency: number, _volume: number): number {
    const noiseFactor = this.physics.noise_factor ?? 10;
    const noise = (Math.random() - 0.5) * noiseFactor * 2;
    return Math.max(0, baseLatency + noise);
  }

  // Track quota_rps utilization: current = min(incoming, limit).
  protected override updateResourceMetrics(_handler: TrafficHandler): void {
    const quotaAttr = this.attributes.quota_rps;
    if (quotaAttr) {
      quotaAttr.update(Math.min(this.incomingTrafficVolume, quotaAttr.limit));
    }
  }

  // Extend base to also record success/failures metrics if defined.
  protected override updateStandardMetrics(handler: TrafficHandler): void {
    super.updateStandardMetrics(handler);
    if (this.metrics.success) {
      this.metrics.success.update(this.totalSuccessfulRequests);
    }
    if (this.metrics.failures) {
      this.metrics.failures.update(this.unsuccessfulTrafficVolume);
    }
  }
}

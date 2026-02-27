import {
  ComponentStatusEffect,
  TrafficStatusEffect,
  type StatusEffect
} from '../statusEffects.svelte';
import type {
  ComponentConfig,
  TrafficRouteConfig,
  ComponentPhysicsConfig,
  AlertConfig
} from '../schema';
import { Attribute, Metric, applyEffects } from '../base.svelte';

/**
 * Interface to avoid circular dependency with GameEngine
 */
export interface TrafficHandler {
  recordDemand(trafficName: string, value: number): void;
  handleTraffic(
    trafficName: string,
    value: number
  ): { successfulVolume: number; averageLatency: number };
  statusEffects: StatusEffect[];
  components: Record<string, SystemComponent>;
  getActiveComponentEffects(componentId: string): ComponentStatusEffect[];
  getActiveTrafficEffects(trafficId: string): TrafficStatusEffect[];
}

/**
 * The base class for all simulated infrastructure components.
 *
 * DESIGN PRINCIPLE: Two-Pass Resolution
 * To ensure fair traffic distribution, components use two passes:
 * 1. Demand Pass: recordDemand() collects total intended volume from all sources recursively.
 * 2. Resolution Pass: handleTraffic() uses the total demand to calculate a fair failure rate
 *    applied proportionally to all incoming flows, preventing "first-come-first-served" bias.
 */
export abstract class SystemComponent {
  id: string;
  name: string;
  abstract type: string;

  attributes = $state<Record<string, Attribute>>({});
  metrics = $state<Record<string, Metric>>({});
  status = $state<'healthy' | 'warning' | 'critical'>('healthy');
  statusTriggers = $state<Record<string, 'warning' | 'critical'>>({});
  alerts: AlertConfig[] = [];

  /** Configuration for how traffic flows through and out of this component */
  trafficRoutes: TrafficRouteConfig[] = [];

  /** Physics constants for this component's behavior */
  physics: ComponentPhysicsConfig;

  // Temporary state for the current tick
  totalExpectedVolume = 0;
  /**
   * `localExpectedVolume` tracks demand arriving directly at this component (before fan-out
   * to dependencies), while `totalExpectedVolume` would include any forwarded demand.
   * For most components these are equal because `recordDemand()` increments both and then
   * propagates demand downstream via `handler.recordDemand()`.
   * `QueueNode` overrides `recordDemand()` to stop forwarding (it is a decoupling boundary),
   * so both fields remain equal at the queue itself — but the downstream consumer never
   * receives forwarded demand through the normal chain (only through `preTick()`).
   */
  localExpectedVolume = 0;
  incomingTrafficVolume = 0;
  unsuccessfulTrafficVolume = 0;
  totalLatencySum = 0;
  totalSuccessfulRequests = 0;

  /**
   * The average latency across all requests handled in this tick,
   * including propagated latency from dependencies.
   */
  get propagatedLatency(): number {
    return this.totalSuccessfulRequests > 0
      ? this.totalLatencySum / this.totalSuccessfulRequests
      : 0;
  }

  constructor(config: ComponentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.trafficRoutes = config.traffic_routes;
    this.alerts = config.alerts || [];

    // Merge provided physics with subclass defaults
    this.physics = { ...this.getDefaultPhysics(), ...(config.physics || {}) };

    for (const [key, attrConfig] of Object.entries(config.attributes)) {
      this.attributes[key] = new Attribute(attrConfig);
    }

    for (const [key, metricConfig] of Object.entries(config.metrics)) {
      this.metrics[key] = new Metric(metricConfig);
    }
  }

  private checkThreshold(value: number, threshold: number, dir: 'above' | 'below'): boolean {
    return dir === 'above' ? value >= threshold : value <= threshold;
  }

  /**
   * Evaluates all alerts and updates component status and triggers.
   * Called from evaluateAlerts() after addCustomStatusTriggers(), so statusTriggers
   * may already contain custom entries — they are preserved and included in status derivation.
   */
  protected checkAlerts() {
    // Initialise newStatus from any custom triggers already set by addCustomStatusTriggers()
    let newStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    for (const severity of Object.values(this.statusTriggers)) {
      if (severity === 'critical') {
        newStatus = 'critical';
        break;
      }
      if (severity === 'warning') newStatus = 'warning';
    }

    for (const alert of this.alerts) {
      let value = 0;
      // Get value from metrics or attributes
      if (this.metrics[alert.metric]) {
        value = this.metrics[alert.metric].value;
      } else if (this.attributes[alert.metric]) {
        // For attributes, we usually care about utilization (0-100)
        value = this.attributes[alert.metric].utilization;
      } else {
        continue;
      }

      if (this.checkThreshold(value, alert.critical_threshold, alert.direction)) {
        this.statusTriggers[alert.name] = 'critical';
        newStatus = 'critical';
      } else {
        if (this.checkThreshold(value, alert.warning_threshold, alert.direction)) {
          if (newStatus !== 'critical') newStatus = 'warning';
          this.statusTriggers[alert.name] = 'warning';
        }
      }
    }

    this.status = newStatus;
  }

  /**
   * Subclasses must provide default physics constants.
   */
  protected abstract getDefaultPhysics(): ComponentPhysicsConfig;

  /**
   * Hook for active components to register their own demand before Pass 1.
   */
  preTick(handler: TrafficHandler) {}

  /**
   * Hook for active components to push internal traffic after Pass 2.
   */
  processPush(handler: TrafficHandler) {}

  /**
   * Pass 1: Records the intended traffic volume to calculate total demand.
   * This builds a global view of load before any success/failure is decided.
   */
  recordDemand(trafficName: string, value: number, handler: TrafficHandler) {
    this.totalExpectedVolume += value;
    this.localExpectedVolume += value;
    const route = this.trafficRoutes.find((r) => r.name === trafficName);

    if (route && value > 0) {
      for (const outgoing of route.outgoing_traffics) {
        handler.recordDemand(outgoing.name, value * outgoing.multiplier);
      }
    }
  }

  /**
   * Pass 2: Processes a specific traffic flow through this component.
   * Uses the pre-calculated totalExpectedVolume to ensure failures are distributed evenly.
   * @returns successfulVolume and averageLatency
   */
  handleTraffic(
    trafficName: string,
    value: number,
    handler: TrafficHandler
  ): { successfulVolume: number; averageLatency: number } {
    this.incomingTrafficVolume += value;

    // Calculate global failure rate for this tick based on total demand
    const failureRate = this.calculateFailureRate(this.totalExpectedVolume);
    let successfulVolume = value * (1 - failureRate);

    const route = this.trafficRoutes.find((r) => r.name === trafficName);
    let totalDependencyLatency = 0;

    // 1. Process outgoing traffic dependencies sequentially
    if (route && successfulVolume > 0) {
      for (const outgoing of route.outgoing_traffics) {
        // Only pass what hasn't already failed upstream in the chain
        const subResult = handler.handleTraffic(
          outgoing.name,
          successfulVolume * outgoing.multiplier
        );

        // Scale success back to parent requests (conservative floor)
        const parentEquivalentSuccess = Math.floor(
          subResult.successfulVolume / outgoing.multiplier
        );
        successfulVolume = Math.min(successfulVolume, parentEquivalentSuccess);

        // Add to total dependency latency
        totalDependencyLatency += outgoing.multiplier * subResult.averageLatency;

        if (successfulVolume <= 0) break; // Short-circuit
      }
    }

    const failed = value - successfulVolume;
    this.unsuccessfulTrafficVolume += failed;

    const baseLatency = route?.base_latency_ms ?? 0;

    // 2. Apply local physics (Load Factor, Saturation) via subclass hook
    let localLatency = this.calculateLocalLatency(baseLatency, value);

    // 3. Apply localized status effects (Multipliers/Offsets)
    localLatency = this.applyLatencyEffects(localLatency, handler);

    // 4. Final latency is local + dependencies
    const finalLatency = localLatency + totalDependencyLatency; // Track aggregate latency for this component's metrics
    if (successfulVolume > 0) {
      this.totalLatencySum += finalLatency * successfulVolume;
      this.totalSuccessfulRequests += successfulVolume;
    }

    return { successfulVolume, averageLatency: finalLatency };
  }

  /**
   * Hook for subclasses to apply local latency physics (like load factors or saturation penalties).
   * Default implementation just returns the base latency.
   */
  protected calculateLocalLatency(baseLatency: number, volume: number): number {
    return baseLatency;
  }

  /**
   * Applies active status effect multipliers and offsets to a latency value.
   */
  protected applyLatencyEffects(baseLatency: number, handler: TrafficHandler): number {
    const activeEffects = handler
      .getActiveComponentEffects(this.id)
      .filter((e) => e.metricAffected === 'latency' || e.metricAffected === 'query_latency');
    return applyEffects(baseLatency, activeEffects);
  }

  /**
   * Subclasses should implement this to define a failure rate (0-1) based on total demand.
   */
  protected abstract calculateFailureRate(totalDemand: number): number;

  /**
   * Resets tick-based accumulators.
   */
  resetTick() {
    this.totalExpectedVolume = 0;
    this.localExpectedVolume = 0;
    this.incomingTrafficVolume = 0;
    this.unsuccessfulTrafficVolume = 0;
    this.totalLatencySum = 0;
    this.totalSuccessfulRequests = 0;
  }

  /**
   * Updates component internal state (utilization, etc.) based on total traffic seen this tick.
   * Runs three phases in order: resource metrics → standard metrics → alert evaluation.
   */
  tick(handler: TrafficHandler): void {
    this.updateResourceMetrics(handler);
    this.updateStandardMetrics(handler);
    this.evaluateAlerts();
  }

  /**
   * Phase 1: Subclass-specific resource/attribute updates (CPU, RAM, storage, etc.).
   * Default is a no-op; subclasses override this instead of overriding tick().
   */
  protected updateResourceMetrics(_handler: TrafficHandler): void {}

  /**
   * Phase 2: Update standard observability metrics (latency, error_rate, incoming).
   * Subclasses may override to replace or extend with component-specific metrics.
   */
  protected updateStandardMetrics(handler: TrafficHandler): void {
    const avgLatency = this.propagatedLatency;

    if (this.metrics.latency) {
      this.metrics.latency.update(avgLatency);
    } else if (this.metrics.query_latency) {
      this.metrics.query_latency.update(avgLatency);
    }

    if (this.metrics.error_rate) {
      const traffic = this.incomingTrafficVolume;
      const baseFailureRate = traffic > 0 ? (this.unsuccessfulTrafficVolume / traffic) * 100 : 0;
      const errEffects = this.getActiveComponentEffects(handler).filter(
        (e) => e.metricAffected === 'error_rate'
      );
      this.metrics.error_rate.update(applyEffects(baseFailureRate, errEffects));
    }

    if (this.metrics.incoming) {
      this.metrics.incoming.update(this.incomingTrafficVolume);
    }
  }

  /**
   * Phase 3: Reset triggers, let subclasses inject synthetic ones, then evaluate alert configs.
   */
  protected evaluateAlerts(): void {
    this.statusTriggers = {};
    this.addCustomStatusTriggers();
    this.checkAlerts();
  }

  /**
   * Hook called before checkAlerts() so subclasses can inject synthetic status triggers
   * (e.g. QueueNode's fill-rate and near-full conditions) without reimplementing alert logic.
   */
  protected addCustomStatusTriggers(): void {}

  protected getActiveComponentEffects(handler: TrafficHandler) {
    return handler.getActiveComponentEffects(this.id);
  }

  get totalCost() {
    return Object.values(this.attributes).reduce((sum, attr) => sum + attr.cost, 0);
  }
}

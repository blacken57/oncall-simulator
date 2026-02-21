import type { StatusEffect } from '../statusEffects.svelte';
import type { ComponentConfig, TrafficRouteConfig, ComponentPhysicsConfig } from '../schema';
import { Attribute, Metric } from '../base.svelte';

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

  /** Configuration for how traffic flows through and out of this component */
  trafficRoutes: TrafficRouteConfig[] = [];

  /** Physics constants for this component's behavior */
  physics: ComponentPhysicsConfig;

  // Temporary state for the current tick
  totalExpectedVolume = 0;
  incomingTrafficVolume = 0;
  unsuccessfulTrafficVolume = 0;
  totalLatencySum = 0;
  totalSuccessfulRequests = 0;

  constructor(config: ComponentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.trafficRoutes = config.traffic_routes;

    // Merge provided physics with subclass defaults
    this.physics = { ...this.getDefaultPhysics(), ...(config.physics || {}) };

    for (const [key, attrConfig] of Object.entries(config.attributes)) {
      this.attributes[key] = new Attribute(attrConfig);
    }

    for (const [key, metricConfig] of Object.entries(config.metrics)) {
      this.metrics[key] = new Metric(metricConfig);
    }
  }

  /**
   * Subclasses must provide default physics constants.
   */
  protected abstract getDefaultPhysics(): ComponentPhysicsConfig;

  /**
   * Pass 1: Records the intended traffic volume to calculate total demand.
   * This builds a global view of load before any success/failure is decided.
   */
  recordDemand(trafficName: string, value: number, handler: TrafficHandler) {
    this.totalExpectedVolume += value;
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
        const parentEquivalentSuccess = Math.floor(subResult.successfulVolume / outgoing.multiplier);
        successfulVolume = Math.min(successfulVolume, parentEquivalentSuccess);

        // Add to total dependency latency
        totalDependencyLatency += outgoing.multiplier * subResult.averageLatency;

        if (successfulVolume <= 0) break; // Short-circuit
      }
    }

    const failed = value - successfulVolume;
    this.unsuccessfulTrafficVolume += failed;

    const baseLatency = route?.base_latency_ms ?? 0;
    const finalLatency = baseLatency + totalDependencyLatency;

    // Track aggregate latency for this component's metrics
    if (successfulVolume > 0) {
      this.totalLatencySum += finalLatency * successfulVolume;
      this.totalSuccessfulRequests += successfulVolume;
    }

    return { successfulVolume, averageLatency: finalLatency };
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
    this.incomingTrafficVolume = 0;
    this.unsuccessfulTrafficVolume = 0;
    this.totalLatencySum = 0;
    this.totalSuccessfulRequests = 0;
  }

  /**
   * Updates component internal state (utilization, etc.) based on total traffic seen this tick.
   */
  abstract tick(handler: TrafficHandler): void;

  get totalCost() {
    return Object.values(this.attributes).reduce((sum, attr) => sum + attr.cost, 0);
  }
}

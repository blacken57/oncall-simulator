import type { StatusEffect } from '../statusEffects.svelte';
import type { 
  ComponentConfig, 
  TrafficRouteConfig, 
  ComponentPhysicsConfig
} from '../schema';
import { Attribute, Metric } from '../base.svelte';

/**
 * Interface to avoid circular dependency with GameEngine
 */
export interface TrafficHandler {
  handleTraffic(trafficName: string, value: number): number;
  statusEffects: StatusEffect[];
}

/**
 * The base class for all simulated infrastructure components.
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
  incomingTrafficVolume = 0;
  unsuccessfulTrafficVolume = 0;

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
     * Processes a specific traffic flow through this component.
     * @returns successfulCalls
     */
    handleTraffic(trafficName: string, value: number, handler: TrafficHandler): number {
      this.incomingTrafficVolume += value;
      
      let successfulVolume = value;
      const route = this.trafficRoutes.find(r => r.name === trafficName);
      
      // 1. Process outgoing traffic dependencies sequentially
      if (route && value > 0) {
        for (const outgoing of route.outgoing_traffics) {
          // Only pass what hasn't already failed upstream in the chain
          const subSuccess = handler.handleTraffic(outgoing.name, successfulVolume * outgoing.multiplier);
          
          // Scale success back to parent requests (conservative floor)
          const parentEquivalentSuccess = Math.floor(subSuccess / outgoing.multiplier);
          successfulVolume = Math.min(successfulVolume, parentEquivalentSuccess);
          
          if (successfulVolume <= 0) break; // Short-circuit: nothing left to process
        }
      }
  
      // 2. Add internal failures (e.g. saturation)
      const internalFails = this.calculateInternalFailures(successfulVolume);
      successfulVolume = Math.max(0, successfulVolume - internalFails);
      
      const failed = value - successfulVolume;
      this.unsuccessfulTrafficVolume += failed;
  
      return successfulVolume;
    }

  /**
   * Subclasses should implement this to define failure logic based on utilization.
   */
  protected abstract calculateInternalFailures(value: number): number;

  /** 
   * Updates component internal state (utilization, etc.) based on total traffic seen this tick.
   */
  abstract tick(handler: TrafficHandler): void;

  get totalCost() {
    return Object.values(this.attributes).reduce((sum, attr) => sum + attr.cost, 0);
  }
}

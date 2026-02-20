import type { ComponentStatusEffect, TrafficStatusEffect, StatusEffect } from './statusEffects.svelte';
import type { 
  AttributeConfig, 
  MetricConfig, 
  ComponentConfig, 
  TrafficConfig, 
  TrafficRouteConfig, 
  OutgoingTrafficConfig 
} from './schema';

/**
 * Interface to avoid circular dependency with GameEngine
 */
export interface TrafficHandler {
  handleTraffic(trafficName: string, value: number): number;
  statusEffects: StatusEffect[];
}

/**
 * Represents a specific flow of traffic within the system.
 */
export class Traffic {
  id: string; // The unique readable id (name)
  type: 'internal' | 'external';
  targetComponentName: string;
  value = $state(0); // Base value (drifts with noise)
  actualValue = $state(0); // Actual volume processed (after multipliers)
  baseVariance: number;
  
  // History for tracking performance over time
  successHistory = $state<number[]>([]);
  failureHistory = $state<number[]>([]);
  maxHistory = 60;

  constructor(config: TrafficConfig) {
    this.id = config.name;
    this.type = config.type;
    this.targetComponentName = config.target_component_name;
    this.value = config.value || 0;
    this.baseVariance = config.base_variance ?? 5;
  }

  update(baseValue: number, actualValue: number, successful: number, unsuccessful: number) {
    this.value = baseValue;
    this.actualValue = actualValue;
    this.successHistory = [...this.successHistory, successful].slice(-this.maxHistory);
    this.failureHistory = [...this.failureHistory, unsuccessful].slice(-this.maxHistory);
  }
}

/**
 * Represents a configurable property of a system (e.g., RAM Limit vs RAM Usage).
 */
export class Attribute {
  name: string;
  unit: string;
  limit = $state(0);
  current = $state(0);
  history = $state<number[]>([]);
  maxHistory: number;
  minLimit: number;
  maxLimit: number;
  costPerUnit: number;

  constructor(config: AttributeConfig) {
    this.name = config.name;
    this.unit = config.unit;
    this.limit = config.initialLimit;
    this.minLimit = config.minLimit;
    this.maxLimit = config.maxLimit;
    this.costPerUnit = config.costPerUnit;
    this.maxHistory = config.maxHistory ?? 60;
  }

  update(newValue: number) {
    this.current = newValue;
    this.history = [...this.history, newValue].slice(-this.maxHistory);
  }

  get cost() {
    return this.limit * this.costPerUnit;
  }

  get utilization() {
    return (this.current / this.limit) * 100;
  }
}

/**
 * Tracks telemetry data (performance metrics) over time.
 */
export class Metric {
  name: string;
  unit: string;
  value = $state(0);
  history = $state<number[]>([]);
  maxHistory: number;

  constructor(config: MetricConfig) {
    this.name = config.name;
    this.unit = config.unit;
    this.maxHistory = config.maxHistory ?? 60;
  }

  update(newValue: number) {
    this.value = newValue;
    this.history = [...this.history, newValue].slice(-this.maxHistory);
  }
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

  // Temporary state for the current tick
  incomingTrafficVolume = 0;
  unsuccessfulTrafficVolume = 0;

  constructor(config: ComponentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.trafficRoutes = config.traffic_routes;

    for (const [key, attrConfig] of Object.entries(config.attributes)) {
      this.attributes[key] = new Attribute(attrConfig);
    }

    for (const [key, metricConfig] of Object.entries(config.metrics)) {
      this.metrics[key] = new Metric(metricConfig);
    }
  }

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

/**
 * Specialized Component: Compute Node
 */
export class ComputeNode extends SystemComponent {
  type = 'compute';

  protected calculateInternalFailures(value: number): number {
    // 1 GCU handles 20 requests (based on tick logic below)
    const capacity = this.attributes.gcu.limit * 20;
    if (value > capacity) {
      return value - capacity;
    }
    return 0;
  }

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    this.attributes.gcu.update((traffic / 20) + (Math.random() * 0.5));
    this.attributes.ram.update(1.2 + (traffic / 200) + (Math.random() * 0.1 - 0.05));

    const util = this.attributes.gcu.utilization;
    let latency = 50 + (traffic / 5);
    
    if (util > 80) {
      latency *= (1 + (util - 80) / 10);
    }

    // Apply status effect multipliers: (1 + sum(multipliers)) * base_value
    let multiplierSum = 0;
    const activeEffects = handler.statusEffects.filter(
        (e: any) => e.type === 'component' && e.isActive && e.componentAffected === this.id && e.metricAffected === 'latency'
    ) as ComponentStatusEffect[];
    for (const e of activeEffects) multiplierSum += e.multiplier;
    latency *= (1 + multiplierSum);

    this.metrics.latency.update(latency);
    
    // Calculate Error Rate: (failed traffic / total traffic) * 100
    const failureRate = traffic > 0 ? (this.unsuccessfulTrafficVolume / traffic) * 100 : 0;
    
    // Apply error_rate status effects
    let errMultSum = 0;
    const errEffects = handler.statusEffects.filter(
        (e: any) => e.type === 'component' && e.isActive && e.componentAffected === this.id && e.metricAffected === 'error_rate'
    ) as ComponentStatusEffect[];
    for (const e of errEffects) errMultSum += e.multiplier;
    const errorRate = failureRate + errMultSum; 

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
    
    if (gcuUtil > 95 || errorRate > 5) this.status = 'critical';
    else if (gcuUtil > 80 || errorRate > 1) this.status = 'warning';
    else this.status = 'healthy';
  }
}

/**
 * Specialized Component: Database Node
 */
export class DatabaseNode extends SystemComponent {
  type = 'database';
  fillRate = 0.0001;

  protected calculateInternalFailures(value: number): number {
    // Enforce hard cap: 1 request = 1 connection
    const limit = this.attributes.connections.limit;
    if (value > limit) {
      return value - limit;
    }
    return 0;
  }

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    // Update connections to reflect current 1:1 traffic load
    this.attributes.connections.update(traffic + (Math.random() * 2));

    const growth = traffic * this.fillRate;
    this.attributes.storage.update(Math.min(
      this.attributes.storage.limit,
      this.attributes.storage.current + growth
    ));

    const connUtil = this.attributes.connections.utilization;
    let qLat = 10 + (this.attributes.connections.current / 5);
    
    if (connUtil > 90) {
      qLat *= 5;
    }

    this.metrics.query_latency.update(qLat);

    if (this.metrics.error_rate) {
      const errorRate = traffic > 0 ? (this.unsuccessfulTrafficVolume / traffic) * 100 : 0;
      this.metrics.error_rate.update(errorRate);
    }

    if (this.metrics.incoming) {
      this.metrics.incoming.update(traffic);
    }

    const errorRate = this.metrics.error_rate?.value ?? 0;
    if (connUtil > 100 || errorRate > 5) this.status = 'critical';
    else if (connUtil > 80 || errorRate > 1) this.status = 'warning';
    else this.status = 'healthy';
    
    this.incomingTrafficVolume = 0;
    this.unsuccessfulTrafficVolume = 0;
  }
}

/**
 * Specialized Component: Storage Node
 */
export class StorageNode extends SystemComponent {
  type = 'storage';
  fillRate = 0.05;

  protected calculateInternalFailures(): number {
    const util = this.attributes.storage_usage.utilization;
    if (util >= 100) return 1000000; // Total failure
    return 0;
  }

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    const growth = traffic * this.fillRate;
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

    const util = this.attributes.storage_usage.utilization;
    const errorRate = this.metrics.error_rate?.value ?? 0;
    if (util >= 100 || errorRate > 5) this.status = 'critical';
    else if (util > 85 || errorRate > 1) this.status = 'warning';
    else this.status = 'healthy';

    this.incomingTrafficVolume = 0;
    this.unsuccessfulTrafficVolume = 0;
  }
}




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
  handleTraffic(trafficName: string, value: number): [number, number];
  statusEffects: StatusEffect[];
}

/**
 * Represents a specific flow of traffic within the system.
 */
export class Traffic {
  id: string; // The unique readable id (name)
  type: 'internal' | 'external';
  targetComponentName: string;
  value = $state(0);
  successfulResponseMetric?: string;
  unsuccessfulResponseMetric?: string;
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
    this.successfulResponseMetric = config.successful_response_metric;
    this.unsuccessfulResponseMetric = config.unsuccessful_response_metric;
    this.baseVariance = config.base_variance ?? 5;
  }

  update(newValue: number, successful: number, unsuccessful: number) {
    this.value = newValue;
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
   * @returns [successfulCalls, unsuccessfulCalls]
   */
  handleTraffic(trafficName: string, value: number, handler: TrafficHandler): [number, number] {
    this.incomingTrafficVolume += value;
    
    let unsuccessfulCalls = 0;
    const route = this.trafficRoutes.find(r => r.name === trafficName);
    
    // 1. Process outgoing traffic dependencies
    if (route && value > 0) {
      for (const outgoing of route.outgoing_traffics) {
        const requiredValue = value * outgoing.multiplier;
        const [subSuccess, subFail] = handler.handleTraffic(outgoing.name, requiredValue);
        
        const failRatio = subFail / requiredValue;
        unsuccessfulCalls = Math.max(unsuccessfulCalls, Math.round(value * (isNaN(failRatio) ? 0 : failRatio)));
      }
    }

    // 2. Apply internal saturation failures (e.g. over capacity)
    const internalFailures = this.calculateInternalFailures(value);
    unsuccessfulCalls = Math.min(value, unsuccessfulCalls + internalFailures);

    const successfulCalls = value - unsuccessfulCalls;

    return [successfulCalls, unsuccessfulCalls];
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
    const util = this.attributes.gcu.utilization;
    if (util > 100) {
      // Linear failure increase above 100% utilization
      return Math.round(value * ((util - 100) / 100));
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
    
    let errorRate = util > 100 ? (util - 100) * 2 : 0;
    // Apply error_rate status effects
    let errMultSum = 0;
    const errEffects = handler.statusEffects.filter(
        (e: any) => e.type === 'component' && e.isActive && e.componentAffected === this.id && e.metricAffected === 'error_rate'
    ) as ComponentStatusEffect[];
    for (const e of errEffects) errMultSum += e.multiplier;
    errorRate += errMultSum; 

    this.metrics.error_rate.update(errorRate);

    this.updateStatus();
    this.incomingTrafficVolume = 0; // Reset for next tick
  }

  private updateStatus() {
    const gcuUtil = this.attributes.gcu.utilization;
    if (gcuUtil > 95) this.status = 'critical';
    else if (gcuUtil > 80) this.status = 'warning';
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
    const connUtil = this.attributes.connections.utilization;
    if (connUtil > 100) {
        return Math.round(value * 0.5); // 50% failure if connections maxed
    }
    return 0;
  }

  tick() {
    const traffic = this.incomingTrafficVolume;
    this.attributes.connections.update((traffic / 4) + (Math.random() * 2));

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

    if (connUtil > 100) this.status = 'critical';
    else if (connUtil > 80) this.status = 'warning';
    else this.status = 'healthy';
    
    this.incomingTrafficVolume = 0;
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

  tick() {
    const traffic = this.incomingTrafficVolume;
    const growth = traffic * this.fillRate;
    this.attributes.storage_usage.update(Math.min(
      this.attributes.storage_usage.limit,
      this.attributes.storage_usage.current + growth
    ));

    this.metrics.fill_rate.update(growth);

    const util = this.attributes.storage_usage.utilization;
    if (util >= 100) this.status = 'critical';
    else if (util > 85) this.status = 'warning';
    else this.status = 'healthy';

    this.incomingTrafficVolume = 0;
  }
}




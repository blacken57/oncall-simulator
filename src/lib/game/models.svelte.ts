import type { ComponentStatusEffect, TrafficStatusEffect, StatusEffect } from './statusEffects.svelte';
import type { 
  AttributeConfig, 
  MetricConfig, 
  ComponentConfig, 
  TrafficConfig, 
  TrafficRouteConfig, 
  OutgoingTrafficConfig,
  ComponentPhysicsConfig
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

  protected calculateInternalFailures(value: number): number {
    const capacity = this.attributes.gcu.limit * (this.physics.request_capacity_per_unit ?? 20);
    if (value > capacity) {
      return value - capacity;
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
    this.attributes.gcu.update(gcuBase + (traffic / capPerUnit) + (Math.random() * (physics.noise_factor ?? 0.5)));
    
    // RAM Usage
    const ramBase = physics.resource_base_usage?.ram ?? 0;
    const ramUsagePerReq = physics.consumption_rates?.ram ?? 0;
    this.attributes.ram.update(ramBase + (traffic * ramUsagePerReq) + noise * 0.2);

    const util = this.attributes.gcu.utilization;
    
    // Latency calculation
    let latency = (physics.latency_base_ms ?? 50) + (traffic * (physics.latency_load_factor ?? 0.2));
    
    const satThreshold = physics.saturation_threshold_percent ?? 80;
    if (util > satThreshold) {
      latency *= (1 + (util - satThreshold) * (physics.saturation_penalty_factor ?? 0.1));
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
    const thresholds = this.physics.status_thresholds || {};
    
    const gcuT = thresholds.gcu_util || { warning: 80, critical: 95 };
    const errT = thresholds.error_rate || { warning: 1, critical: 5 };

    if (gcuUtil > gcuT.critical || errorRate > errT.critical) this.status = 'critical';
    else if (gcuUtil > gcuT.warning || errorRate > errT.warning) this.status = 'warning';
    else this.status = 'healthy';
  }
}

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

  protected calculateInternalFailures(value: number): number {
    const limit = this.attributes.connections.limit;
    if (value > limit) {
      return value - limit;
    }
    return 0;
  }

  tick(handler: TrafficHandler) {
    const traffic = this.incomingTrafficVolume;
    const physics = this.physics;
    
    // Connections update
    this.attributes.connections.update(traffic + (Math.random() * (physics.noise_factor ?? 2)));

    const growth = traffic * (physics.consumption_rates?.storage ?? 0.0001);
    this.attributes.storage.update(Math.min(
      this.attributes.storage.limit,
      this.attributes.storage.current + growth
    ));

    const connUtil = this.attributes.connections.utilization;
    
    let qLat = (physics.latency_base_ms ?? 10) + (this.attributes.connections.current * (physics.latency_load_factor ?? 0.2));
    
    const satThreshold = physics.saturation_threshold_percent ?? 90;
    if (connUtil > satThreshold) {
      qLat *= (1 + (physics.saturation_penalty_factor ?? 4));
    }

    this.metrics.query_latency.update(qLat);

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

  protected calculateInternalFailures(): number {
    const util = this.attributes.storage_usage.utilization;
    if (util >= 100) return 1000000; // Total failure
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




import type { StatusEffect } from './statusEffects';

/**
 * Represents a configurable property of a system (e.g., RAM Limit vs RAM Usage).
 * Attributes are the "knobs" that players can turn to manage their infrastructure.
 * 
 * They track:
 * 1. The 'limit' (the capacity/quota set by the user).
 * 2. The 'current' (the actual value being used by the system).
 * 3. A 'history' (sliding window of previous values for graphing).
 */
export class Attribute {
  /** The human-readable name of the attribute (e.g., 'Memory') */
  name: string;
  /** The unit of measurement (e.g., 'GB', 'GCU', 'count') */
  unit: string;
  /** The user-defined capacity/limit for this attribute */
  limit = $state(0);
  /** The actual current usage/value computed by the simulation engine */
  current = $state(0);
  /** A collection of historical 'current' values for trend analysis */
  history = $state<number[]>([]);
  /** The maximum number of historical data points to retain */
  maxHistory = 60;
  /** The minimum value the user is allowed to set for the limit */
  minLimit: number;
  /** The maximum value the user is allowed to set for the limit */
  maxLimit: number;
  /** The financial cost incurred per unit of the 'limit' per game tick */
  costPerUnit: number;

  constructor(name: string, unit: string, initialLimit: number, min: number, max: number, cost: number) {
    this.name = name;
    this.unit = unit;
    this.limit = initialLimit;
    this.current = 0;
    this.minLimit = min;
    this.maxLimit = max;
    this.costPerUnit = cost;
  }

  /**
   * Updates the 'current' usage value and pushes it into the history buffer.
   * Maintains the buffer length at 'maxHistory'.
   */
  update(newValue: number) {
    this.current = newValue;
    this.history = [...this.history, newValue].slice(-this.maxHistory);
  }

  /**
   * Total cost of this attribute per game tick.
   * Calculated based on the 'limit' (provisioned capacity), not actual usage.
   * This encourages players to optimize their provisioning.
   */
  get cost() {
    return this.limit * this.costPerUnit;
  }

  /** 
   * The percentage of the provisioned limit currently being used.
   * Values > 100% indicate saturation/overloading, which typically triggers
   * warnings or performance degradation.
   */
  get utilization() {
    return (this.current / this.limit) * 100;
  }
}

/**
 * Tracks telemetry data (performance metrics) over time.
 * Metrics differ from Attributes in that they are output-only (not configurable by the user).
 * They represent the health and performance of the system (e.g., Latency, Error Rate).
 */
export class Metric {
  /** The human-readable name (e.g., 'P99 Latency') */
  name: string;
  /** The unit of measurement (e.g., 'ms', '%') */
  unit: string;
  /** The latest calculated value of this metric */
  value = $state(0);
  /** Sliding window of historical values for graphing */
  history = $state<number[]>([]);
  /** Maximum historical data points to retain */
  maxHistory = 60;

  constructor(name: string, unit: string) {
    this.name = name;
    this.unit = unit;
  }

  /**
   * Updates the metric value and its historical record.
   */
  update(newValue: number) {
    this.value = newValue;
    this.history = [...this.history, newValue].slice(-this.maxHistory);
  }
}

/**
 * The base class for all simulated infrastructure components.
 * Every component in the system (e.g., a Web Server or a DB) must extend this class.
 */
export abstract class SystemComponent {
  /** Machine-friendly identifier */
  id: string;
  /** User-friendly name displayed in the UI */
  name: string;
  /** Type identifier for classification (e.g., 'compute', 'database') */
  abstract type: string;

  /** 
   * Dictionary of configurable knobs (e.g., 'ram', 'cpu').
   * These drive the operational cost of the component.
   */
  attributes = $state<Record<string, Attribute>>({});
  
  /** 
   * Dictionary of telemetry outputs (e.g., 'latency', 'errors').
   * These indicate the health and performance of the component.
   */
  metrics = $state<Record<string, Metric>>({});

  /** Current health state of the component */
  status = $state<'healthy' | 'warning' | 'critical'>('healthy');
  
  /** List of active conditions/incidents affecting this component */
  effects = $state<StatusEffect[]>([]);

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  /** 
   * Every component calculates its own 'physics' and 'logic' in this method.
   * It is called on every engine tick. 
   * @param traffic - The current total requests/sec in the system.
   * @param dependencies - Access to other components for cross-system impact logic.
   * @param activeEffects - Any temporary modifiers (e.g., a 'DDoS Attack' effect).
   */
  abstract tick(traffic: number, dependencies: Record<string, SystemComponent>, activeEffects?: StatusEffect[]): void;

  /** 
   * Sum of the costs of all attributes provisioned for this component.
   * Represents the 'OpEx' (Operating Expenditure) per tick.
   */
  get totalCost() {
    return Object.values(this.attributes).reduce((sum, attr) => sum + attr.cost, 0);
  }
}

/**
 * Specialized Component: Compute Node (APIs, Backend Workers, Web Servers)
 * 
 * Physics logic:
 * - GCU (Generic Compute Unit) usage scales linearly with traffic.
 * - RAM usage stays relatively flat but scales slightly with load.
 * - Latency stays low until GCU utilization hits ~80%, then scales exponentially.
 * - Error Rate spikes when GCU utilization exceeds 100% (CPU saturation).
 */
export class ComputeNode extends SystemComponent {
  type = 'compute';

  constructor(id: string, name: string, ramLimit: number, gcuLimit: number) {
    super(id, name);
    // Attributes: Knobs for the user
    this.attributes.ram = new Attribute('Memory', 'GB', ramLimit, 2, 64, 10);
    this.attributes.gcu = new Attribute('GCU', 'GCU', gcuLimit, 1, 32, 25);

    // Metrics: Health indicators for the user
    this.metrics.latency = new Metric('P99 Latency', 'ms');
    this.metrics.error_rate = new Metric('Error Rate', '%');
  }

  tick(traffic: number) {
    // Logic: GCU usage scales with traffic (Approx 100 req/s ≈ 5 GCU)
    // We add minor jitter for realism.
    this.attributes.gcu.update((traffic / 20) + (Math.random() * 0.5));

    // Logic: RAM usage scales slowly with traffic (e.g., overhead per connection)
    this.attributes.ram.update(1.2 + (traffic / 200) + (Math.random() * 0.1 - 0.05));

    // Physics: Performance degradation under load
    const util = this.attributes.gcu.utilization;
    
    // Baseline latency is 50ms + 1ms per 5 req/s.
    let latency = 50 + (traffic / 5);
    
    // Saturation logic: If we use more than 80% of GCU, latency increases exponentially.
    if (util > 80) {
      latency *= (1 + (util - 80) / 10);
    }

    this.metrics.latency.update(latency);
    
    // Error rate increases if we are over 100% GCU utilization.
    this.metrics.error_rate.update(util > 100 ? (util - 100) * 2 : 0);

    // Update the visual status badge based on utilization thresholds.
    this.updateStatus();
  }

  /**
   * Internal helper to determine component health state.
   */
  private updateStatus() {
    const gcuUtil = this.attributes.gcu.utilization;
    if (gcuUtil > 95) this.status = 'critical';
    else if (gcuUtil > 80) this.status = 'warning';
    else this.status = 'healthy';
  }
}

/**
 * Specialized Component: Database Node (SQL/NoSQL Databases)
 * 
 * Physics logic:
 * - Active connections scale with traffic.
 * - Storage usage grows over time based on traffic (data ingestion).
 * - Query Latency spikes dramatically if connection limits are reached.
 */
export class DatabaseNode extends SystemComponent {
  type = 'database';
  /** Rate at which new data is written to disk per incoming request */
  fillRate = 0.0001; // GB per request

  constructor(id: string, name: string, connLimit: number, storageLimit: number) {
    super(id, name);
    this.attributes.connections = new Attribute('Max Connections', 'count', connLimit, 10, 1000, 1);
    this.attributes.storage = new Attribute('Storage', 'GB', storageLimit, 50, 5000, 0.5);

    this.metrics.query_latency = new Metric('Query Latency', 'ms');
  }

  tick(traffic: number) {
    // Connections scale with traffic (Approx 4 req/s = 1 persistent connection)
    this.attributes.connections.update((traffic / 4) + (Math.random() * 2));

    // Storage: Data accumulates over time.
    const growth = traffic * this.fillRate;
    // Note: We don't 'overflow' storage yet, we just cap it at the limit 
    // to simulate a 'disk full' error when it gets close.
    this.attributes.storage.update(Math.min(
      this.attributes.storage.limit,
      this.attributes.storage.current + growth
    ));

    const connUtil = this.attributes.connections.utilization;
    
    // Baseline query latency scales with connection count.
    let qLat = 10 + (this.attributes.connections.current / 5);
    
    // Saturation logic: Reaching the connection limit causes severe queuing/latency.
    if (connUtil > 90) {
      qLat *= 5;
    }

    this.metrics.query_latency.update(qLat);

    // Health status based on connection saturation.
    if (connUtil > 100) this.status = 'critical';
    else if (connUtil > 80) this.status = 'warning';
    else this.status = 'healthy';
  }
}

/**
 * Specialized Component: Storage Node (Logging buckets, S3, Block Storage)
 * 
 * Physics logic:
 * - Purely tracks data accumulation.
 * - High fill rate compared to database (simulating verbose log ingestion).
 * - Critical state reached when storage is 100% full.
 */
export class StorageNode extends SystemComponent {
  type = 'storage';
  /** Rate at which data is written to storage per incoming request */
  fillRate = 0.05; // GB per request (high for logs)

  constructor(id: string, name: string, capacity: number) {
    super(id, name);
    this.attributes.storage_usage = new Attribute('Storage Usage', 'GB', capacity, 100, 10000, 0.1);
    this.metrics.fill_rate = new Metric('Fill Rate', 'GB/s');
  }

  tick(traffic: number) {
    // Logs grow significantly faster than database records.
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
  }
}

import type { AttributeConfig, MetricConfig, TrafficConfig } from './schema';

/**
 * Represents a specific flow of traffic within the system.
 */
export class Traffic {
  id: string; // The unique readable id (name)
  type: 'internal' | 'external';
  targetComponentName: string;
  nominalValue: number; // The stable base value from config
  value = $state(0); // Current tick's base value (with noise)
  actualValue = $state(0); // Total volume after multipliers/effects
  baseVariance: number;

  // History for tracking performance over time
  successHistory = $state<number[]>([]);
  failureHistory = $state<number[]>([]);
  latencyHistory = $state<number[]>([]);
  maxHistory = 60;

  constructor(config: TrafficConfig) {
    this.id = config.name;
    this.type = config.type;
    this.targetComponentName = config.target_component_name;
    this.nominalValue = config.value || 0;
    this.value = this.nominalValue;
    this.baseVariance = config.base_variance ?? 5;
  }

  update(
    baseValue: number,
    actualValue: number,
    successful: number,
    unsuccessful: number,
    averageLatency: number
  ) {
    this.value = baseValue;
    this.actualValue = actualValue;
    this.successHistory.push(successful);
    if (this.successHistory.length > this.maxHistory) this.successHistory.shift();
    this.failureHistory.push(unsuccessful);
    if (this.failureHistory.length > this.maxHistory) this.failureHistory.shift();
    this.latencyHistory.push(averageLatency);
    if (this.latencyHistory.length > this.maxHistory) this.latencyHistory.shift();
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
  applyDelay: number;

  constructor(config: AttributeConfig) {
    this.name = config.name;
    this.unit = config.unit;
    this.limit = config.initialLimit;
    this.minLimit = config.minLimit;
    this.maxLimit = config.maxLimit;
    this.costPerUnit = config.costPerUnit;
    this.applyDelay = config.apply_delay ?? 5;
    this.maxHistory = config.maxHistory ?? 60;
  }

  update(newValue: number) {
    this.current = newValue;
    this.history.push(newValue);
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  get cost() {
    return this.limit * this.costPerUnit;
  }

  get utilization() {
    if (this.limit === 0) return 0;
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
    this.history.push(newValue);
    if (this.history.length > this.maxHistory) this.history.shift();
  }
}

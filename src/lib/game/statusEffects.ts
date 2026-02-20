/**
 * Supported mathematical operations for modifying a base value.
 */
export type ModifierOperation = 'add' | 'multiply' | 'multiply_percent';

/**
 * A Modifier represents a change applied to a component's attribute, metric, or global traffic.
 * For example: "Increase traffic by 50%" or "Reduce RAM capacity by 2GB".
 */
export interface Modifier {
  /** The type of data to target (e.g., global traffic or a specific component property) */
  target: 'attribute' | 'metric' | 'traffic';
  /** Optional: The ID of the component this modifier targets. If omitted, applies to the component it's attached to. */
  componentId?: string; // Optional: if omitted, applies to the component it's attached to or global if target is traffic
  /** The ID of the specific attribute or metric (e.g., 'ram', 'latency') */
  id?: string; // attribute or metric id
  /** The mathematical operation to perform on the base value */
  operation: ModifierOperation;
  /** The value used in the operation */
  value: number;
}

/**
 * Triggers define when an effect should be activated based on system state.
 * For example: "If latency > 500ms, trigger a 'Customer Outage' effect".
 */
export interface TriggerCondition {
  /** Whether to monitor a performance Metric or a configuration Attribute */
  type: 'metric' | 'attribute';
  /** The ID of the component to monitor */
  componentId: string;
  /** The specific property ID to monitor (e.g., 'gcu', 'latency') */
  id: string;
  /** Comparison operator for the trigger threshold */
  operator: '>' | '<' | '>=';
  /** The threshold value for the comparison */
  value: number;
  /** If true, the trigger compares against the attribute's utilization % (0-100) instead of its absolute value */
  useUtilization?: boolean; // If true, value is compared to attribute's utilization percentage (0-100)
}

/**
 * A StatusEffect represents a temporary or permanent condition affecting the system.
 * This is the core of the "Incident" and "External Events" system.
 */
export interface StatusEffect {
  /** Unique identifier for the effect type */
  id: string;
  /** Human-readable title of the effect */
  name: string;
  /** Detailed explanation shown to the user */
  description: string;
  /** 
   * 'external': Caused by environment (e.g., Marketing Campaign).
   * 'internal': Caused by system failure or saturation.
   */
  type: 'external' | 'internal';
  /** List of changes this effect applies to the system while active */
  modifiers: Modifier[];
  /** How many game ticks the effect lasts. 'permanent' effects require manual resolution. */
  duration: number | 'permanent'; // ticks
  /** Current progress for effects that expire over time */
  remainingTicks?: number;
  /** Logic that automatically activates this effect when conditions are met */
  triggerCondition?: TriggerCondition;
  /** Probability (0-1) of this effect occurring randomly per tick (for external events) */
  chance?: number; // 0-1 for external effects
}

/**
 * Helper to apply a modifier to a numeric value based on its operation type.
 */
export function applyModifier(baseValue: number, operation: ModifierOperation, value: number): number {
  switch (operation) {
    case 'add':
      return baseValue + value;
    case 'multiply':
      return baseValue * value;
    case 'multiply_percent':
      return baseValue * (1 + value / 100);
    default:
      return baseValue;
  }
}

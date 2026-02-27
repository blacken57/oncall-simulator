export type TrafficType = 'internal' | 'external';

export interface OutgoingTrafficConfig {
  name: string; // The unique id of the outgoing traffic
  multiplier: number; // For example, 2 means 2 calls to this traffic for every 1 call of the parent traffic
}

export interface TrafficRouteConfig {
  name: string; // The unique name of the incoming traffic
  base_latency_ms?: number; // Base processing time for this specific route
  outgoing_traffics: OutgoingTrafficConfig[];
}

export interface TrafficConfig {
  type: TrafficType;
  name: string; // Unique readable id
  target_component_name: string; // Each component should have a unique name
  /** Base volume in req/s. Must be ≥ 0. Defaults to 0 if omitted. */
  value?: number;
  /** ±noise per tick. Defaults to 5 if omitted. Must be ≥ 0. */
  base_variance?: number;
}

export interface StatusEffectWarningConfig {
  delay_ticks: number;
  ticket_title: string;
  ticket_description: string;
}

/**
 * Applies a temporary multiplier/offset to a specific metric on a component.
 *
 * Effect formula: `effectiveValue = base + base * multiplier + offset`
 * - `multiplier: 0` (default) — no multiplicative change; only `offset` applies.
 * - `multiplier: 1.0` — doubles the base value.
 * - `resolution_ticks` controls how many ticks the effect stays active before auto-resolving.
 */
export interface ComponentStatusEffectConfig {
  type: 'component';
  name: string; // Unique readable id
  component_affected: string; // Component ID
  metric_affected: string; // Metric or attribute key within the component
  /** Multiplicative modifier. `effectiveValue = base + base * multiplier`. Defaults to 0. */
  multiplier?: number;
  /** Absolute delta added on top of the multiplied value. Defaults to 0. */
  offset?: number;
  materialization_probability: number; // Probability each tick (0-1)
  /** Ticks until the effect auto-resolves. Omit for a permanent effect. */
  resolution_ticks?: number;
  max_instances_at_once: number;
  warning_config?: StatusEffectWarningConfig;
}

/**
 * Applies a temporary multiplier/offset to a traffic flow's volume.
 *
 * Effect formula: `effectiveVolume = base + base * multiplier + offset`
 * - `multiplier: 0` (default) — no multiplicative change; only `offset` applies.
 * - `multiplier: 3.0` — quadruples traffic volume (base + 3× base).
 * - `turnsRemaining` is the traffic-effect equivalent of `resolution_ticks` on component effects.
 */
export interface TrafficStatusEffectConfig {
  type: 'traffic';
  name: string; // Unique readable id
  traffic_affected: string; // Traffic ID
  /** Multiplicative modifier. `effectiveVolume = base + base * multiplier`. Defaults to 0. */
  multiplier?: number;
  /** Absolute volume added on top of the multiplied value. Defaults to 0. */
  offset?: number;
  materialization_probability: number; // Probability each tick (0-1)
  /** How many ticks the effect stays active (required for traffic effects). */
  turnsRemaining: number;
  max_instances_at_once?: number;
  warning_config?: StatusEffectWarningConfig;
}

export type StatusEffectConfig = ComponentStatusEffectConfig | TrafficStatusEffectConfig;

export interface AttributeConfig {
  name: string;
  unit: string;
  initialLimit: number;
  minLimit: number;
  maxLimit: number;
  costPerUnit: number;
  maxHistory?: number;
  /** How many ticks it takes for a player-initiated change to materialize. Defaults to 5. */
  apply_delay?: number;
}

export interface MetricConfig {
  name: string;
  unit: string;
  maxHistory?: number;
}

export interface ComponentPhysicsConfig {
  /** How many requests 1 unit of the primary attribute can handle (e.g., 20 reqs/GCU). */
  request_capacity_per_unit?: number;

  /** Base latency in milliseconds before load or saturation adjustments. */
  latency_base_ms?: number;

  /** Extra latency added per request (ms/req). Applied before the saturation penalty. */
  latency_load_factor?: number;

  /** Utilization % (0–100) where non-linear latency degradation begins. Default: 80 for compute, 90 for database. */
  saturation_threshold_percent?: number;

  /**
   * Controls how aggressively latency spikes above the saturation threshold.
   * Formula: `penalty = min(1 + ((utilisation − threshold) × factor)², 100)`.
   * Values above 0.8 produce extreme latency (thousands of ms) near saturation.
   * Safe range: 0.3–0.8 for gameplay-friendly behaviour.
   * Default: 0.1 for compute, 4 for database.
   */
  saturation_penalty_factor?: number;

  /** Base resource consumption regardless of load (attribute_key → base_value). */
  resource_base_usage?: Record<string, number>;

  /** Rate at which attributes are consumed per request (attribute_key → usage_per_req). */
  consumption_rates?: Record<string, number>;

  /**
   * Random variance applied to resource metrics each tick.
   * Formula: `(Math.random() - 0.5) * 2 * noise_factor` (centred, symmetric).
   * Typical range: 0.5–2 for internal services, 5–20 for external APIs.
   * Default: 0.5 for compute, 2 for database, 10 for external_api.
   */
  noise_factor?: number;

  /** Thresholds for status changes (metric/attribute → { warning, critical }). */
  status_thresholds?: Record<string, { warning: number; critical: number }>;
}

export interface AlertConfig {
  name: string;
  metric: string; // The key in metrics or attributes
  warning_threshold: number;
  critical_threshold: number;
  direction: 'above' | 'below'; // 'above' means value > threshold is bad
}

export const VALID_COMPONENT_TYPES = [
  'compute',
  'database',
  'storage',
  'queue',
  'external_api'
] as const;
export type ComponentType = (typeof VALID_COMPONENT_TYPES)[number];

export interface ComponentConfig {
  id: string;
  name: string;
  type: ComponentType;
  attributes: Record<string, AttributeConfig>;
  metrics: Record<string, MetricConfig>;
  traffic_routes: TrafficRouteConfig[];
  physics?: ComponentPhysicsConfig;
  alerts?: AlertConfig[];
}

export interface StatusEffectTargetAttribute {
  name: string; // Attribute name within the target component
  target?: 'limit' | 'value'; // Whether to affect the max capacity or current utilization. Defaults to 'limit'.
  multiplier?: number; // Multiplier (current * multiplier). Defaults to 0 if missing.
  offset?: number; // Static value to add/subtract. Defaults to 0 if missing.
  // Note: At least one of multiplier or offset must be provided.
}

export interface StatusEffectTargetTraffic {
  name: string; // Name of the traffic to release
  value: number; // Volume of traffic to emit
}

export interface ScheduledJobConfig {
  name: string; // Unique identifier
  targetName: string; // Name of the target component
  schedule: {
    interval: number; // Every X ticks
  };
  affectedAttributes: StatusEffectTargetAttribute[];
  emittedTraffic: StatusEffectTargetTraffic[];
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  components: ComponentConfig[];
  traffics: TrafficConfig[];
  statusEffects: StatusEffectConfig[];
  scheduledJobs?: ScheduledJobConfig[];
}

export type TicketStatus = 'open' | 'investigating' | 'resolved';

export interface Ticket {
  id: string;
  componentId: string;
  alertName: string;
  title: string;
  description: string;
  status: TicketStatus;
  createdAt: number;
  resolvedAt?: number;
  impactedMetric?: string;
}

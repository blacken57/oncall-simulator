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
  value?: number; // Base value if any
  base_variance?: number; // Noise factor
}

export interface ResolutionConditionConfig {
  turnsRemaining?: number;
}

export interface ComponentStatusEffectConfig {
  type: 'component';
  name: string; // Unique readable id
  component_affected: string; // Component ID
  metric_affected: string; // Metric name within the component
  multiplier?: number; // Defaults to 0 if missing.
  offset?: number; // Static value to add/subtract. Defaults to 0 if missing.
  materialization_probability: number; // Probability each tick (0-1)
  resolution_condition: ResolutionConditionConfig;
  max_instances_at_once: number;
}

export interface TrafficStatusEffectConfig {
  type: 'traffic';
  name: string; // Unique readable id
  traffic_affected: string; // Traffic ID
  multiplier?: number; // Defaults to 0 if missing.
  offset?: number; // Defaults to 0 if missing.
  materialization_probability: number; // Probability each tick (0-1)
  turnsRemaining: number;
  max_instances_at_once?: number;
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
  apply_delay?: number; // How many ticks it takes for a change to materialize
}

export interface MetricConfig {
  name: string;
  unit: string;
  maxHistory?: number;
}

export interface ComponentPhysicsConfig {
  /** How many requests 1 unit of the primary attribute can handle (e.g., 20 reqs/GCU) */
  request_capacity_per_unit?: number;

  /** Base latency in milliseconds */
  latency_base_ms?: number;

  /** Latency increase per request (ms/req) */
  latency_load_factor?: number;

  /** Utilization % (0-100) where non-linear degradation begins */
  saturation_threshold_percent?: number;

  /** How aggressively latency spikes after the saturation threshold */
  saturation_penalty_factor?: number;

  /** Base resource consumption regardless of load (attribute_key -> base_value) */
  resource_base_usage?: Record<string, number>;

  /** Rate at which attributes are consumed per request (attribute_key -> usage_per_req) */
  consumption_rates?: Record<string, number>;

  /** Random variance applied to metrics (0-1) */
  noise_factor?: number;

  /** Thresholds for status changes (metric/attribute -> { warning, critical }) */
  status_thresholds?: Record<string, { warning: number; critical: number }>;
}

export interface AlertConfig {
  name: string;
  metric: string; // The key in metrics or attributes
  warning_threshold: number;
  critical_threshold: number;
  direction: 'above' | 'below'; // 'above' means value > threshold is bad
}

export const VALID_COMPONENT_TYPES = ['compute', 'database', 'storage'] as const;
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

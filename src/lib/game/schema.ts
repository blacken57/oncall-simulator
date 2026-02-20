export type TrafficType = 'internal' | 'external';

export interface OutgoingTrafficConfig {
  name: string; // The unique id of the outgoing traffic
  multiplier: number; // For example, 2 means 2 calls to this traffic for every 1 call of the parent traffic
}

export interface TrafficRouteConfig {
  name: string; // The unique name of the incoming traffic
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
  multiplier: number; // (a + x1 + x2 + x3)*base_value where xn refers to the multipliers
  materialization_probability: number; // Probability each tick (0-1)
  resolution_condition: ResolutionConditionConfig;
  max_instances_at_once: number;
}

export interface TrafficStatusEffectConfig {
  type: 'traffic';
  name: string; // Unique readable id
  traffic_affected: string; // Traffic ID
  multiplier: number; // Multiplier for traffic value
  turnsRemaining: number;
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
}

export interface MetricConfig {
  name: string;
  unit: string;
  maxHistory?: number;
}

export interface ComponentConfig {
  id: string;
  name: string;
  type: 'compute' | 'database' | 'storage' | string;
  attributes: Record<string, AttributeConfig>;
  metrics: Record<string, MetricConfig>;
  traffic_routes: TrafficRouteConfig[];
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  components: ComponentConfig[];
  traffics: TrafficConfig[];
  statusEffects: StatusEffectConfig[];
}

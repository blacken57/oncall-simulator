import type { 
  ComponentStatusEffectConfig, 
  TrafficStatusEffectConfig, 
  ResolutionConditionConfig 
} from './schema';

/**
 * A StatusEffect represents a temporary or permanent condition affecting the system.
 */
export type StatusEffect = ComponentStatusEffect | TrafficStatusEffect;

export class ComponentStatusEffect {
  type = 'component' as const;
  name: string;
  componentAffected: string;
  metricAffected: string;
  multiplier: number;
  materializationProbability: number;
  resolutionCondition: ResolutionConditionConfig;
  maxInstancesAtOnce: number;
  
  // Runtime state
  isActive = $state(false);
  turnsRemaining = $state<number | undefined>(undefined);

  constructor(config: ComponentStatusEffectConfig) {
    this.name = config.name;
    this.componentAffected = config.component_affected;
    this.metricAffected = config.metric_affected;
    this.multiplier = config.multiplier;
    this.materializationProbability = config.materialization_probability;
    this.resolutionCondition = config.resolution_condition;
    this.maxInstancesAtOnce = config.max_instances_at_once;
    
    if (config.resolution_condition.turnsRemaining !== undefined) {
      this.turnsRemaining = config.resolution_condition.turnsRemaining;
    }
  }

  tick() {
    if (!this.isActive) {
      if (Math.random() < this.materializationProbability) {
        this.isActive = true;
      }
    } else {
      if (this.turnsRemaining !== undefined) {
        this.turnsRemaining--;
        if (this.turnsRemaining <= 0) {
          this.isActive = false;
          // Reset turns if it can materialize again
          if (this.resolutionCondition.turnsRemaining !== undefined) {
             this.turnsRemaining = this.resolutionCondition.turnsRemaining;
          }
        }
      }
    }
  }
}

export class TrafficStatusEffect {
  type = 'traffic' as const;
  name: string;
  trafficAffected: string;
  multiplier: number;
  turnsRemaining = $state(0);
  isActive = $state(true);

  constructor(config: TrafficStatusEffectConfig) {
    this.name = config.name;
    this.trafficAffected = config.traffic_affected;
    this.multiplier = config.multiplier;
    this.turnsRemaining = config.turnsRemaining;
  }

  tick() {
    if (this.isActive) {
      this.turnsRemaining--;
      if (this.turnsRemaining <= 0) {
        this.isActive = false;
      }
    }
  }
}


import type {
  ComponentStatusEffectConfig,
  TrafficStatusEffectConfig,
  ResolutionConditionConfig
} from './schema';
import type { GameEngine } from './engine.svelte';

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
  offset: number;
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
    this.multiplier = config.multiplier ?? 0;
    this.offset = config.offset ?? 0;
    this.materializationProbability = config.materialization_probability;
    this.resolutionCondition = config.resolution_condition;
    this.maxInstancesAtOnce = config.max_instances_at_once;

    if (config.resolution_condition.turnsRemaining !== undefined) {
      this.turnsRemaining = config.resolution_condition.turnsRemaining;
    }
  }

  tick(engine: GameEngine) {
    if (!this.isActive) {
      if (Math.random() < this.materializationProbability) {
        this.isActive = true;
        engine.notify(`EVENT: ${this.name} materialized!`, 'info');
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
  offset: number;
  materializationProbability: number;
  initialTurnsRemaining: number;
  turnsRemaining = $state(0);
  isActive = $state(false);

  constructor(config: TrafficStatusEffectConfig) {
    this.name = config.name;
    this.trafficAffected = config.traffic_affected;
    this.multiplier = config.multiplier ?? 0;
    this.offset = config.offset ?? 0;
    this.materializationProbability = config.materialization_probability;
    this.initialTurnsRemaining = config.turnsRemaining;
    this.turnsRemaining = config.turnsRemaining;
  }

  tick(engine: GameEngine) {
    if (!this.isActive) {
      if (Math.random() < this.materializationProbability) {
        this.isActive = true;
        this.turnsRemaining = this.initialTurnsRemaining;
        engine.notify(`EVENT: ${this.name} materialized!`, 'info');
      }
    } else {
      this.turnsRemaining--;
      if (this.turnsRemaining <= 0) {
        this.isActive = false;
      }
    }
  }
}

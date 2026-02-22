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
  warningConfig?: StatusEffectWarningConfig;

  // Runtime state
  isActive = $state(false);
  isWarning = $state(false);
  delayRemaining = $state(0);
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
    this.warningConfig = config.warning_config;

    if (config.resolution_condition.turnsRemaining !== undefined) {
      this.turnsRemaining = config.resolution_condition.turnsRemaining;
    }
  }

  tick(engine: GameEngine) {
    if (!this.isActive && !this.isWarning) {
      if (Math.random() < this.materializationProbability) {
        if (this.warningConfig) {
          this.isWarning = true;
          this.delayRemaining = this.warningConfig.delay_ticks;
          engine.notify(`WARNING: ${this.name} incoming!`, 'info');
          engine.tickets.push({
            id: Math.random().toString(36).substr(2, 9),
            componentId: this.componentAffected,
            alertName: this.name,
            title: this.warningConfig.ticket_title,
            description: this.warningConfig.ticket_description,
            status: 'open',
            createdAt: engine.tick,
            impactedMetric: this.metricAffected
          });
        } else {
          this.isActive = true;
          engine.notify(`EVENT: ${this.name} materialized!`, 'info');
        }
      }
    } else if (this.isWarning) {
      this.delayRemaining--;
      if (this.delayRemaining <= 0) {
        this.isWarning = false;
        this.isActive = true;
        engine.notify(`EVENT: ${this.name} materialized!`, 'info');
      }
    } else if (this.isActive) {
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
  warningConfig?: StatusEffectWarningConfig;

  // Runtime state
  turnsRemaining = $state(0);
  isActive = $state(false);
  isWarning = $state(false);
  delayRemaining = $state(0);

  constructor(config: TrafficStatusEffectConfig) {
    this.name = config.name;
    this.trafficAffected = config.traffic_affected;
    this.multiplier = config.multiplier ?? 0;
    this.offset = config.offset ?? 0;
    this.materializationProbability = config.materialization_probability;
    this.initialTurnsRemaining = config.turnsRemaining;
    this.turnsRemaining = config.turnsRemaining;
    this.warningConfig = config.warning_config;
  }

  tick(engine: GameEngine) {
    if (!this.isActive && !this.isWarning) {
      if (Math.random() < this.materializationProbability) {
        if (this.warningConfig) {
          this.isWarning = true;
          this.delayRemaining = this.warningConfig.delay_ticks;
          engine.notify(`WARNING: ${this.name} incoming!`, 'info');
          engine.tickets.push({
            id: Math.random().toString(36).substr(2, 9),
            componentId: this.trafficAffected, // For traffic, use traffic ID as componentId (or similar)
            alertName: this.name,
            title: this.warningConfig.ticket_title,
            description: this.warningConfig.ticket_description,
            status: 'open',
            createdAt: engine.tick,
            impactedMetric: this.trafficAffected
          });
        } else {
          this.isActive = true;
          this.turnsRemaining = this.initialTurnsRemaining;
          engine.notify(`EVENT: ${this.name} materialized!`, 'info');
        }
      }
    } else if (this.isWarning) {
      this.delayRemaining--;
      if (this.delayRemaining <= 0) {
        this.isWarning = false;
        this.isActive = true;
        this.turnsRemaining = this.initialTurnsRemaining;
        engine.notify(`EVENT: ${this.name} materialized!`, 'info');
      }
    } else if (this.isActive) {
      this.turnsRemaining--;
      if (this.turnsRemaining <= 0) {
        this.isActive = false;
      }
    }
  }
}

import type {
  ComponentStatusEffectConfig,
  TrafficStatusEffectConfig,
  StatusEffectConfig
} from './schema';
import type { GameEngine } from './engine.svelte';

/**
 * A StatusEffect represents a temporary or permanent condition affecting the system.
 */
export type StatusEffect = ComponentStatusEffect | TrafficStatusEffect;

export interface StatusEffectWarningConfig {
  delay_ticks: number;
  ticket_title: string;
  ticket_description: string;
}

export abstract class BaseStatusEffect {
  abstract type: 'component' | 'traffic';
  name: string;
  multiplier: number;
  offset: number;
  materializationProbability: number;
  warningConfig?: StatusEffectWarningConfig;

  // Runtime state
  isActive = $state(false);
  isWarning = $state(false);
  delayRemaining = $state(0);
  turnsRemaining = $state<number | undefined>(undefined);

  constructor(config: StatusEffectConfig) {
    this.name = config.name;
    this.multiplier = config.multiplier ?? 0;
    this.offset = config.offset ?? 0;
    this.materializationProbability = config.materialization_probability;
    this.warningConfig = config.warning_config;
  }

  protected abstract get targetId(): string;
  protected abstract get impactedMetric(): string;
  protected abstract get initialTurnsRemaining(): number | undefined;

  tick(engine: GameEngine) {
    if (!this.isActive && !this.isWarning) {
      if (Math.random() < this.materializationProbability) {
        if (this.warningConfig) {
          this.isWarning = true;
          this.delayRemaining = this.warningConfig.delay_ticks;
          engine.notify(`WARNING: ${this.name} incoming!`, 'info');
          engine.tickets.push({
            id: Math.random().toString(36).substr(2, 9),
            componentId: this.targetId,
            alertName: this.name,
            title: this.warningConfig.ticket_title,
            description: this.warningConfig.ticket_description,
            status: 'open',
            createdAt: engine.tick,
            impactedMetric: this.impactedMetric
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
      if (this.turnsRemaining !== undefined) {
        this.turnsRemaining--;
        if (this.turnsRemaining <= 0) {
          this.isActive = false;
          // For component effects, reset turns if it can materialize again
          // Handled generically by allowing subclass to dictate initialTurnsRemaining
          this.turnsRemaining = this.initialTurnsRemaining;
        }
      }
    }
  }
}

export class ComponentStatusEffect extends BaseStatusEffect {
  type = 'component' as const;
  componentAffected: string;
  metricAffected: string;
  resolutionTicks: number | undefined;
  // TODO: enforce max_instances_at_once
  maxInstancesAtOnce: number;

  constructor(config: ComponentStatusEffectConfig) {
    super(config);
    this.componentAffected = config.component_affected;
    this.metricAffected = config.metric_affected;
    this.resolutionTicks = config.resolution_ticks;
    this.maxInstancesAtOnce = config.max_instances_at_once;
  }

  protected get targetId() {
    return this.componentAffected;
  }
  protected get impactedMetric() {
    return this.metricAffected;
  }
  protected get initialTurnsRemaining() {
    return this.resolutionTicks;
  }
}

export class TrafficStatusEffect extends BaseStatusEffect {
  type = 'traffic' as const;
  trafficAffected: string;
  configTurnsRemaining: number;

  constructor(config: TrafficStatusEffectConfig) {
    super(config);
    this.trafficAffected = config.traffic_affected;
    this.configTurnsRemaining = config.turnsRemaining;
    this.turnsRemaining = config.turnsRemaining;
  }

  protected get targetId() {
    return this.trafficAffected;
  }
  protected get impactedMetric() {
    return this.trafficAffected;
  }
  protected get initialTurnsRemaining() {
    return this.configTurnsRemaining;
  }
}

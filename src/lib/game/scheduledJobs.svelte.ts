import type {
  ScheduledJobConfig,
  StatusEffectTargetAttribute,
  StatusEffectTargetTraffic
} from './schema';
import type { TrafficHandler, SystemComponent } from './components/base.svelte';

export class ScheduledJob {
  name: string;
  targetName: string;
  interval: number;
  affectedAttributes: StatusEffectTargetAttribute[];
  emittedTraffic: StatusEffectTargetTraffic[];

  constructor(config: ScheduledJobConfig) {
    this.name = config.name;
    this.targetName = config.targetName;
    this.interval = config.schedule.interval;
    this.affectedAttributes = config.affectedAttributes;
    this.emittedTraffic = config.emittedTraffic;
  }

  /**
   * Returns true if the job should run on this tick.
   */
  shouldRun(tick: number): boolean {
    return tick > 0 && tick % this.interval === 0;
  }

  /**
   * Executes the job, applying attribute changes and emitting traffic.
   */
  run(handler: TrafficHandler, tick: number) {
    // 1. Emit traffic (Two-pass approach)
    // Pass 1: Record demand
    for (const traffic of this.emittedTraffic) {
      handler.recordDemand(traffic.name, traffic.value);
    }

    // Pass 2: Handle traffic
    for (const traffic of this.emittedTraffic) {
      handler.handleTraffic(traffic.name, traffic.value);
    }

    // 2. Affected attributes:
    // Find the target component in the engine (handler)
    const target = Object.values(handler.components).find(
      (c: SystemComponent) => c.name === this.targetName || c.id === this.targetName
    );

    if (target) {
      for (const effect of this.affectedAttributes) {
        const attr = target.attributes[effect.name];
        if (attr) {
          const targetProp = effect.target ?? 'limit';
          const baseValue = targetProp === 'limit' ? attr.limit : attr.current;

          const multiplierEffect = baseValue * (effect.multiplier ?? 0);
          const offsetEffect = effect.offset ?? 0;
          const newValue = Math.max(0, baseValue + multiplierEffect + offsetEffect);

          if (targetProp === 'limit') {
            attr.limit = newValue;
          } else {
            // Note: Attribute.update handles history, so we use it
            attr.update(newValue);
          }
        }
      }
    }
  }
}

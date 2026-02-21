import type {
  ScheduledJobConfig,
  StatusEffectTargetAttribute,
  StatusEffectTargetTraffic
} from './schema';
import type { TrafficHandler } from './components/base.svelte';

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
  run(handler: any, tick: number) {
    // 1. Emit traffic
    for (const traffic of this.emittedTraffic) {
      handler.handleTraffic(traffic.name, traffic.value);
    }

    // 2. Affected attributes:
    // Find the target component in the engine (handler)
    const target = Object.values(handler.components as Record<string, any>).find(
      (c: any) => c.name === this.targetName || c.id === this.targetName
    );

    if (target) {
      for (const effect of this.affectedAttributes) {
        const attr = target.attributes[effect.name];
        if (attr) {
          // Apply additive multiplier and/or static offset to the LIMIT
          const multiplierEffect = attr.limit * (effect.multiplier ?? 0);
          const offsetEffect = effect.offset ?? 0;
          attr.limit = attr.limit + multiplierEffect + offsetEffect;
        }
      }
    }
  }
}

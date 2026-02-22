import {
  ComputeNode,
  DatabaseNode,
  StorageNode,
  Traffic,
  type SystemComponent,
  type TrafficHandler
} from './models.svelte';
import type { LevelConfig, Ticket, TicketStatus } from './schema';
import {
  ComponentStatusEffect,
  TrafficStatusEffect,
  type StatusEffect
} from './statusEffects.svelte';
import { ScheduledJob } from './scheduledJobs.svelte';

export interface QueuedAction {
  id: string;
  componentId: string;
  attributeId: string;
  newValue: number;
  ticksRemaining: number;
  status: 'pending' | 'completed';
}

export class GameEngine implements TrafficHandler {
  tick = $state(0);
  isRunning = $state(false);
  budget = $state(2000); // Monthly operational budget

  components: Record<string, SystemComponent> = $state({});
  traffics: Record<string, Traffic> = $state({});
  statusEffects: StatusEffect[] = $state([]);
  scheduledJobs: ScheduledJob[] = $state([]);
  pendingActions = $state<QueuedAction[]>([]);
  tickets = $state<Ticket[]>([]);
  notifications = $state<
    { id: string; message: string; type: 'info' | 'error'; createdAt: number }[]
  >([]);

  currentLevelId = $state<string | null>(null);

  currentSpend = $derived(
    Object.values(this.components).reduce((sum, comp) => sum + comp.totalCost, 0)
  );

  activeComponentEffects = $derived.by(() => {
    const map: Record<string, ComponentStatusEffect[]> = {};
    for (const effect of this.statusEffects) {
      if (effect instanceof ComponentStatusEffect && effect.isActive) {
        if (!map[effect.componentAffected]) map[effect.componentAffected] = [];
        map[effect.componentAffected].push(effect);
      }
    }
    return map;
  });

  activeTrafficEffects = $derived.by(() => {
    const map: Record<string, TrafficStatusEffect[]> = {};
    for (const effect of this.statusEffects) {
      if (effect instanceof TrafficStatusEffect && effect.isActive) {
        if (!map[effect.trafficAffected]) map[effect.trafficAffected] = [];
        map[effect.trafficAffected].push(effect);
      }
    }
    return map;
  });

  private interval: ReturnType<typeof setInterval> | null = null;

  constructor() {}

  notify(message: string, type: 'info' | 'error' = 'info') {
    const id = Math.random().toString(36).substr(2, 9);
    this.notifications.push({ id, message, type, createdAt: this.tick });

    // Auto-remove notification after 5 seconds (5 ticks roughly)
    setTimeout(() => {
      this.notifications = this.notifications.filter((n) => n.id !== id);
    }, 5000);
  }

  getActiveComponentEffects(componentId: string): ComponentStatusEffect[] {
    return this.activeComponentEffects[componentId] || [];
  }

  getActiveTrafficEffects(trafficId: string): TrafficStatusEffect[] {
    return this.activeTrafficEffects[trafficId] || [];
  }

  /**
   * Loads a level from a configuration object.
   */
  loadLevel(config: LevelConfig) {
    this.stop();
    this.tick = 0;
    this.currentLevelId = config.id;
    this.components = {};
    this.traffics = {};
    this.statusEffects = [];
    this.scheduledJobs = (config.scheduledJobs || []).map((j) => new ScheduledJob(j));
    this.pendingActions = [];
    this.tickets = [];
    this.notifications = [];

    // Create components
    for (const compConfig of config.components) {
      let component: SystemComponent;
      switch (compConfig.type) {
        case 'compute':
          component = new ComputeNode(compConfig);
          break;
        case 'database':
          component = new DatabaseNode(compConfig);
          break;
        case 'storage':
          component = new StorageNode(compConfig);
          break;
        default:
          throw new Error(`Unknown component type: ${compConfig.type}`);
      }
      this.components[compConfig.id] = component;
    }

    // Create traffics
    for (const trafficConfig of config.traffics) {
      this.traffics[trafficConfig.name] = new Traffic(trafficConfig);
    }

    // Create status effects
    for (const seConfig of config.statusEffects) {
      if (seConfig.type === 'component') {
        this.statusEffects.push(new ComponentStatusEffect(seConfig));
      } else {
        this.statusEffects.push(new TrafficStatusEffect(seConfig));
      }
    }
  }

  /**
   * Pass 1: Recursive demand collection.
   */
  recordDemand(trafficName: string, value: number) {
    const traffic = this.traffics[trafficName];
    if (!traffic) return;

    const targetComponent = Object.values(this.components).find(
      (c) => c.name === traffic.targetComponentName
    );
    if (!targetComponent) return;

    targetComponent.recordDemand(trafficName, value, this);
  }

  /**
   * Main recursive entry point for handling traffic.
   * Returns successfulCalls
   */
  handleTraffic(
    trafficName: string,
    value: number
  ): { successfulVolume: number; averageLatency: number } {
    const traffic = this.traffics[trafficName];
    if (!traffic) {
      // If traffic definition is missing, assume it just works (to prevent deadlocks)
      return { successfulVolume: value, averageLatency: 0 };
    }

    const targetComponent = Object.values(this.components).find(
      (c) => c.name === traffic.targetComponentName
    );
    if (!targetComponent) {
      return { successfulVolume: 0, averageLatency: 0 }; // Black hole
    }

    return targetComponent.handleTraffic(trafficName, value, this);
  }

  queueAction(componentId: string, attributeId: string, newValue: number, latency: number) {
    this.pendingActions.push({
      id: Math.random().toString(36).substr(2, 9),
      componentId,
      attributeId,
      newValue,
      ticksRemaining: latency,
      status: 'pending'
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.interval = setInterval(() => this.update(), 1000);
  }

  stop() {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  update() {
    this.tick++;

    // 0. Reset Components for the new tick
    Object.values(this.components).forEach((comp) => comp.resetTick());

    // 1. Process Scheduled Jobs
    for (const job of this.scheduledJobs) {
      if (job.shouldRun(this.tick)) {
        job.run(this, this.tick);
      }
    }

    // 2. Update Status Effects (Materialization & Resolution)
    for (const effect of this.statusEffects) {
      effect.tick(this);
    }

    // 3. Process Pending Actions
    this.pendingActions.forEach((action) => {
      if (action.status === 'pending') {
        action.ticksRemaining--;
        if (action.ticksRemaining <= 0) {
          this.applyAction(action);
        }
      }
    });
    this.pendingActions = this.pendingActions.filter((a) => a.status === 'pending');

    // 4. PRE-PASS (Demand Pass): Calculate External Volumes and Record Demand
    // This phase identifies the total load hitting every component in the system
    // BEFORE any component decides to drop traffic.
    const externalWork: { traffic: Traffic; volume: number; base: number }[] = [];
    for (const traffic of Object.values(this.traffics)) {
      if (traffic.type === 'external') {
        const noise = Math.random() * traffic.baseVariance * 2 - traffic.baseVariance;
        // Use nominalValue as the fixed center point for noise
        const newBaseValue = Math.max(0, traffic.nominalValue + noise);

        let multiplierSum = 0;
        let offsetSum = 0;
        for (const effect of this.getActiveTrafficEffects(traffic.id)) {
          multiplierSum += effect.multiplier;
          offsetSum += effect.offset;
        }

        const currentVolume = Math.round(newBaseValue + newBaseValue * multiplierSum + offsetSum);
        externalWork.push({ traffic, volume: currentVolume, base: newBaseValue });

        // Pass 1: Recursive demand collection
        this.recordDemand(traffic.id, currentVolume);
      }
    }
    // 5. RESOLUTION-PASS: Process External Traffic with known total demand
    // Components will now use the demand recorded in Pass 4 to apply fair,
    // proportional success/failure rates to all competing traffic flows.
    for (const work of externalWork) {
      const { traffic, volume, base } = work;
      const result = this.handleTraffic(traffic.id, volume);
      const { successfulVolume, averageLatency } = result;
      const fail = volume - successfulVolume;

      // Update traffic history with the propagated latency
      traffic.update(base, volume, successfulVolume, fail, averageLatency);
    }

    // 6. Tick each component to finalize metrics and handle physics
    Object.values(this.components).forEach((comp) => {
      comp.tick(this);

      // Ticket generation: for each critical trigger
      for (const [alertName, severity] of Object.entries(comp.statusTriggers)) {
        if (severity === 'critical') {
          const alreadyHasOpenTicket = this.tickets.some(
            (t) => t.componentId === comp.id && t.alertName === alertName && t.status !== 'resolved'
          );

          if (!alreadyHasOpenTicket) {
            this.tickets.push({
              id: Math.random().toString(36).substr(2, 9),
              componentId: comp.id,
              alertName: alertName,
              title: `CRITICAL: ${comp.name} - ${alertName}`,
              description: `${comp.name} alert '${alertName}' is in a critical state. Investigate immediately.`,
              status: 'open',
              createdAt: this.tick,
              impactedMetric: alertName
            });
          }
        }
      }
      comp.lastStatus = comp.status;
    });
  }
  private applyAction(action: QueuedAction) {
    const component = this.components[action.componentId];
    if (component && component.attributes[action.attributeId]) {
      component.attributes[action.attributeId].limit = action.newValue;
    }
    action.status = 'completed';
  }
}

export const engine = new GameEngine();

import type { ComponentPhysicsConfig } from '../schema';
import { SystemComponent, type TrafficHandler } from './base.svelte';

export class QueueNode extends SystemComponent {
  type = 'queue';
  private totalSuccessfulOutgoing = 0;
  private totalAttemptedOutgoing = 0;
  private isPushing = false;

  protected getDefaultPhysics(): ComponentPhysicsConfig {
    return {
      latency_base_ms: 5
    };
  }

  preTick(handler: TrafficHandler) {
    const egressAttr = this.attributes.egress;
    const pushRate = egressAttr?.limit || 0;

    // Decoupled demand: We only register demand for our consumers.
    // We don't call super.recordDemand because that would try to register demand
    // for our own routes (which we will handle manually in processPush).
    if (pushRate > 0) {
      this.isPushing = true;
      for (const route of this.trafficRoutes) {
        for (const outgoing of route.outgoing_traffics) {
          handler.recordDemand(outgoing.name, pushRate);
        }
      }
      this.isPushing = false;
    }
  }

  protected calculateFailureRate(totalDemand: number): number {
    if (this.isPushing) return 0; // Internal push logic never fails itself

    const backlogAttr = this.attributes.backlog;
    const maxCapacity = backlogAttr?.limit || 0;
    const currentBacklog = backlogAttr?.current || 0;
    const egressAttr = this.attributes.egress;
    const pushRate = egressAttr?.limit || 0;

    // We can push up to pushRate, from either backlog or incoming demand
    const expectedPush = Math.min(pushRate, currentBacklog + totalDemand);
    const availableSpace = Math.max(0, maxCapacity - currentBacklog + expectedPush);

    if (totalDemand > availableSpace && totalDemand > 0) {
      return (totalDemand - availableSpace) / totalDemand;
    }
    return 0;
  }

  processPush(handler: TrafficHandler) {
    const backlogAttr = this.attributes.backlog;
    const egressAttr = this.attributes.egress;
    const pushRate = egressAttr?.limit || 0;
    const currentBacklog = backlogAttr?.current || 0;
    const incomingAccepted = this.localIncomingVolume - this.unsuccessfulTrafficVolume;

    // Attempted push rate is min(backlog + incoming, push_rate)
    const availableToPush = currentBacklog + incomingAccepted;
    const targetVolume = Math.min(pushRate, availableToPush);

    this.totalAttemptedOutgoing = targetVolume;
    let minSuccessful = targetVolume;

    if (targetVolume > 0) {
      this.isPushing = true;
      for (const route of this.trafficRoutes) {
        for (const outgoing of route.outgoing_traffics) {
          const result = handler.handleTraffic(outgoing.name, targetVolume);
          if (result.successfulVolume < minSuccessful) {
            minSuccessful = result.successfulVolume;
          }
        }
      }
      this.isPushing = false;
    } else {
      minSuccessful = 0;
    }

    this.totalSuccessfulOutgoing = minSuccessful;
  }

  tick(handler: TrafficHandler) {
    const backlogAttr = this.attributes.backlog;
    const maxCapacity = backlogAttr?.limit || 0;
    const currentBacklog = backlogAttr?.current || 0;
    const egressAttr = this.attributes.egress;
    const incomingAccepted = this.localIncomingVolume - this.unsuccessfulTrafficVolume;

    // We only remove SUCCESSFUL pushes from the backlog (guaranteed delivery)
    const newBacklogCount = Math.min(
      maxCapacity,
      Math.max(0, currentBacklog + incomingAccepted - this.totalSuccessfulOutgoing)
    );

    // Update attributes for UI display
    if (backlogAttr) backlogAttr.update(newBacklogCount);

    // Egress bar now shows ATTEMPTED volume (effort) vs capacity
    if (egressAttr) egressAttr.update(this.totalAttemptedOutgoing);

    if (this.metrics.current_message_count) {
      this.metrics.current_message_count.update(newBacklogCount);
    }
    if (this.metrics.incoming_message_count) {
      this.metrics.incoming_message_count.update(this.localIncomingVolume);
    }
    if (this.metrics.egress_failures) {
      this.metrics.egress_failures.update(
        this.totalAttemptedOutgoing - this.totalSuccessfulOutgoing
      );
    }
    if (this.metrics.large_fill_rate) {
      // 1 if backlog is growing, 0 otherwise
      this.metrics.large_fill_rate.update(
        this.totalSuccessfulOutgoing < this.localIncomingVolume ? 1 : 0
      );
    }
    if (this.metrics.error_rate) {
      const rate =
        this.localIncomingVolume > 0
          ? (this.unsuccessfulTrafficVolume / this.localIncomingVolume) * 100
          : 0;
      this.metrics.error_rate.update(rate);
    }

    this.statusTriggers = {};
    let newStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (this.totalSuccessfulOutgoing < this.localIncomingVolume) {
      this.statusTriggers['large_fill_rate'] = 'critical';
      newStatus = 'critical';
    }

    if (newBacklogCount >= maxCapacity && maxCapacity > 0) {
      this.statusTriggers['Queue Near Full'] = 'critical';
      newStatus = 'critical';
    }

    this.status = newStatus;

    if (this.alerts.length > 0) {
      const customTriggers = { ...this.statusTriggers };
      const customStatus = newStatus;

      this.checkAlerts();

      const priority: Record<'healthy' | 'warning' | 'critical', number> = {
        healthy: 0,
        warning: 1,
        critical: 2
      };
      if (priority[customStatus] > priority[this.status]) {
        this.status = customStatus;
      }
      Object.assign(this.statusTriggers, customTriggers);
    }
  }

  resetTick() {
    super.resetTick();
    this.totalSuccessfulOutgoing = 0;
    this.totalAttemptedOutgoing = 0;
  }
}

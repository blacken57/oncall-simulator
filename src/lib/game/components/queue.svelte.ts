import type { ComponentPhysicsConfig } from '../schema';
import { SystemComponent, type TrafficHandler } from './base.svelte';

/**
 * Async FIFO queue that decouples producers from consumers via a bounded backlog.
 *
 * Tick lifecycle ordering (must follow this sequence):
 *   1. `resetTick()` — clears all accumulators including outgoing counters.
 *   2. `preTick()` — pre-registers egress-rate demand on downstream consumers so they
 *      reserve capacity before Pass 1 begins.
 *   3. `recordDemand()` — accepts incoming demand but does NOT forward it downstream
 *      (the queue is a decoupling boundary).
 *   4. `handleTraffic()` — accepts messages into the backlog; drops if full.
 *   5. `processPush()` — drains up to `egress` messages per tick to downstream consumers;
 *      downstream failures are counted separately as `egress_failures`.
 *   6. `updateBacklogState()` — computes the new backlog depth from incomingAccepted and
 *      totalSuccessfulOutgoing; MUST run before `super.tick()` so metrics have accurate state.
 *   7. `tick()` → calls `updateBacklogState()` then delegates to `super.tick()` for
 *      standard metric and alert evaluation.
 */
export class QueueNode extends SystemComponent {
  type = 'queue';
  private totalSuccessfulOutgoing = 0;
  private totalAttemptedOutgoing = 0;

  // State set by updateBacklogState() and consumed by updateStandardMetrics / addCustomStatusTriggers
  private newBacklog = 0;

  protected getDefaultPhysics(): ComponentPhysicsConfig {
    return {
      latency_base_ms: 5
    };
  }

  preTick(handler: TrafficHandler) {
    const egressAttr = this.attributes.egress;
    const pushRate = egressAttr?.limit || 0;

    // Reserve demand for our full capacity to ensure fair resolution downstream.
    const targetPush = pushRate;

    if (targetPush > 0) {
      for (const route of this.trafficRoutes) {
        for (const outgoing of route.outgoing_traffics) {
          handler.recordDemand(outgoing.name, targetPush);
        }
      }
    }
  }

  recordDemand(trafficName: string, value: number, handler: TrafficHandler) {
    this.totalExpectedVolume += value;
    this.localExpectedVolume += value;
    // Do not forward demand, as this is a decoupled push queue
  }

  handleTraffic(
    trafficName: string,
    value: number,
    handler: TrafficHandler
  ): { successfulVolume: number; averageLatency: number } {
    this.incomingTrafficVolume += value;

    const failureRate = this.calculateFailureRate(this.totalExpectedVolume);
    const successfulVolume = Math.round(value * (1 - failureRate));

    const failed = value - successfulVolume;
    this.unsuccessfulTrafficVolume += failed;

    const route = this.trafficRoutes.find((r) => r.name === trafficName);
    const baseLatency = route?.base_latency_ms ?? 0;
    let localLatency = this.calculateLocalLatency(baseLatency, value);
    localLatency = this.applyLatencyEffects(localLatency, handler);

    if (successfulVolume > 0) {
      this.totalLatencySum += localLatency * successfulVolume;
      this.totalSuccessfulRequests += successfulVolume;
    }

    return { successfulVolume, averageLatency: localLatency };
  }

  protected calculateFailureRate(totalDemand: number): number {
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
    const incomingAccepted = this.incomingTrafficVolume - this.unsuccessfulTrafficVolume;

    // Attempted push rate is min(backlog + incoming, push_rate)
    const availableToPush = currentBacklog + incomingAccepted;
    const targetVolume = Math.min(pushRate, availableToPush);

    this.totalAttemptedOutgoing = targetVolume;
    let minSuccessful = targetVolume;

    if (targetVolume > 0 && this.trafficRoutes.length > 0) {
      for (const route of this.trafficRoutes) {
        for (const outgoing of route.outgoing_traffics) {
          const result = handler.handleTraffic(outgoing.name, targetVolume);
          if (result.successfulVolume < minSuccessful) {
            minSuccessful = result.successfulVolume;
          }
        }
      }
    } else {
      minSuccessful = 0;
    }

    this.totalSuccessfulOutgoing = minSuccessful;
  }

  /**
   * Computes the new backlog count and updates backlog/egress attributes for UI display.
   * Must run before super.tick() so the derived phases have accurate state.
   */
  private updateBacklogState(): void {
    const backlogAttr = this.attributes.backlog;
    const maxCapacity = backlogAttr?.limit || 0;
    const currentBacklog = backlogAttr?.current || 0;
    const egressAttr = this.attributes.egress;

    const incomingAccepted = this.incomingTrafficVolume - this.unsuccessfulTrafficVolume;

    // We only remove SUCCESSFUL pushes from the backlog (guaranteed delivery)
    this.newBacklog = Math.min(
      maxCapacity,
      Math.max(0, currentBacklog + incomingAccepted - this.totalSuccessfulOutgoing)
    );

    // Update attributes for UI display
    if (backlogAttr) backlogAttr.update(this.newBacklog);
    if (egressAttr) egressAttr.update(this.totalAttemptedOutgoing);
  }

  protected override updateStandardMetrics(_handler: TrafficHandler): void {
    if (this.metrics.current_message_count) {
      this.metrics.current_message_count.update(this.newBacklog);
    }
    if (this.metrics.incoming_message_count) {
      this.metrics.incoming_message_count.update(this.incomingTrafficVolume);
    }
    if (this.metrics.egress_failures) {
      this.metrics.egress_failures.update(
        this.totalAttemptedOutgoing - this.totalSuccessfulOutgoing
      );
    }
    if (this.metrics.large_fill_rate) {
      this.metrics.large_fill_rate.update(
        this.totalSuccessfulOutgoing < this.incomingTrafficVolume ? 1 : 0
      );
    }
    if (this.metrics.error_rate) {
      const rate =
        this.incomingTrafficVolume > 0
          ? (this.unsuccessfulTrafficVolume / this.incomingTrafficVolume) * 100
          : 0;
      this.metrics.error_rate.update(rate);
    }
  }

  protected override addCustomStatusTriggers(): void {
    const maxCapacity = this.attributes.backlog?.limit || 0;

    if (this.totalSuccessfulOutgoing < this.incomingTrafficVolume) {
      this.statusTriggers['large_fill_rate'] = 'critical';
    }
    if (this.newBacklog >= maxCapacity && maxCapacity > 0) {
      this.statusTriggers['Queue Near Full'] = 'critical';
    }
  }

  tick(handler: TrafficHandler): void {
    this.updateBacklogState();
    super.tick(handler);
  }

  resetTick() {
    super.resetTick();
    this.totalSuccessfulOutgoing = 0;
    this.totalAttemptedOutgoing = 0;
  }
}

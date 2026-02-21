# Future Plans: Oncall Simulator

This document tracks the roadmap and architectural direction for the Oncall Simulator.

## ✅ Completed (Recent Session)

- **Alert-Driven Incident System**: Refactored `status_thresholds` into a dedicated `alerts` schema. Supports `warning`, `critical`, and directional thresholds (`above`/`below`).
- **Automated Ticketing**: Implemented an automated Pager/Ticketing system. Tickets are now alert-specific and deduplicated by Component + Alert Name.
- **Persistent Issue Detection**: If a user manually resolves a ticket but the underlying critical condition persists, the system automatically re-opens/re-cuts a new ticket.
- **In-Place Telemetry Optimization**: Replaced memory-heavy array spreads with in-place mutations for all metric/attribute history, significantly reducing GC pressure.
- **Cycle Detection**: Added DFS-based validation to catch circular traffic dependencies during level loading.
- **Targeted Scheduled Jobs**: Fixed a bug where jobs only affected capacity (limits); they can now target current utilization (`value`) for things like cache clearing or log rotation.

## 1. Incident Management Side Effects (Next Priority)

- **Objective**: Make ticket status (Open vs. Investigating) have a material impact on the game state.
- **Reputation System (SLA)**: Introduce a "Reputation" metric (0-100). 
  - If a ticket remains `open` (unacknowledged) for more than N ticks, Reputation begins to drop.
  - Acknowledging (`investigating`) stops the reputation bleed but incurs a cost.
- **Investigation Costs**: Active investigations represent engineer time. Deduct a small amount from the budget per tick for every ticket in the `investigating` state.
- **The Observer Effect**: Hide certain "hidden" physics variables (like exact noise offsets or deep dependency health) until an engineer is actively `investigating` the relevant component.
- **Automatic Mitigation**: Some alerts could support "Acknowledge to Mitigate," where acknowledging the ticket automatically applies a temporary status effect (e.g., rate-limiting) to prevent a total crash.

## 2. Latency Control & Horizontal Scaling

- **Objective**: Introduce "Number of Instances" and "Queue Depth" to move beyond simple hardware limits.
- **Instances (Attribute)**: Implement horizontal scaling. Total Capacity = `instances * gcu_per_instance * factor`. This attribute should have a high `apply_delay` (provisioning time).
- **Queue Depth (Metric)**: Track requests waiting for a thread.
- **Wait Time Physics**: `Total Latency = Processing Time + (Queue Depth * Time Per Request)`.

## 3. Asynchronous Queue & Pub/Sub Simulation

- **Objective**: Model event-driven architectures where processing isn't instantaneous or blocking.
- **Guidance**: Create a `QueueNode`. Instead of returning success immediately in `handleTraffic`, the queue should store "Pending Work" and emit it as internal traffic in subsequent ticks based on a "Drain Rate."

## 4. Fail-Open & Optional Dependencies

- **Objective**: Handle non-critical dependencies (e.g., analytics, non-blocking logs).
- **Guidance**: Update `OutgoingTrafficConfig` with an `optional: boolean` flag. If `optional` is true, a failure in that dependency should not reduce the `successfulVolume` of the parent request.

## 5. Stability & Content Expansion

- **New Components**: Implement `LoadBalancer` (distributes traffic), `Cache` (latency-saving but subject to TTL/eviction), and `ThirdPartyAPI` (high latency, outside player control).

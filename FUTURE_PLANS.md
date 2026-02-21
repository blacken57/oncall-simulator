# Future Plans: Oncall Simulator

This document tracks the roadmap and architectural direction for the Oncall Simulator.

## ✅ Completed (Recent Session)

- **Data-Driven Physics**: Successfully decoupled component logic into `ComponentPhysicsConfig` and subclass defaults.
- **Two-Pass Traffic Resolution**: Implemented a demand pre-pass to ensure fair, proportional traffic distribution across multiple external flows.
- **Scheduled Periodic Jobs (Cron)**: Added `ScheduledJob` system to handle background tasks like Log Rotation at defined tick intervals.
- **Modular Refactoring**: Split `models.svelte.ts` into a clean component-based directory structure.
- **Additive Update Logic**: Standardized all multipliers and offsets to use the `current + (current * multiplier) + offset` formula.
- **Build-Time Level Validation**: Created a validator script and unit tests to ensure level config integrity (unique IDs, valid targets).
- **Per-Attribute Materialization Latency**: Added `apply_delay` to the schema, allowing attributes to take a defined number of ticks to update.
- **Additive Latency Propagation**: Implemented recursive latency summing (base route latency + dependency call latencies).

## 1. Latency Control & Horizontal Scaling (Next Priority)

- **Objective**: Introduce "Number of Instances" and "Queue Depth" to move beyond simple hardware limits.
- **Instances (Attribute)**: Implement horizontal scaling. Total Capacity = `instances * gcu_per_instance * factor`. This attribute should have a high `apply_delay` (provisioning time).
- **Queue Depth (Metric)**: Track requests waiting for a thread. 
- **Wait Time Physics**: `Total Latency = Processing Time + (Queue Depth * Time Per Request)`.
- **Vertical Software Scale**: Add "Worker Threads" attribute. More threads allow more concurrency but add a "Context Switching" latency penalty.

## 2. Asynchronous Queue & Pub/Sub Simulation

- **Objective**: Model event-driven architectures where processing isn't instantaneous or blocking.
- **Guidance**: Create a `QueueNode`. Instead of returning success immediately in `handleTraffic`, the queue should store "Pending Work" and emit it as internal traffic in subsequent ticks based on a "Drain Rate."
- **Code Pointers**:
  - `src/lib/game/components/queue.svelte.ts`: New `QueueNode` class.
  - `src/lib/game/engine.svelte.ts`: Update the `update()` loop to handle multi-tick "in-flight" traffic.

## 3. Fail-Open & Optional Dependencies

- **Objective**: Handle non-critical dependencies (e.g., analytics, non-blocking logs).
- **Guidance**: Update `OutgoingTrafficConfig` with an `optional: boolean` flag. If `optional` is true, a failure in that dependency should not reduce the `successfulVolume` of the parent request.
- **Code Pointers**:
  - `src/lib/game/schema.ts`: Add `optional` to `OutgoingTrafficConfig`.
  - `src/lib/game/components/base.svelte.ts`: Modify `handleTraffic` to skip success-volume reduction for optional dependencies.

## 4. Advanced Status Effects

- **Objective**: Deepen the "On-call" experience with complex outages.
- **Guidance**: Support "Target Filters" for effects (e.g., only affects traffic from `Service A` to `Service B`) and "Compound Effects" (e.g., a "Power Outage" that affects all components in a specific "Zone").
- **Code Pointers**:
  - `src/lib/game/statusEffects.svelte.ts`: Enhance `isActive` logic to support more complex materialization conditions.

## 5. Stability & Content Expansion

- **Objective**: Improve the "Player Onboarding" experience and variety.
- **Guidance**:
  - **New Components**: Implement `LoadBalancer` (distributes traffic), `Cache` (latency-saving but subject to TTL/eviction), and `ThirdPartyAPI` (high latency, outside player control).

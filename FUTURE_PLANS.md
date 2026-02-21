# Future Plans: Oncall Simulator

This document tracks the roadmap and architectural direction for the Oncall Simulator.

## ✅ Completed (Recent Session)
- **Data-Driven Physics**: Successfully decoupled component logic into `ComponentPhysicsConfig` and subclass defaults.
- **Two-Pass Traffic Resolution**: Implemented a demand pre-pass to ensure fair, proportional traffic distribution across multiple external flows.
- **Scheduled Periodic Jobs (Cron)**: Added `ScheduledJob` system to handle background tasks like Log Rotation at defined tick intervals.
- **Modular Refactoring**: Split `models.svelte.ts` into a clean component-based directory structure.

## 1. Asynchronous Queue & Pub/Sub Simulation
*   **Objective**: Model event-driven architectures where processing isn't instantaneous or blocking.
*   **Guidance**: Create a `QueueNode`. Instead of returning success immediately in `handleTraffic`, the queue should store "Pending Work" and emit it as internal traffic in subsequent ticks based on a "Drain Rate."
*   **Code Pointers**:
    - `src/lib/game/components/queue.svelte.ts`: New `QueueNode` class.
    - `src/lib/game/engine.svelte.ts`: Update the `update()` loop to handle multi-tick "in-flight" traffic.

## 2. Fail-Open & Optional Dependencies
*   **Objective**: Handle non-critical dependencies (e.g., analytics, non-blocking logs).
*   **Guidance**: Update `OutgoingTrafficConfig` with an `optional: boolean` flag. If `optional` is true, a failure in that dependency should not reduce the `successfulVolume` of the parent request.
*   **Code Pointers**:
    - `src/lib/game/schema.ts`: Add `optional` to `OutgoingTrafficConfig`.
    - `src/lib/game/components/base.svelte.ts`: Modify `handleTraffic` to skip success-volume reduction for optional dependencies.

## 3. Advanced Status Effects
*   **Objective**: Deepen the "On-call" experience with complex outages.
*   **Guidance**: Support "Target Filters" for effects (e.g., only affects traffic from `Service A` to `Service B`) and "Compound Effects" (e.g., a "Power Outage" that affects all components in a specific "Zone").
*   **Code Pointers**:
    - `src/lib/game/statusEffects.svelte.ts`: Enhance `isActive` logic to support more complex materialization conditions.

## 4. Stability & Content Expansion
*   **Objective**: Improve the "Player Onboarding" experience and variety.
*   **Guidance**: 
    - **New Components**: Implement `LoadBalancer` (distributes traffic), `Cache` (latency-saving but subject to TTL/eviction), and `ThirdPartyAPI` (high latency, outside player control).

# Future Plans: Oncall Simulator

This document tracks the roadmap and architectural direction for the Oncall Simulator.

## 1. Robust Component Configuration & Physics Engine
*   **Objective**: Decouple component behavior from hardcoded TypeScript classes to allow for data-driven physics.
*   **Guidance**: Move formulas (latency curves, error thresholds) into `LevelConfig`. Consider a "Functional Property" approach where a metric's value is derived from a defined expression (e.g., `latency = base + (utilization * factor)`).
*   **Code Pointers**: 
    - `src/lib/game/models.svelte.ts`: Refactor `ComputeNode`, `DatabaseNode`, and `StorageNode` to use configuration-based logic instead of hardcoded `tick()` overrides.
    - `src/lib/game/schema.ts`: Expand `ComponentConfig` to include physics parameters.

## 2. Asynchronous Queue & Pub/Sub Simulation
*   **Objective**: Model event-driven architectures where processing isn't instantaneous or blocking.
*   **Guidance**: Create a `QueueNode`. Instead of returning success immediately in `handleTraffic`, the queue should store "Pending Work" and emit it as internal traffic in subsequent ticks based on a "Drain Rate."
*   **Code Pointers**:
    - `src/lib/game/models.svelte.ts`: New `QueueNode` class.
    - `src/lib/game/engine.svelte.ts`: Update the `update()` loop to handle multi-tick "in-flight" traffic.

## 3. Fail-Open & Batch Requests
*   **Objective**: Handle non-critical dependencies (e.g., analytics, non-blocking logs).
*   **Guidance**: Update `OutgoingTrafficConfig` with an `optional: boolean` flag. If `optional` is true, a failure in that dependency should not reduce the `successfulVolume` of the parent request.
*   **Code Pointers**:
    - `src/lib/game/schema.ts`: Add `optional` to `OutgoingTrafficConfig`.
    - `src/lib/game/models.svelte.ts`: Modify `handleTraffic` to skip success-volume reduction for optional dependencies.

## 4. Scheduled Periodic Jobs (Cron)
*   **Objective**: Simulate background tasks like database cleanups, cache warming, or log rotation.
*   **Guidance**: Add a `periodicJobs` array to the `LevelConfig`. These jobs should trigger specific `MitigationActions` or internal traffic bursts at defined tick intervals.
*   **Code Pointers**:
    - `src/lib/game/engine.svelte.ts`: Add a `processPeriodicJobs()` method called during `update()`.

## 5. Stability & Content Expansion
*   **Objective**: Improve the "Player Onboarding" experience and variety.
*   **Guidance**: 
    - **Stabilize Base Case**: Adjust `src/data/level1.json` to have higher initial limits and lower noise. The "Standard Operations" level should be stable by default.
    - **New Components**: Implement `LoadBalancer` (distributes traffic), `Cache` (latency-saving but subject to TTL/eviction), and `ThirdPartyAPI` (high latency, outside player control).

## 6. Advanced Status Effects
*   **Objective**: Deepen the "On-call" experience with complex outages.
*   **Guidance**: Support "Target Filters" for effects (e.g., only affects traffic from `Service A` to `Service B`) and "Compound Effects" (e.g., a "Power Outage" that affects all components in a specific "Zone").
*   **Code Pointers**:
    - `src/lib/game/statusEffects.svelte.ts`: Enhance `isActive` logic to support more complex materialization conditions.

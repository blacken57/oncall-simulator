# GEMINI Context: Oncall Simulator

This file provides foundational context for the Oncall Simulator project to ensure continuity across sessions.

## 🏗️ Technical Architecture

- **Framework**: Svelte 5 with Runes (`$state`, `$derived`, `$effect`).
- **Core Engine**: `src/lib/game/engine.svelte.ts`. Manages a 1s/tick loop and a `pendingActions` queue for infrastructure latency.
- **Physics Engine**: `src/lib/game/components/`. Modular node implementations (`ComputeNode`, `DatabaseNode`, `StorageNode`) inheriting from `SystemComponent`.
- **Data-Driven**: Level config is loaded from `src/data/level1.json`, including a structured `physics` configuration for each component.

## 🔬 Simulation Physics (Key Logic)

- **Two-Pass Traffic Resolution**:
  - **Pass 1 (Demand Pass)**: Recursively calculates total expected volume across all nodes before any processing.
  - **Pass 2 (Resolution Pass)**: Applies a uniform `failureRate` based on total demand to all incoming flows, ensuring proportional and fair traffic distribution.
- **Sequential Short-circuiting**: If an upstream dependency fails, downstream dependencies in the same route are **not** called.
- **Additive Modifiers**: Status effects and scheduled jobs use a `value + (value * multiplier) + offset` formula for deterministic compounding.
- **Scheduled Jobs**: Background tasks (e.g., Log Rotation) that run on periodic tick intervals, affecting attributes or emitting internal traffic.
- **Stable Noise**: Noise is applied to `nominalValue` to prevent permanent random-walk drift over time.

## 📍 Key Files & Symbols

- `src/lib/game/components/base.svelte.ts`: Contains the `SystemComponent` base and two-pass logic.
- `src/lib/game/engine.svelte.ts`: Manages global `tick`, `budget`, and orchestrates the two-pass resolution.
- `src/lib/game/schema.ts`: Defines `ComponentPhysicsConfig` and `ScheduledJobConfig`.
- `src/lib/game/scheduledJobs.svelte.ts`: Handles execution of periodic background tasks.

## 🚀 Immediate Roadmap (Next Session)

1.  **Fail-Open Logic**: Support `optional: true` for non-critical dependencies (e.g., analytics).
2.  **QueueNode**: Implement a node to simulate pub/sub latency and background processing.
3.  **Advanced Status Effects**: Support route-specific filtering for more surgical outage scenarios.

## ⚠️ Known Constraints

- **Validation**: Always run `npm run check` after changing `handleTraffic` or `Metric` signatures.
- **Multipliers**: Be careful with recursive multipliers; they can lead to massive traffic volume spikes.
- **Memory**: The `Attribute` and `Metric` classes store 60 ticks of history.

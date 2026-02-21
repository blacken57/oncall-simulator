# GEMINI Context: Oncall Simulator

This file provides foundational context for the Oncall Simulator project to ensure continuity across sessions.

## 🏗️ Technical Architecture

- **Framework**: Svelte 5 with Runes (`$state`, `$derived`, `$effect`).
- **Core Engine**: `src/lib/game/engine.svelte.ts`. Manages a 1s/tick loop and a `pendingActions` queue for infrastructure latency (`apply_delay`).
- **Physics Engine**: `src/lib/game/components/`. Modular node implementations (`ComputeNode`, `DatabaseNode`, `StorageNode`) inheriting from `SystemComponent`.
- **Data-Driven**: Level config is loaded from `src/data/level1.json`, including structured `physics` and `apply_delay` parameters.
- **Verification**: Build-time level validator (`scripts/validate-levels.ts`) and Vitest suite (`tests/`).

## 🔬 Simulation Physics (Key Logic)

- **Two-Pass Traffic Resolution**:
  - **Pass 1 (Demand Pass)**: Recursively calculates total expected volume across all nodes before any processing.
  - **Pass 2 (Resolution Pass)**: Applies a uniform `failureRate` based on total demand to all incoming flows, ensuring proportional and fair traffic distribution.
- **Additive Latency Propagation**: Total Latency = `Base Route Latency + sum(Multiplier * Dependency Latency)`. Component-level utilization penalties are applied to the final result.
- **Additive Modifiers**: Status effects and scheduled jobs use a `value + (value * multiplier) + offset` formula.
- **Scheduled Jobs**: Background tasks (e.g., Log Rotation) that run on periodic tick intervals, affecting attribute limits or emitting internal traffic.
- **Stable Noise**: Noise is applied to `nominalValue` to prevent permanent random-walk drift over time.

## 📍 Key Files & Symbols

- `src/lib/game/components/base.svelte.ts`: Contains the `SystemComponent` base and two-pass logic.
- `src/lib/game/engine.svelte.ts`: Manages global `tick` and orchestrates the two-pass resolution.
- `src/lib/game/schema.ts`: Defines `ComponentPhysicsConfig`, `ScheduledJobConfig`, and `AttributeConfig`.
- `src/lib/game/validator.ts`: Logic for validating level configuration integrity.

## 🚀 Immediate Roadmap (Next Session)

1.  **Horizontal Scaling**: Implement `instances` attribute and `queue_depth` metrics.
2.  **Fail-Open Logic**: Support `optional: true` for non-critical dependencies.
3.  **QueueNode**: Implement a node to simulate pub/sub latency and background processing.

## ⚠️ Known Constraints

- **Validation**: Always run `npm run validate` before deploying or testing new levels.
- **Testing**: All core logic (Physics, Two-Pass, Validator) must have corresponding Vitest tests in `tests/`.
- **Formatting**: Project uses Prettier. **Always run `npm run format` before committing changes.**

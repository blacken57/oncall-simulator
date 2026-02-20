# GEMINI Context: Oncall Simulator

This file provides foundational context for the Oncall Simulator project to ensure continuity across sessions.

## 🏗️ Technical Architecture
- **Framework**: Svelte 5 with Runes (`$state`, `$derived`, `$effect`).
- **Core Engine**: `src/lib/game/engine.svelte.ts`. Manages a 1s/tick loop and a `pendingActions` queue for infrastructure latency.
- **Physics Engine**: `src/lib/game/models.svelte.ts`. Implements `SystemComponent` subclasses (`ComputeNode`, `DatabaseNode`, `StorageNode`).
- **Data-Driven**: Level config is loaded from `src/data/level1.json`.

## 🔬 Simulation Physics (Key Logic)
- **Recursive Traffic**: `handleTraffic(name, value)` propagates load from high-level APIs to low-level dependencies.
- **Sequential Short-circuiting**: If an upstream dependency fails, downstream dependencies in the same route are **not** called.
- **Failure Scaling**: Success/Failure rates are proportional to the worst-performing dependency in the critical path.
- **Hard Capacity Caps**: 
    - `DatabaseNode`: Success = `Math.min(incoming, connections.limit)`.
    - `ComputeNode`: Success = `Math.min(incoming, gcu.limit * 20)`.
- **Latency Curves**: Non-linear degradation starts at >80% utilization.

## 📍 Key Files & Symbols
- `src/lib/game/models.svelte.ts`: Contains the `handleTraffic` "physics" logic.
- `src/lib/game/engine.svelte.ts`: Manages global `tick`, `budget`, and `statusEffects`.
- `src/lib/game/schema.ts`: Defines the `LevelConfig` and `ComponentConfig` interfaces.
- `src/routes/+page.svelte`: The main dashboard entry point.

## 🚀 Immediate Roadmap (Next Session)
1.  **Data-Driven Physics**: Move hardcoded formulas (e.g., `GCU * 20`) into the `LevelConfig` JSON.
2.  **Async Queues**: Implement a `QueueNode` to simulate pub/sub latency and background processing.
3.  **Ticket System**: Re-enable the alert/ticket generation logic based on `error_rate` spikes.
4.  **Fail-Open Logic**: Support `optional: true` for non-critical dependencies (e.g., analytics).

## ⚠️ Known Constraints
- **Validation**: Always run `npm run check` after changing `handleTraffic` or `Metric` signatures.
- **Multipliers**: Be careful with recursive multipliers; they can lead to massive traffic volume spikes.
- **Memory**: The `Attribute` and `Metric` classes store 60 ticks of history; keep an eye on memory if adding many components.

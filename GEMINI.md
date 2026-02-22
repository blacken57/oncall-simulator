# GEMINI Context: Oncall Simulator

This file provides foundational context for the Oncall Simulator project to ensure continuity across sessions.

## 🏗️ Technical Architecture

- **Framework**: Svelte 5 with Runes (`$state`, `$derived`, `$effect`).
- **Routing**: Dynamic level loading via `src/routes/game/[levelId]/+page.svelte`. Landing page at `/`.
- **Core Engine**: `src/lib/game/engine.svelte.ts`. Manages a 1s/tick loop and automated ticket/incident lifecycle.
- **Physics Engine**: `src/lib/game/components/`. Modular node implementations (`ComputeNode`, `DatabaseNode`, `StorageNode`) inheriting from `SystemComponent`.
- **Data-Driven**: Level registry in `src/lib/game/levels.ts`. Configs in `src/data/*.json`.
- **Documentation**: Level-specific runbooks in `src/data/docs/[levelId]/*.md`.
- **Verification**: Build-time level validator (`src/lib/game/validator.ts`) with cycle detection and Vitest suite (`tests/`).

## 🔬 Simulation Physics (Key Logic)

- **Two-Pass Traffic Resolution**: Demand Pass (Pass 1) collects global load; Resolution Pass (Pass 2) applies fair, proportional failure rates based on total demand.
- **Additive Latency Propagation**: Total Latency = `Base Route Latency + sum(Multiplier * Dependency Latency)`. Component-level non-linear saturation penalties apply.
- **Alert-Driven Incidents**: Components evaluate `alerts` thresholds every tick. `critical` alerts generate unique tickets deduplicated by Alert Name.
- **Stable History**: Telemetry updates use in-place mutation to minimize GC churn while maintaining a sliding window (`maxHistory`).

## 📍 Key Files & Symbols

- `src/lib/game/levels.ts`: Level registry and helper functions.
- `src/lib/game/components/base.svelte.ts`: `SystemComponent` base, `checkAlerts()`, and two-pass logic.
- `src/lib/game/engine.svelte.ts`: `GameEngine` loop and ticket management logic.
- `src/lib/game/schema.ts`: Defines `AlertConfig`, `ComponentConfig`, and `LevelConfig`.
- `src/lib/game/validator.ts`: Logic for cycle detection and schema integrity.

## 🚀 Immediate Roadmap (Next Session)

1.  **Tutorial Expansion**: Add more interactive guidance to the tutorial level.
2.  **Incident Side Effects**: Implement "Reputation" (SLA) penalties for unacknowledged tickets and "Investigation Costs" for active ones.
3.  **Horizontal Scaling**: Support for `instances` attribute and `queue_depth` metrics.
4.  **Fail-Open Logic**: Support `optional: true` for non-critical dependencies.

## ⚠️ Known Constraints

- **Validation**: Always run `npm run validate` before deploying or testing new levels.
- **Testing**: All core logic (Physics, Two-Pass, Alerts, Validator) must have corresponding Vitest tests in `tests/`.
- **Formatting**: Project uses Prettier. **Always run `npm run format` before committing changes.**

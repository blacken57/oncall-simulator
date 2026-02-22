# GEMINI Context: Oncall Simulator

This file provides foundational context for the Oncall Simulator project to ensure continuity across sessions.

## 🏗️ Technical Architecture

- **Framework**: Svelte 5 with Runes (`$state`, `$derived`, `$effect`).
- **Routing**: Dynamic level loading via `src/routes/game/[levelId]/+page.svelte`. Landing page at `/`.
- **Core Engine**: `src/lib/game/engine.svelte.ts`. Manages a 1s/tick loop and automated ticket/incident lifecycle.
- **Physics Engine**: `src/lib/game/components/`. Modular node implementations (`ComputeNode`, `DatabaseNode`, `StorageNode`) inheriting from `SystemComponent`.
- **Status Effects**: Stochastic and scheduled effects (Traffic/Component) with a **Warning Phase** (pre-incident tickets) and an **Active Phase**.
- **Data-Driven**: Level registry in `src/lib/game/levels.ts`. Configs in `src/data/*.json`.
- **Documentation**: Level-specific runbooks in `src/data/docs/[levelId]/*.md`.
- **Verification**: Build-time level validator (`src/lib/game/validator.ts`) with cycle detection and Vitest suite (`tests/`).

## 🔬 Simulation Physics (Key Logic)

- **Two-Pass Traffic Resolution**: Demand Pass (Pass 1) collects global load; Resolution Pass (Pass 2) applies fair, proportional failure rates based on total demand.
- **Resilient Component Logic**: Components implement safety checks for missing metrics/attributes to prevent simulation crashes during partial level loads.
- **Additive Latency Propagation**: Total Latency = `Base Route Latency + sum(Multiplier * Dependency Latency)`. Component-level non-linear saturation penalties apply.
- **Alert-Driven Incidents**: Components evaluate `alerts` thresholds every tick. `critical` alerts generate unique tickets deduplicated by Alert Name.

## 📍 Key Files & Symbols

- `src/lib/game/levels.ts`: Level registry and helper functions.
- `src/lib/game/components/base.svelte.ts`: `SystemComponent` base, `checkAlerts()`, and two-pass logic.
- `src/lib/game/engine.svelte.ts`: `GameEngine` loop and ticket management logic.
- `src/lib/game/statusEffects.svelte.ts`: Logic for temporary system modifiers and warning triggers.
- `src/lib/game/schema.ts`: Defines `AlertConfig`, `ComponentConfig`, and `LevelConfig`.

## 🚀 Immediate Roadmap (Next Session)

1.  **New Component Types**: Implement `QueueNode` for asynchronous messaging and "backlog" physics.
2.  **Advanced Attributes**: Add `io_ops`, `bandwidth`, and `queue_depth` with corresponding saturation penalties.
3.  **Onboarding Experience**: Simplify new level creation and documentation auto-discovery.
4.  **Incident Side Effects**: Implement "Reputation" (SLA) penalties for unacknowledged tickets.
5.  **Robustness**: Expand the `negative.test.ts` suite to cover more edge cases in level configurations.

## ⚠️ Known Constraints

- **Validation**: Always run `npm run validate` before deploying or testing new levels.
- **Testing**: All core logic (Physics, Two-Pass, Alerts, Validator) must have corresponding Vitest tests in `tests/`.
- **Formatting**: Project uses Prettier. **Always run `npm run format` before committing changes.**

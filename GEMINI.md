# GEMINI Context: Oncall Simulator

This file provides foundational context for the Oncall Simulator project to ensure continuity across sessions.

## Technical Architecture

- **Framework**: Svelte 5 with Runes (`$state`, `$derived`, `$effect`).
- **Routing**: Dynamic level loading via `src/routes/game/[levelId]/+page.svelte`. Landing page at `/`.
- **Core Engine**: `src/lib/game/engine.svelte.ts`. Manages a 1s/tick loop and automated ticket/incident lifecycle.
- **Physics Engine**: `src/lib/game/components/`. Modular node implementations (`ComputeNode`, `DatabaseNode`, `StorageNode`, `QueueNode`) inheriting from `SystemComponent`.
- **Status Effects**: Stochastic and scheduled effects (Traffic/Component) with a **Warning Phase** (pre-incident tickets) and an **Active Phase**.
- **Data-Driven**: Level registry in `src/lib/game/levels.ts`. Configs in `src/data/*.json`.
- **Documentation**: Level-specific runbooks in `src/data/docs/[levelId]/*.md`.
- **Verification**: Build-time level validator (`src/lib/game/validator.ts`) with cycle detection, queue constraint checks, and Vitest suite (`tests/`).

## Simulation Physics (Key Logic)

- **8-Phase Tick Loop**: Reset → Scheduled Jobs → Status Effects → Pending Actions → preTick → Pass 1 (recordDemand) → Pass 2 (handleTraffic) → processPush (finalize metrics + alerts).
- **Two-Pass Traffic Resolution**: Demand Pass (Pass 1) collects global load; Resolution Pass (Pass 2) applies fair, proportional failure rates based on total demand vs. capacity.
- **Decoupled Queue Model**: `QueueNode` does not forward demand in Pass 1. Instead it accepts incoming traffic into a bounded backlog and drains at a configurable egress rate during the `processPush` phase. Egress failures are tracked separately from ingress failures.
- **Resilient Component Logic**: Components implement safety checks for missing metrics/attributes to prevent simulation crashes during partial level loads.
- **Additive Latency Propagation**: Total Latency = `Base Route Latency + sum(Multiplier × Dependency Latency)`. Component-level non-linear saturation penalties apply.
- **Alert-Driven Incidents**: Components evaluate `alerts` thresholds every tick. `critical` alerts generate unique tickets deduplicated by `(componentId, alertName)`.
- **ScheduledJob**: Periodic background tasks run at a fixed `interval`. Each job can mutate component attribute limits/values and inject internal traffic (participating in the two-pass system).
- **applyEffects()**: Pure function (`src/lib/game/base.svelte.ts`) that stacks multiplier+offset modifiers additively: `result = base + base * sum(multipliers) + sum(offsets)`.

## Key Files & Symbols

- `src/lib/game/levels.ts`: Level registry and helper functions.
- `src/lib/game/components/base.svelte.ts`: `SystemComponent` abstract base, `checkAlerts()`, and two-pass hooks.
- `src/lib/game/components/queue.svelte.ts`: `QueueNode` with `preTick()` and `processPush()` overrides.
- `src/lib/game/engine.svelte.ts`: `GameEngine` loop, `QueuedAction` system, and ticket management.
- `src/lib/game/statusEffects.svelte.ts`: `ComponentStatusEffect` / `TrafficStatusEffect` with warning → active → resolution lifecycle.
- `src/lib/game/scheduledJobs.svelte.ts`: `ScheduledJob` — periodic attribute mutation and internal traffic injection.
- `src/lib/game/base.svelte.ts`: `Attribute`, `Metric`, `Traffic`, and `applyEffects()`.
- `src/lib/game/schema.ts`: Defines `AlertConfig`, `ComponentConfig`, `ScheduledJobConfig`, `StatusEffectConfig`, and `LevelConfig`.
- `src/lib/game/validator.ts`: Pure validation function; runs at build time and in `engine.loadLevel()`.

## Immediate Roadmap (Next Session)

1. **CacheNode**: Redis/Memcached simulation with `hit_rate` metric. High hit rate reduces downstream DB traffic via multiplier. "Cache Stampede" StatusEffect when hit rate collapses.
2. **ExternalAPINode**: Fixed-latency external service (Stripe, Twilio). No player-controlled scaling; `requests_per_second` quota attribute; "API Rate Limit Hit" StatusEffect.
3. **Expanded Ticket Types**: `OnboardingRequest`, `QuotaIncreaseRequest`, `ChangeRequest` — each requiring a specific player action to resolve (new `category` + `action_required` fields on `Ticket`).
4. **Player JSON Level Editor**: In-browser textarea editor with live `validateLevel()` feedback; loads into `GameEngine.loadLevel()` via a `/sandbox` route.
5. **Property-Based Testing**: Use `fast-check` to fuzz level config generation through the validator and engine.

## Known Constraints

- **Validation**: Always run `npm run validate` before deploying or testing new levels.
- **Testing**: All core logic (Physics, Two-Pass, Alerts, Validator) must have corresponding Vitest tests in `tests/`.
- **Formatting**: Project uses Prettier with 100-char line width, single quotes, no trailing commas. **Always run `npm run format` before committing changes.**
- **Queue multipliers must be 1**: The validator rejects any `outgoing_traffics` entry on a `queue` component with `multiplier !== 1`.
- **Queue consumers must be compute or storage**: The validator rejects queue egress targeting `database` or `queue` component types.

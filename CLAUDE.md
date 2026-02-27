# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Validate level configs + build
npm run test         # Run Vitest test suite
npm run validate     # Run level config validation only
npm run check        # Type-check (svelte-check)
npm run format       # Prettier formatting
```

Run a single test file:

```bash
npx vitest run tests/ecommerce.test.ts
```

## Architecture

An educational game where players manage a distributed system under load. Built with Svelte 5 (runes), TypeScript, SvelteKit, deployed to Cloudflare Pages.

### Simulation Loop

`GameEngine` (`src/lib/game/engine.svelte.ts`) runs a 1-second tick loop with 6-phase resolution:

1. Reset components
2. Process scheduled jobs
3. Update status effects
4. Process pending infrastructure actions
5. **Pass 1** — `recordDemand()`: recursively calculate total intended traffic at each component
6. **Pass 2** — `handleTraffic()`: components compute proportional failure rates based on demand vs capacity, then propagate

The two-pass design is critical: it ensures failures are distributed fairly across all traffic flows rather than first-come-first-served.

### Component Hierarchy

`SystemComponent` (`src/lib/game/components/base.svelte.ts`) is the abstract base. Subclasses in `src/lib/game/components/`:

- `ComputeNode` — CPU/GCU-based capacity, 80% saturation threshold
- `DatabaseNode` — connection pool capacity, higher saturation penalties (4x at 90%+)
- `StorageNode` — blob/object storage, simpler latency model
- `QueueNode` — async FIFO queues with egress failure tracking

Each subclass implements `getDefaultPhysics()`, `calculateFailureRate()`, `calculateLocalLatency()`, and `tick()`.

### Reactive Primitives (`src/lib/game/base.svelte.ts`)

- `Attribute` — configurable infra property with `limit`, `current`, `utilization`, `cost`; supports `applyDelay` for delayed infra changes
- `Metric` — time-series value with 60-point history
- `Traffic` — models a flow with volume, success/failure history, variance/noise

All game state uses Svelte 5 runes (`$state`, `$derived`).

### Data-Driven Levels

Levels are JSON configs in `src/data/*.json`. `src/lib/game/schema.ts` defines the types; `src/lib/game/validator.ts` enforces integrity (unique IDs, valid targets, no traffic cycles, queue constraints). Validation runs at build time (`npm run validate`) and at load time inside `engine.loadLevel()`.

Level docs at `docs/LEVEL_CREATION.md`.

### Status Effects & Scheduled Jobs

- `ComponentStatusEffect` / `TrafficStatusEffect` (`src/lib/game/statusEffects.svelte.ts`) — temporary multiplier/offset modifiers with materialization → active → resolution lifecycle; can emit warning tickets before going active
- `ScheduledJob` (`src/lib/game/scheduledJobs.svelte.ts`) — periodic background tasks that modify attributes or emit internal traffic

### Incident Generation

Each component has `AlertConfig` entries with warning/critical thresholds. Every tick, `checkAlerts()` fires; critical alerts open tickets deduplicated by `(componentId, alertName)`. Tickets only regenerate if the alert remains critical after a previous ticket was resolved.

## Code Conventions

- Prettier: 100-char line width, single quotes, no trailing commas
- Strict TypeScript throughout
- `.svelte.ts` extension for files using Svelte runes outside components
- `src/lib/game/models.svelte.ts` is the public re-export barrel for game classes

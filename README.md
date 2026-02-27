# Oncall Simulator

An interactive simulation game where players step into the shoes of an oncall engineer. Manage high-traffic distributed systems, respond to urgent pages, diagnose performance bottlenecks using real-time dashboards, and resolve tickets while balancing operational costs and service health.

## Game Concept

As the oncall engineer, you are responsible for the health of a distributed system. For a deep dive into the underlying systems and simulation physics, see the [Design Document](oncall-simulator-design.md).

The game features:

- **Tickets Page**: A queue of incoming issues ranging from customer complaints to critical system failures.
- **Monitoring Dashboards**: Real-time graphs and metrics (Latency, Error Rate, CPU/RAM utilization) to diagnose issues.
- **Actions Interface**: Take corrective measures like scaling compute resources, adjusting database connection pools, or modifying queue throughput.
- **Latency-based Execution**: Actions aren't instantaneous — infrastructure changes take time to propagate, simulating real-world delays.
- **Budget Tracking**: Every resource has a cost. Scaling up might solve a performance issue but could blow your monthly budget.
- **Documentation**: Searchable internal docs to help you understand system architecture and standard operating procedures.

## Technical Architecture

Built with **Svelte 5**, the game leverages the **Runes** system (`$state`, `$derived`) for a highly reactive and performant engine. Deployed to Cloudflare Pages via SvelteKit.

### Simulation Architecture

The engine runs an 8-phase tick loop (1 second per tick):

1. **Reset** — all per-tick counters cleared
2. **Scheduled Jobs** — periodic background tasks fire (log rotation, data warehouse syncs, etc.)
3. **Status Effects** — stochastic incidents materialize or resolve
4. **Pending Actions** — queued infrastructure changes tick down and apply
5. **preTick** — components pre-register downstream demand (QueueNode reserves egress capacity)
6. **Pass 1 (Demand)** — `recordDemand()`: recursively totals intended traffic at every component
7. **Pass 2 (Resolution)** — `handleTraffic()`: components compute proportional failure rates, propagate results
8. **processPush** — QueueNode drains its backlog; component metrics finalized; alerts evaluated and tickets generated

The two-pass design ensures fair, proportional failure distribution across all competing traffic flows. See [LEVEL_CREATION.md](src/data/docs/custom/index.md) for a full explanation.

### Reactive Models

All simulation state uses Svelte 5 runes (`$state`, `$derived`):

- **`Attribute`** (`src/lib/game/base.svelte.ts`): Configurable infrastructure property with `limit`, `current`, `utilization`, and `cost`. Supports `apply_delay` for delayed changes.
- **`Metric`**: Time-series telemetry with 60-point rolling history, used for sparkline visualization.
- **`Traffic`**: Models a named flow with volume, success/failure history, and configurable noise.

**System Component types** (`src/lib/game/components/`):

- `ComputeNode` — CPU/GCU-based capacity; 80% saturation threshold with non-linear latency penalty
- `DatabaseNode` — Connection pool capacity; 4× penalty at 90%+ saturation
- `StorageNode` — Blob/object storage; fails completely if disk is 100% full
- `QueueNode` — Async FIFO queue; accepts ingress to a bounded backlog, drains at a configurable egress rate; tracks egress failures separately from ingress failures

**Additional primitives:**

- **`ScheduledJob`** (`src/lib/game/scheduledJobs.svelte.ts`): Periodic background tasks that mutate component attributes or inject traffic at fixed intervals (e.g., log rotation that fills a storage node every N ticks).
- **`StatusEffect`** (`src/lib/game/statusEffects.svelte.ts`): Stochastic or scripted incidents that apply temporary multiplier/offset modifiers to components or traffic flows. Supports a warning phase that gives players time to react before the effect goes active.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- npm (or your preferred package manager)

### Installation

```bash
git clone https://github.com/your-repo/oncall-simulator.git
cd oncall-simulator
npm install
```

### Development

```bash
npm run dev       # Start development server
npm run test      # Run Vitest test suite
npm run validate  # Validate level configs
npm run check     # TypeScript type-check
```

### Building

```bash
npm run build     # Validate level configs + production build
npm run preview   # Preview the production build
```

## Project Structure

- `src/lib/game/` — Core engine, reactive models, and component physics
  - `engine.svelte.ts` — `GameEngine` tick loop and ticket lifecycle
  - `components/` — `ComputeNode`, `DatabaseNode`, `StorageNode`, `QueueNode`
  - `base.svelte.ts` — `Attribute`, `Metric`, `Traffic`, `applyEffects()`
  - `schema.ts` — TypeScript types for all level config shapes
  - `validator.ts` — Build-time and load-time integrity checks (cycle detection, queue constraints, alert validation)
  - `statusEffects.svelte.ts` — `ComponentStatusEffect` / `TrafficStatusEffect`
  - `scheduledJobs.svelte.ts` — `ScheduledJob`
- `src/data/` — JSON level configurations (one file per level)
- `src/components/` — Reusable Svelte components for dashboards, tickets, and action panels
- `src/routes/` — SvelteKit pages (`/`, `/game/[levelId]`)
- `src/data/docs/custom/index.md` — [Guide for creating and configuring new levels](/custom/guide)

## Roadmap

See [FUTURE_PLANS.md](FUTURE_PLANS.md) for the full technical roadmap. Top priorities include new component types (`CacheNode`, `ExternalAPINode`), expanded ticket categories, and a player-facing level editor.

## License

This project is licensed under the MIT License.

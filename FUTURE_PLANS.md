# Future Plans: Oncall Simulator

This document tracks the roadmap and architectural direction for the Oncall Simulator.

## Completed (Recent Sessions)

- **Multi-Level Support**: Dynamic level loading with a dedicated Landing Page (`/`) and dynamic routing (`/game/[levelId]`).
- **Level Registry**: Centralized level management in `src/lib/game/levels.ts`.
- **Hierarchical Documentation**: Level-specific runbooks with auto-filtering based on the active level.
- **Resilient Engine**: Guarded the `update()` loop against empty or partially loaded states.
- **Component Robustness**: Components now handle missing attributes or metrics gracefully (Negative Testing).
- **Status Effect Warning Phase**: Stochastic and scripted events with a pre-incident warning ticket system (materialization → warning → active → resolution lifecycle).
- **Alert-Driven Incident System**: `AlertConfig` schema with `metric`, `direction`, `warning_threshold`, and `critical_threshold`. Tickets deduplicated by `(componentId, alertName)`.
- **Automated Ticketing**: Automated Pager/Ticketing system with `open` / `investigating` / `resolved` states.
- **Cycle Detection**: DFS-based validation catches circular traffic dependencies at load time.
- **QueueNode**: Async FIFO queue component with backlog physics, egress failure tracking, and a decoupled push model (`preTick`/`processPush` hooks). Validator enforces `multiplier === 1` and `consumer.type` must be `compute` or `storage`.
- **ScheduledJob System**: Periodic background tasks that mutate component attribute limits/values and inject internal traffic into the two-pass system at a fixed `interval`.
- **`applyEffects()` utility**: Pure additive stacking function for multiplier+offset effect chains (`result = base + base * sum(multipliers) + sum(offsets)`).
- **`resolution_ticks` schema field**: Controls how long a `ComponentStatusEffect` stays active before auto-resolving.

---

## 1. New Component Types (High Priority)

### CacheNode (Redis, Memcached)

- `hit_rate` metric derived from traffic and backlog state. When `hit_rate` is high, outgoing traffic to downstream database components is reduced via a configurable multiplier.
- Naturally participates in the existing two-pass system without engine changes.
- **"Cache Stampede" StatusEffect**: When `hit_rate` collapses (e.g., after a cache flush), a thundering herd floods the downstream database for N ticks.
- Player actions: `Warm Cache` (sets `hit_rate` to a target over N ticks), `Increase Cache Size` (scales limit).

### ExternalAPINode (Stripe, Twilio, SendGrid)

- Fixed external latency — no player-controlled scaling of the upstream service itself.
- `requests_per_second` quota attribute with a hard cap; exceeding it triggers "Rate Limit Hit" StatusEffect.
- Budget is charged per successful call volume each tick.
- **"API Degradation" StatusEffect**: Upstream service becomes slow or partially unavailable for N ticks.
- **"Rate Limit Hit" StatusEffect**: All traffic above quota is dropped until the next quota window.
- Player action: `Request Quota Increase` — has a simulated SLA delay and budget cost.

### DataWarehouseNode (Snowflake, BigQuery)

- High-latency analytic queries; slot-based concurrency pool.
- **"Warehouse Lock" StatusEffect**: A long-running query monopolises the concurrency pool, blocking all other queries for N ticks.
- Useful for teaching players to balance OLTP vs. OLAP workloads.

---

## 2. Expanded Ticket Types (High Priority)

Currently all tickets are alert-driven (threshold breach → ticket). New structured categories make incident management more varied:

- **`OnboardingRequest`**: Player must provision access/accounts via a new action type to resolve.
- **`QuotaIncreaseRequest`**: Player reviews and approves/denies an infrastructure quota increase (links to `ExternalAPINode` quota management); costs budget if approved.
- **`ChangeRequest`**: Player approves or rejects a proposed infra config change (e.g., increase DB connection pool limit); unapproved changes auto-revert after N ticks.

**Implementation approach:** Extend the `Ticket` schema with a `category` field (`'alert' | 'onboarding' | 'quota' | 'change'`) and an optional `action_required` payload. The Actions panel reads pending tickets and surfaces the required response controls for non-alert categories.

---

## 3. Resolution Action Expansion (Medium Priority)

New player-facing actions beyond attribute scaling:

- **`ExternalAPIQuotaIncrease`**: Raises an `ExternalAPINode`'s `requests_per_second` quota limit. Has a configurable SLA delay (simulating vendor response time) and a budget cost.
- **`CacheWarmup`**: Force-fills a `CacheNode`'s hit rate to a target value over N ticks. Useful after cache flush incidents.
- **`GracefulDegradation` toggle**: Mark an outgoing traffic dependency as `optional: true` in-flight (fail-open). Reduces error rate at the cost of degraded feature coverage. Requires extending `OutgoingTrafficConfig` with `optional?: boolean` and updating Pass 2 to treat failures from optional dependencies as non-fatal.

---

## 4. Player-Created Levels (Medium Priority)

Enable players (and level authors) to create and test levels without leaving the browser:

- **In-browser JSON editor**: Textarea-based editor with live `validateLevel()` feedback. Zero new backend required — validator is a pure TypeScript function that runs client-side.
- **"Test Drive" mode**: Load any valid JSON string directly into `GameEngine.loadLevel()` from the editor; scoped to a `/sandbox` route.
- **Level export**: Download the running game state as JSON so players can iterate from a live baseline.
- **Schema reference tab**: Auto-generated field reference rendered from `schema.ts` type comments (no codegen tooling needed — a simple render helper suffices).

---

## 5. Visual Level Builder (Long-Term)

Drag-and-drop canvas for level design:

- SVG canvas (already used for sparklines) where nodes are `SystemComponent` subtypes and edges are `Traffic` definitions.
- Wire components together by drawing edges; `multiplier` and `base_latency_ms` configurable on each edge in a sidebar.
- Export generates valid `LevelConfig` JSON ready to paste into the JSON editor (Section 4).
- Could reuse existing component icons and labels from the monitoring dashboard.

---

## 6. Synergistic Additions

These items complement the five priorities above and can be tackled incrementally:

### SLA / Reputation Score

- `reputation` metric (0–100) that decays when a critical ticket remains `open` for more than N ticks. Recovering requires resolving tickets.
- Can serve as a game-over condition or an end-of-level scoring factor.
- Uses existing `Ticket.status` and `Ticket.createdAt` fields — no schema changes needed.

### Horizontal Scaling (`instances` attribute)

- An `instances` attribute on `ComputeNode` that multiplies total capacity without changing per-unit physics.
- Load-balancer pattern: N instances each handle 1/N of traffic. Cheaper per-unit but requires more coordination overhead (small fixed latency penalty per added instance).

### Investigation / Observer Effect

- Tickets in `investigating` state reveal hidden metrics (e.g., `queue_depth`, per-route error breakdown) that are otherwise invisible in the dashboard.
- Makes active investigation mechanically rewarding, not just cosmetically different from `open`.

### Scenario Recipe Library

Curated `StatusEffect` templates for common distributed-systems failure modes:

- **"Thundering Herd"**: Cache miss storm → 10× DB load spike for N ticks.
- **"Hot Row"**: A single DB row becomes a hotspot → connection pool saturation.
- **"Noisy Neighbor"**: A shared `StorageNode` is monopolised by one high-volume traffic flow.
- **"Poison Pill"**: A specific traffic type causes a specific component to crash (failure rate → 100%).

### Property-Based Testing

- Use `fast-check` to generate random `LevelConfig` objects and run them through the validator and engine without crashing.
- Complements the existing Vitest suite in `tests/` and the negative-config test file.

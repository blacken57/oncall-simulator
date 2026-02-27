# Oncall Simulator - Design Document

## Overview

An "oncall simulator" game where players act as oncall engineers, managing tickets, monitoring dashboards, reading documentation, and responding to pages.

---

## Game Concept

### Player Tools

- **Tickets Page**: Queue of incoming issues to resolve. Individual alerts create unique tickets; structured tickets (quota requests, change requests) require specific player actions.
- **Monitoring Page**: Multiple dashboards with reactive graphs/metrics.
- **Actions Page**: Control panel to scale resources, restart services, and toggle configurations. Queued infrastructure changes display a visible latency countdown via the `QueuedAction` system.
- **Audit Log**: Chronological history of all player and system actions.
- **Budget/Score**: Real-time tracking of operational costs and Reputation (SLA).
- **Documentation Page**: Searchable docs containing troubleshooting steps and system architecture details.
- **Pager**: Urgent alerts that interrupt the player and require immediate attention.

## Simulation Physics

The core of the simulator is a reactive "physics" engine that governs how requests flow, fail, and degrade across the system.

### 1. Recursive Traffic Propagation

Traffic is modeled as a recursive tree. An "External" request enters a root component, which then generates "Internal" requests to its dependencies. Success is scaled bottom-up.

### 2. Two-Pass Traffic Resolution

- **Pass 1 (Demand Pass)**: Recursively calculates total intended volume (demand) for every component.
- **Pass 2 (Resolution Pass)**: Components calculate a fixed failure rate for the tick based on total demand vs. capacity.

### 3. Latency Propagation

Total Latency = `Base Latency + sum(Multiplier × Dependency Latency)`. Non-linear penalties apply when utilization exceeds a saturation threshold (typically 80%).

### 4. Alerting & Incident Management

Incident lifecycle is driven by the `alerts` configuration on each component:

- **Triggers**: Components evaluate metrics/attributes against `warning` and `critical` thresholds every tick. For attributes, `utilization %` is used instead of raw value.
- **Automated Paging**: A `critical` alert trigger generates a unique ticket.
- **Deduplication**: Tickets are unique to a `(componentId, alertName)` pair. A new ticket is not opened if one is already open for that pair.
- **Persistent State**: If a ticket is manually resolved while the underlying `critical` state still exists, a new ticket is generated on the next tick.

### 5. Asynchronous Queue Physics

`QueueNode` uses a decoupled push model that does not block ingress traffic in Pass 2:

- **Ingress**: Accepts incoming traffic (up to available backlog space). Traffic that cannot fit is dropped — this is the ingress failure rate.
- **Backlog**: A bounded buffer (`backlog` attribute). Messages accumulate here between acceptance and downstream delivery.
- **Egress**: During the `processPush` phase (after both traffic passes), the queue drains up to `egress` limit messages per tick and forwards them downstream via `handleTraffic`. Downstream failures are tracked as egress failures, separate from ingress failures.
- **preTick hook**: Before Pass 1, QueueNode calls `preTick()` to pre-register egress-rate demand on its downstream consumer, ensuring fair capacity reservation during the demand pass.

---

## Technical Architecture (High-Level)

### Svelte 5 Reactive Engine

The simulation is built using Svelte 5 **Runes** (`$state`, `$derived`) for high-performance reactivity. The engine runs on a deterministic 1-second tick.

### Core Systems

1. **Game Engine**: Orchestrates the 8-phase tick loop and ticket lifecycle (`src/lib/game/engine.svelte.ts`).
2. **Traffic Handler**: Manages recursive flows, two-pass resolution, and the `QueuedAction` infrastructure delay system.
3. **Status Effects**: Temporary or permanent performance modifiers with warning → active → resolution lifecycle (`src/lib/game/statusEffects.svelte.ts`).
4. **Scheduled Jobs**: Periodic background tasks that mutate component attributes or inject internal traffic at fixed intervals (`src/lib/game/scheduledJobs.svelte.ts`).
5. **Validator**: Build-time and load-time integrity checks, including cycle detection, queue constraints, and alert validation (`src/lib/game/validator.ts`).

---

## Current Roadmap

See [FUTURE_PLANS.md](FUTURE_PLANS.md) for the full technical roadmap. The three near-term priorities are:

- **New Component Types** (`CacheNode`, `ExternalAPINode`): Expand the simulation vocabulary with caching and third-party API physics.
- **Expanded Ticket Types**: Structured tickets (`OnboardingRequest`, `QuotaIncreaseRequest`, `ChangeRequest`) that require specific player actions to resolve.
- **Player JSON Level Editor**: In-browser level creation with live `validateLevel()` feedback and a `/sandbox` test-drive route.

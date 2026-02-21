# Oncall Simulator - Design Document

## Overview

An "oncall simulator" game where players act as oncall engineers, managing tickets, monitoring dashboards, reading documentation, and responding to pages.

---

## Game Concept

### Player Tools

- **Tickets Page**: Queue of incoming issues to resolve.
- **Monitoring Page**: Multiple dashboards with reactive graphs/metrics.
- **Actions Page**: Control panel to scale resources, restart services, and toggle configurations.
- **Audit Log**: Chronological history of all player and system actions.
- **Budget/Score**: Real-time tracking of operational costs and SLA status.
- **Documentation Page**: Searchable docs containing troubleshooting steps and system architecture details.
- **Pager**: Urgent alerts that interrupt the player and require immediate attention.

## Simulation Physics

The core of the simulator is a reactive "physics" engine that governs how requests flow, fail, and degrade across the system.

### 1. Recursive Traffic Propagation

Traffic is modeled as a recursive tree. An "External" request (e.g., `initiatePurchase`) enters a root component. That component then generates "Internal" requests to its defined dependencies (e.g., `db_queries`, `log_writes`).

- **Multipliers**: Dependencies can have multipliers (e.g., 1 Checkout = 5 Log Writes).
- **Success Scaling**: Success is calculated from the bottom up. If a dependency returns only 50% success, the parent component's success is capped proportionally.

### 2. Sequential Short-circuiting

To mimic real-world request chains, dependencies are processed **sequentially**.

- If a component requires `Auth` -> `Database` -> `Logging`, and `Database` is 100% down, the `Logging` service is **never called**.
- This provides a realistic "load-shedding" effect where a failure in a critical upstream service reduces the load on downstream services.

### 3. Two-Pass Traffic Resolution

To prevent "First-Come, First-Served" bias where the first processed traffic flow consumes all available capacity, the engine uses a two-pass resolution system:

- **Pass 1 (Demand Pass)**: Recursively calculates the total intended volume (demand) for every component in the system before any processing.
- **Pass 2 (Resolution Pass)**: Components use their total demand to calculate a fixed failure rate for the tick (e.g., `(Demand - Limit) / Demand`). This rate is applied proportionally to all incoming flows, ensuring that failures are shared fairly.

### 4. Hard Capacity & Saturation

Components enforce strict physical limits based on their attributes (GCU, Connections, Storage). If total demand exceeds capacity, the excess is dropped proportionally during the Resolution Pass.

### 5. Latency Propagation

Latency is cumulative and route-specific:

- **Base Latency**: Every traffic route has a `base_latency_ms`.
- **Dependency Addition**: Total Latency = `Base Latency + sum(Dependency Multiplier * Dependency Latency)`.
- **Utilization Friction**: Non-linear latency penalties are applied at the component level when utilization (e.g., GCU usage) exceeds a saturation threshold (typically 80%).

### 6. Additive Modifiers

Modifiers (Status Effects and Scheduled Jobs) apply changes using a standard additive formula:
`final_value = base_value + (base_value * multiplier) + offset`.
This allows multiple effects to compound predictably.

### 7. Cascading Failures

The system naturally demonstrates "Cascading Failures."

- _Scenario_: A heavy logging burst fills the `Log Block Storage`.
- _Result_: `Log Storage` success drops to 0% -> `Checkout Server` (which depends on logs) sees its success drop to 0% -> The user-facing "Success" metric on the dashboard crashes, even if the server itself is healthy.

---

## Technical Architecture (High-Level)

### Svelte 5 Reactive Engine

The simulation is built using Svelte 5 **Runes** (`$state`, `$derived`) for high-performance reactivity. The engine runs on a deterministic tick system (default 1 second per tick).

### Core Systems

1. **Game Engine**: Orchestrates the tick loop, manages global state, and processes the "Pending Action Queue" (simulating real-world infrastructure latency via `apply_delay`).
2. **Traffic Handler**: Manages recursive request flows and implements the Two-Pass resolution logic.
3. **Status Effects**: Implements temporary or permanent modifiers to system performance.
4. **Scheduled Jobs**: Handles background periodic tasks (e.g., Cron-like log rotation).

---

## Current Roadmap

See `FUTURE_PLANS.md` for detailed technical tasks including:

- **Horizontal Scaling**: Support for `instances` and `queue_depth` metrics.
- **Asynchronous Pub/Sub Queues**: Event-driven architecture simulation.
- **Fail-open Logic**: Optional dependencies handling.
- **Advanced Status Effects**: Surgical outages and target filters.

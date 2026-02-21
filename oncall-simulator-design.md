# Oncall Simulator - Design Document

## Overview

An "oncall simulator" game where players act as oncall engineers, managing tickets, monitoring dashboards, reading documentation, and responding to pages.

---

## Game Concept

### Player Tools

- **Tickets Page**: Queue of incoming issues to resolve. Individual alerts create unique tickets.
- **Monitoring Page**: Multiple dashboards with reactive graphs/metrics.
- **Actions Page**: Control panel to scale resources, restart services, and toggle configurations.
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
- **Pass 2 (Resolution Pass)**: Components calculate a fixed failure rate for the tick based on total demand vs capacity.

### 3. Latency Propagation

Total Latency = `Base Latency + sum(Multiplier * Dependency Latency)`. Non-linear penalties apply when utilization exceeds a saturation threshold (typically 80%).

### 4. Alerting & Incident Management

Incident lifecycle is driven by the `alerts` configuration:

- **Triggers**: Components evaluate metrics/attributes against `warning` and `critical` thresholds every tick.
- **Automated Paging**: A `critical` alert trigger generates a unique ticket.
- **Deduplication**: Tickets are unique to a `(Component, Alert)` pair. A new ticket will not be cut if one is already open for that specific alert.
- **Persistent State**: If a ticket is manually resolved while the underlying `critical` state still exists, a new ticket is generated in the next tick.

---

## Technical Architecture (High-Level)

### Svelte 5 Reactive Engine

The simulation is built using Svelte 5 **Runes** (`$state`, `$derived`) for high-performance reactivity. The engine runs on a deterministic 1-second tick.

### Core Systems

1. **Game Engine**: Orchestrates the tick loop and ticket lifecycle.
2. **Traffic Handler**: Manages recursive flows and two-pass resolution.
3. **Status Effects**: Temporary or permanent performance modifiers.
4. **Scheduled Jobs**: Periodic background tasks (e.g., Log Rotation).
5. **Validator**: Build-time and load-time integrity checks, including cycle detection.

---

## Current Roadmap

See `FUTURE_PLANS.md` for detailed technical tasks including:

- **Incident Side Effects**: Reputation/SLA penalties and Investigation costs.
- **Horizontal Scaling**: Support for `instances` and `queue_depth` metrics.
- **Asynchronous Queues**: Event-driven architecture simulation.
- **Fail-open Logic**: Optional dependencies handling.

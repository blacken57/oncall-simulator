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
Traffic is modeled as a recursive tree. An "External" request (e.g., `checkout_requests`) enters a root component. That component then generates "Internal" requests to its defined dependencies (e.g., `db_queries`, `log_writes`).
- **Multipliers**: Dependencies can have multipliers (e.g., 1 Checkout = 5 Log Writes).
- **Success Scaling**: Success is calculated from the bottom up. If a dependency returns only 50% success, the parent component's success is capped proportionally.

### 2. Sequential Short-circuiting
To mimic real-world request chains, dependencies are processed **sequentially**. 
- If a component requires `Auth` -> `Database` -> `Logging`, and `Database` is 100% down, the `Logging` service is **never called**.
- This provides a realistic "load-shedding" effect where a failure in a critical upstream service reduces the load on downstream services.

### 3. Hard Capacity & Saturation
Components enforce strict physical limits based on their attributes:
- **Compute (GCU)**: Each GCU has a fixed request-handling capacity. Requests exceeding `GCU * capacity_factor` are dropped.
- **Database (Connections)**: A 1:1 relationship between requests and connections. If `Incoming > Max Connections`, the excess requests fail immediately.
- **Storage**: A "leaky bucket" that fills over time. Once storage is 100% full, all incoming write requests fail.

### 4. Latency Degradation
Latency is not static. It follows a non-linear curve based on **Utilization**:
- **Healthy Range (0-80%)**: Latency remains near the baseline with minor variance.
- **Congestion Range (80-95%)**: Latency increases exponentially as the system struggles to context-switch or manage queue depths.
- **Saturation Range (>95%)**: Latency spikes dramatically, often leading to timeouts in upstream services.

### 5. Cascading Failures
The system naturally demonstrates "Cascading Failures." 
- *Scenario*: A heavy logging burst fills the `Log Block Storage`. 
- *Result*: `Log Storage` success drops to 0% -> `Checkout Server` (which depends on logs) sees its success drop to 0% -> The user-facing "Success" metric on the dashboard crashes, even if the `Checkout Server` GCU/RAM are perfectly healthy.


---

## Technical Architecture (High-Level)

### Svelte 5 Reactive Engine
The simulation is built using Svelte 5 **Runes** (`$state`, `$derived`) for high-performance reactivity. The engine runs on a deterministic tick system (default 1 second per tick).

### Core Systems
1. **Game Engine**: Orchestrates the tick loop, manages global state, and processes the "Pending Action Queue" (simulating real-world infrastructure latency).
2. **Traffic Handler**: Manages recursive request flows and implements **Sequential Short-circuiting** (if a primary dependency is 100% down, downstream dependencies are load-shed).
3. **Status Effects**: Implements temporary or permanent modifiers to system performance (e.g., "Viral Post" traffic spikes, "Database Throttling").

---

## Current Roadmap
See `FUTURE_PLANS.md` for detailed technical tasks and upcoming features including:
- Asynchronous Pub/Sub Queues.
- Robust Component Configuration Engine.
- Fail-open/Optional Dependencies.
- Scheduled Maintenance Jobs.

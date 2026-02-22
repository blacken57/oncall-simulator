# Future Plans: Oncall Simulator

This document tracks the roadmap and architectural direction for the Oncall Simulator.

## ✅ Completed (Recent Sessions)

- **Multi-Level Support**: Dynamic level loading with a dedicated Landing Page (`/`) and dynamic routing (`/game/[levelId]`).
- **Level Registry**: Centralized level management in `src/lib/game/levels.ts`.
- **Hierarchical Documentation**: Level-specific runbooks with auto-filtering based on the active level.
- **Resilient Engine**: Guarded the `update()` loop against empty or partially loaded states.
- **Component Robustness**: Components now handle missing attributes or metrics gracefully (Negative Testing).
- **Status Effect Warning Phase**: Implemented stochastic and scheduled events with a pre-incident warning ticket system.
- **Alert-Driven Incident System**: Refactored `status_thresholds` into a dedicated `alerts` schema.
- **Automated Ticketing**: Implemented an automated Pager/Ticketing system.
- **Cycle Detection**: Added DFS-based validation to catch circular traffic dependencies during level loading.

## 1. Asynchronous Infrastructure (High Priority)

- **Objective**: Model event-driven architectures where processing isn't instantaneous or blocking.
- **QueueNode**: A new component type for message queues (RabbitMQ, Kafka, SQS).
  - **Backlog Physics**: Stores "Pending Work" that isn't processed in the same tick.
  - **Drain Rate**: Processes a fixed or variable amount of work per tick based on consumer health.
  - **Dead Letter Queues**: Traffic that fails to be processed after N retries is sent to a separate `storage` component.
- **Retry Logic**: Support for components to retry failed dependency calls (with exponential backoff simulation).

## 2. Advanced Component Attributes & Metrics

- **Objective**: Increase the depth of the simulation physics.
- **New Attributes**:
  - `io_ops`: Disk input/output limits (critical for Database nodes).
  - `bandwidth`: Network throughput limits between components.
  - `concurrency`: Maximum simultaneous active threads.
- **Advanced Metrics**:
  - `queue_depth`: Number of requests waiting for a thread/resource.
  - `cache_hit_rate`: Effectiveness of a `CacheNode` (new component).
- **Wait Time Physics**: `Total Latency = Processing Time + (Queue Depth * Time Per Request)`.

## 3. Incident Management Side Effects

- **Objective**: Make ticket status (Open vs. Investigating) have a material impact on the game state.
- **Reputation System (SLA)**: Introduce a "Reputation" metric (0-100).
  - If a ticket remains `open` (unacknowledged) for more than N ticks, Reputation begins to drop.
- **Investigation Costs**: Active investigations represent engineer time. Deduct a small amount from the budget per tick for every ticket in the `investigating` state.
- **The Observer Effect**: Hide certain "hidden" physics variables until an engineer is actively `investigating` the relevant component.

## 4. Content & Onboarding

- **Objective**: Simplify level creation and expand the library of challenges.
- **Level Scaffolding**: Create a CLI tool or template for generating new level JSONs and documentation structures.
- **Scenario Library**:
  - "The Thundering Herd": A cache-miss storm level.
  - "The Poison Pill": A specific traffic type that crashes a specific component.
  - "The Regional Outage": A status effect that affects all components in a specific "Zone".
- **Dynamic Documentation**: Allow documentation to change based on the system state (e.g., "Emergency Runbooks" that appear only during critical incidents).

## 5. Testing & Validation

- **Objective**: Make the system harder to break.
- **Property-Based Testing**: Use a library like `fast-check` to generate random level configurations and ensure the engine doesn't crash.
- **Visual Regression**: Ensure the dashboard doesn't break when components have unusual names or a high number of metrics.

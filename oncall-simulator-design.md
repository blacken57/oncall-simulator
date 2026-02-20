# Oncall Simulator - Design Document

## Overview

An "oncall simulator" game where players act as oncall engineers, managing tickets, monitoring dashboards, reading documentation, and responding to pages - all while trying to resolve as many issues as possible.

---

## Game Concept

### Player Tools

- **Tickets Page**: Queue of incoming issues to resolve
- **Monitoring Page**: Multiple dashboards with graphs/metrics
- **Actions Page**: Interface to interact with system components and take corrective measures
- **Audit Log**: Chronological history of all actions taken and their results
- **Budget/Score**: Real-time tracking of operational costs and SLA status
- **Documentation Page**: Searchable docs to help solve issues
- **Pager**: Urgent alerts that interrupt the player

### Issue Types

All issues appear as a ticket. Some tickets are higher severity than others. For now, it is fine to just have two types of tickets. Urgent and Normal.
Each issue should have some hints as to how to solve it. The hints can appear as links to the documentation page(Can be implemented later).

- Urgent pages
- Customer onboarding problems
- System alerts
- Quota increase requests
- Mis-routed bugs (Later)
- Possible code errors (Later)

### Actions Page

The "control panel" of the game. It lists all system components and the actions available for each.

- **Component-Based**: Actions are grouped by service (e.g., `Auth Service`, `Payment Gateway`, `Compute Cluster`).
- **Constraints & Trade-offs**: Every action has limits.
    - *Example*: Scaling a compute instance has a max of 32GB RAM.
    - *Example*: Increasing GCU (Global Compute Units) too high might drop `utilization` metrics below a threshold, triggering "Under-utilization" alerts (wasting budget).
- **Latency & Ownership**: 
    - **Internal Components**: Quick response times for scaling/restarts.
    - **External/Partner Services**: (Items, Inventory, Payments, Fulfillment) Owned by other teams or 3rd parties. Actions like "Increase Quota" or "Adjust Payload Size" take significantly longer (e.g., 30-60 ticks). 
    - **"Cut a Ticket"**: If a partner service has high latency, the player must "Cut a Ticket" to that team, which has the highest latency but is the only way to resolve the upstream issue.
- **Financial Budget**: Every component has a "Running Cost." Scaling up or adding instances increases the "Monthly Burn Rate." Players must balance system health with cost efficiency.
- **Action Types**:
    - **Configuration**: Scaling RAM/CPU, adjusting timeouts.
    - **Lifecycle**: Restarting processes, killing "zombie" jobs, starting new instances.
    - **Administrative**: Approving quota requests, flushing caches, toggling feature flags.

### Future Architecture Components

As the game progresses (Levels 2+), the architecture expands to include external dependencies:

1. **Items Service**: Returns item details for checkout. *Attributes: QPS, Payload Size.*
2. **Inventory Service**: Validates item availability. *Attributes: QPS, Query Latency.*
3. **Payment Services**: External providers (Credit Cards, UPI, Bank). *Attributes: Success Rate, Provider Latency.*
4. **Fulfillment Service**: Asynchronous order processing. *Attributes: Queue Depth, Processing Throughput.*

### Core Challenge

Players must read documentation and use monitoring data to diagnose and resolve tickets correctly. Score is based on tickets resolved vs time.

---

## Technical Architecture

### Svelte 5 Reactive Models

The game state is built using Svelte 5 **Runes** (`$state`, `$derived`) inside TypeScript classes for a fully reactive, object-oriented engine.

#### Core Models (`models.svelte.ts`)

- **`Attribute`**: Manages a resource (e.g., RAM).
  - `limit`: Configured value (Set Value).
  - `current`: Real-time usage.
  - `history`: Array of last 60 readings for sparklines (Tracked reactively).
  - `utilization`: Calculated percentage.
- **`Metric`**: Tracks telemetry (e.g., Latency).
  - `value`: Current reading.
  - `history`: Array of last 60 readings for sparklines.
- **`SystemComponent`**: Base class for all services.
  - `tick(traffic, dependencies)`: Abstract method where "physics" is calculated.
  - `status`: Reactive health state (`healthy` | `warning` | `critical`).

#### Specialized Components

- **`ComputeNode`**: Scales GCU/RAM based on traffic; calculates P99 Latency.
- **`DatabaseNode`**: Manages connection pools, query latency, and proportional storage growth.
- **`StorageNode`**: Acts as a buffer that fills over time based on system traffic; tracks storage usage.

### Dashboard Visualization

The monitoring dashboard provides real-time observability:
- **Trend Graphs**: All attributes and metrics are visualized as auto-scaling sparklines.
- **Vertical Utilization Bars**: Prominent capacity indicators placed beside graphs for attributes with limits.
- **Fixed Scaling for Attributes**: Attribute graphs are scaled to the user-defined `limit` for clear capacity context.

### Tick-Based Game Loop

The game runs on a tick system where each tick updates the game state:

```
tick() {
  1. Calculate metrics from base + active status effects + randomness
  2. Evaluate metrics → trigger/duration internal status effects
  3. Random roll for new external status effects
  4. Cleanup expired effects (often based on user action)
  5. Spawn tickets based on metric anomalies
}
```

### Status Effects System

Status effects modify metrics and cascade into other issues:

#### External Status Effects (Randomized)

- `bank_api_error (+50% error_rate)`
- `viral_post (+200% traffic)`
- `competitor_down (+100% traffic)`
- `regional_outage (-availability in region)`
- `holiday_traffic (+150% baseline traffic)`

#### Internal Status Effects (Triggered by metrics)

- `cpu_throttled (-30% throughput)` - triggered when cpu > 80%
- `log_bucket_full (hides debugging info)` - triggered when disk > 90%
- `retry_storm (+500% queue_depth)` - triggered when error_rate > threshold
- `memory_pressure (-performance)` - triggered when memory > 85%
- `connection_pool_exhausted (-request capacity)`

### Metrics System

| Category | Metrics | Base Value |
|----------|---------|------------|
| Traffic | request_rate, concurrent_users | baseline |
| Performance | latency_p99, error_rate | baseline |
| Infrastructure | cpu, memory, disk_usage, queue_depth | baseline |
| Business | payment_success_rate, onboarding_completions | baseline |

### Metric Calculation per Tick

The below calculation will happen for all the metrics being tracked for every component

```
final_value = base_value 
            + sum(effect.modifier for effect in active_effects if effect.applies_to_metric)
            + random_noise(-variance, +variance)
```

### Cascading Events Example

```
bank_api_error (external, random)
    ↓
error_rate spikes (+50%)
    ↓
retry_storm triggered (internal, from high error_rate)
    ↓
queue_depth explodes (+500%)
    ↓
latency_p99 degrades
    ↓
cpu spikes from processing backlog
    ↓
cpu_throttled triggered (internal, cpu > 80%)
    ↓
throughput drops
    ↓
customer complaints ticket spawned
```

### Status Effect Properties

```typescript
interface StatusEffect {
  id: string
  name: string
  type: 'external' | 'internal'
  modifiers: {
    metricId: string
    operation: 'add' | 'multiply' | 'multiply_percent'
    value: number
  }[]
  duration: number | 'permanent' // ticks
  triggerCondition?: {
    metricId: string
    operator: '>' | '<' | '=='
    value: number
  }
  chance?: number // 0-1 for external effects
}
```

### Actions System

Actions are the primary way players interact with the game state. They modify base values of metrics or toggle status effects.

```typescript
### Actions System

Actions use a **Latency Queue** to simulate real-world delays. When an action is applied, it is added to a `pendingActions` queue in the Engine.

```typescript
interface QueuedAction {
  id: string;
  componentId: string;
  attributeId: string;
  newValue: number;
  ticksRemaining: number;
  status: 'pending' | 'completed';
}
```

- **Execution**: The Engine decrements `ticksRemaining` every tick.
- **Completion**: Once it reaches 0, the Engine updates the `limit` of the target `Attribute`.

### Ticket Generation

Tickets spawn based on:

1. Metric anomalies (error_rate > X)
2. Status effects active for too long
3. Combinations of issues (multiple status effects active)
4. Random customer reports

```typescript
interface Ticket {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  spawnedBy: string[] // metric ids or status effect ids
  resolution: {
    action: string
    requiredDocs: string[]
    requiredMetrics: string[]
  }
  timeToResolve: number
}
```

---

## MVP Features

### Must Have

1. **Ticket Queue**: Issues spawn over time, player clicks to view details
2. **Monitoring Dashboards**: Multiple graphs showing metric history
3. **Actions Page**: List of components and buttons/sliders to modify system state
4. **Audit Log**: Scrollable list of recent player actions and system events
5. **Budget & SLA Tracking**: Dashboard for financial spend and service availability
6. **Documentation**: Searchable/fake docs that help solve issues
7. **Pager**: Urgent interruptions requiring immediate attention
8. **Score Tracking**: Tickets resolved, time, accuracy

### Nice to Have

- Multiple services/systems to monitor
- Different difficulty levels
- Incident retrospectives
- Learning mode with hints
- Leaderboards

---

## Tech Stack Options

### Option 1: Svelte + Vite (Recommended)

```
- Vite (bundler)
- Svelte 5 (new runes reactivity)
- Tailwind CSS (styling)
- Recharts or @sveltejs/plot (graphs)
- No backend (all client-side)
```

**Why Svelte:**

- Built-in reactive stores - perfect for tick-based game logic
- Less boilerplate than React for state updates
- Automatic UI updates when state changes
- Faster runtime (compiled, not virtual DOM)
- Svelte 5 runes (`$state`, `$derived`) are ideal for game state

### Option 2: React + Vite

```
- Vite (bundler)
- React 18
- Zustand (state management)
- Tailwind CSS (styling)
- Recharts (graphs)
```

**When to choose:**

- Team is more familiar with React
- Need larger ecosystem/support

### Option 3: Vue + Vite

```
- Vite (bundler)
- Vue 3
- Pinia (state management)
- Tailwind CSS (styling)
- Chart.js (graphs)
```

---

## Project Structure

```
src/
├── lib/
│   ├── game/
│   │   ├── engine.svelte.ts # Tick loop, global state
│   │   ├── models.svelte.ts # Attribute, Metric, Component classes
│   │   ├── metrics.ts       # Scenario definitions
│   │   ├── statusEffects.ts # Status effect definitions
│   │   ├── tickets.ts       # Ticket generation & management
│   │   └── events.ts        # Random event spawning
│   └── utils/
│       └── random.ts        # Weighted randomness, etc.
├── components/
│   ├── Dashboard/
│   │   ├── Graph.svelte
│   │   ├── MetricCard.svelte
│   │   └── DashboardLayout.svelte
│   ├── Actions/
│   │   ├── ComponentList.svelte
│   │   ├── ActionButton.svelte
│   │   ├── ConfigSlider.svelte
│   │   └── AuditLog.svelte
│   ├── Tickets/
│   │   ├── TicketQueue.svelte
│   │   └── TicketDetail.svelte
│   ├── Docs/
│   │   ├── DocBrowser.svelte
│   │   └── DocSearch.svelte
│   ├── Pager/
│   │   └── PagerAlert.svelte
│   └── Game/
│       ├── GameControls.svelte
│       └── ScoreDisplay.svelte
├── stores/
│   └── gameStore.ts         # Svelte stores / Zustand store
├── data/
│   ├── docs.json            # Fake documentation content
│   ├── statusEffects.json   # Status effect definitions
│   └── tickets.json         # Ticket templates
└── routes/
    ├── +page.svelte         # Main game
    └── +layout.svelte       # App layout
```

---

## Next Steps

1. [x] Initialize project with Svelte 5 + Vite
2. [x] Build core game engine (tick loop, OO state)
3. [x] Implement metrics system with base attributes/usage
4. [x] Build dashboard with SVG sparklines and vertical utilization bars
5. [x] Implement Actions system with latency and budget
6. [x] Refactor core components and logic (Rename Checkout Server, Fix Storage growth)
7. [ ] Add status effects that modify metrics
8. [ ] Add ticket spawning logic
9. [ ] Create documentation content
10. [ ] Implement ticket resolution flow
11. [ ] Add pager alerts
12. [ ] Polish UI and add scoring

---

## Open Questions

- [ ] Tick speed: Real-time (e.g., 1 tick/second) or turn-based?
- [ ] Difficulty progression: Does game get harder over time?
- [ ] Scope: Single service or multiple interconnected services?
- [ ] Resolution mechanics: Multi-choice? Free text? Click-to-fix?
- [ ] Win/lose conditions: Time-limit? Incident-free streak? Score threshold?


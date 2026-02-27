# Level Configuration Guide

This guide explains how to design and implement new levels for the Oncall Simulator. Levels are defined as JSON files in `src/data/` and registered in `src/lib/game/levels.ts`.

---

## Core Concepts

### 1. The Two-Pass Traffic System

The simulation uses a two-pass system to ensure fair traffic distribution:

- **Demand Pass (Pass 1):** Every component calculates the total intended traffic it will receive.
- **Resolution Pass (Pass 2):** Every component uses its total demand to calculate a failure rate. This rate is applied proportionally to all incoming flows.

**Rule of Thumb:** Any source of traffic (StatusEffect emitted traffic, ScheduledJob emitted traffic) must participate in both passes to avoid breaking saturation physics. The engine handles this automatically for external traffic and scheduled jobs; follow the same two-pass pattern if you extend the engine.

### 2. Component Types

#### Compute (`compute`)

General-purpose nodes (APIs, workers, processors). Capacity is tied to a primary attribute (usually `gcu` or `cpu`). Non-linear latency penalty kicks in above the `saturation_threshold_percent` (default 80%).

```json
{
  "id": "api-gateway",
  "name": "API Gateway",
  "type": "compute",
  "physics": {
    "request_capacity_per_unit": 20,
    "latency_base_ms": 5,
    "saturation_threshold_percent": 80,
    "saturation_penalty_factor": 0.5
  },
  "attributes": {
    "gcu": {
      "name": "Compute Units",
      "unit": "C",
      "initialLimit": 10,
      "minLimit": 1,
      "maxLimit": 100,
      "costPerUnit": 10
    }
  },
  "metrics": {
    "incoming": { "name": "Requests", "unit": "req/s" },
    "latency": { "name": "Latency", "unit": "ms" },
    "error_rate": { "name": "Errors", "unit": "%" }
  },
  "traffic_routes": [
    {
      "name": "webRequest",
      "base_latency_ms": 5,
      "outgoing_traffics": [{ "name": "dbQuery", "multiplier": 2 }]
    }
  ]
}
```

#### Database (`database`)

High connection-pool capacity; 4× latency penalty at 90%+ saturation. Metrics focus on `query_latency` and `connections`.

#### Storage (`storage`)

Tracks cumulative disk usage via a `storage_usage` attribute. Has no request rate limit but fails completely once the disk is 100% full. Suitable for modelling blob stores, log buckets, or write-heavy sinks.

#### Queue (`queue`)

Async FIFO queues that decouple producers from consumers. Incoming traffic is accepted into a bounded backlog and drained each tick at the egress rate. See Section 4 for a full explanation and the validator constraints.

#### External API (`external_api`)

Models third-party service dependencies (payment processors, mapping APIs, identity providers). Unlike compute nodes, latency is **load-independent** — it reflects the remote service's response time, not local CPU saturation. Degradation is modelled exclusively via `ComponentStatusEffect` (e.g., "Payment Gateway Slow").

Key conventions:

- The primary attribute is `quota_rps` — the rate-limit imposed by the third-party. Requests above this rate fail with a quota error.
- `noise_factor` should be high (5–20) to reflect the unpredictability of external networks.
- Do not set `saturation_penalty_factor`; external API latency doesn't follow the same saturation curve as internal services.

```json
{
  "id": "payment-gateway",
  "name": "Payment Gateway",
  "type": "external_api",
  "physics": {
    "latency_base_ms": 200,
    "noise_factor": 15
  },
  "attributes": {
    "quota_rps": {
      "name": "API Quota",
      "unit": "req/s",
      "initialLimit": 100,
      "minLimit": 10,
      "maxLimit": 500,
      "costPerUnit": 5
    }
  },
  "metrics": {
    "latency": { "name": "Response Time", "unit": "ms" },
    "error_rate": { "name": "Errors", "unit": "%" }
  }
}
```

---

### 3. Component Physics

Physics constants control how a component behaves under load:

```json
"physics": {
  "request_capacity_per_unit": 20,
  "latency_base_ms": 5,
  "latency_load_factor": 0.05,
  "saturation_threshold_percent": 80,
  "saturation_penalty_factor": 0.5,
  "noise_factor": 0.1
}
```

| Field                          | Description                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `request_capacity_per_unit`    | Requests/sec supported by 1 unit of the primary attribute                                                                                       |
| `latency_base_ms`              | Baseline processing time                                                                                                                        |
| `latency_load_factor`          | Extra ms per request above baseline                                                                                                             |
| `saturation_threshold_percent` | Utilization % where non-linear latency begins                                                                                                   |
| `saturation_penalty_factor`    | How sharply latency spikes above the threshold. See note below.                                                                                 |
| `noise_factor`                 | Random variance: `(Math.random() - 0.5) × 2 × noise_factor` (centred, symmetric). Typical: 0.5–2 for internal services, 5–20 for external APIs. |

---

### Defaults Reference

| Field                      | Default if omitted                                  |
| -------------------------- | --------------------------------------------------- |
| `base_variance`            | 5                                                   |
| `apply_delay`              | 5 ticks                                             |
| `noise_factor`             | compute: 0.5, database: 2, external_api: 10         |
| `status_effect.multiplier` | 0 (no multiplicative change; only `offset` applies) |
| `status_effect.offset`     | 0                                                   |

---

### 4. QueueNode

`QueueNode` models message queues (SQS, RabbitMQ, Kafka). Unlike compute/database/storage, it uses a **decoupled push model**:

**How it works:**

1. **Ingress (Pass 2)**: Incoming traffic is accepted (or dropped if the backlog is full). No downstream calls are made during this phase.
2. **preTick**: Before the demand pass, the queue pre-registers egress-rate demand on its downstream consumer to reserve capacity.
3. **processPush** (after Pass 2): The queue drains up to `egress` messages per tick from the backlog and forwards them downstream via `handleTraffic`. Downstream failures are counted as egress failures, separate from ingress drop rate.

**Attributes required:**

| Attribute key | Purpose                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `backlog`     | Maximum buffered messages. `limit` is the cap; `current` tracks fill level. |
| `egress`      | Maximum messages drained and forwarded per tick.                            |

**Validator constraints (hard errors):**

- Every `outgoing_traffics` entry on a queue **must** have `multiplier: 1`. The queue forwards at its egress rate, not a multiple of it.
- The consumer component targeted by queue egress traffic **must** be of type `compute` or `storage`. Targeting a `database` or another `queue` is rejected.

**Minimal JSON snippet:**

```json
{
  "id": "work-queue",
  "name": "Work Queue",
  "type": "queue",
  "attributes": {
    "backlog": {
      "name": "Backlog",
      "unit": "msg",
      "initialLimit": 5000,
      "minLimit": 100,
      "maxLimit": 50000,
      "costPerUnit": 0.01
    },
    "egress": {
      "name": "Egress Rate",
      "unit": "msg/s",
      "initialLimit": 100,
      "minLimit": 10,
      "maxLimit": 1000,
      "costPerUnit": 1
    }
  },
  "metrics": {
    "incoming_message_count": { "name": "Ingress", "unit": "msg/s" },
    "current_message_count": { "name": "Backlog Depth", "unit": "msg" },
    "egress_failures": { "name": "Egress Failures", "unit": "msg/s" },
    "error_rate": { "name": "Drop Rate", "unit": "%" }
  },
  "traffic_routes": [
    {
      "name": "enqueueJob",
      "outgoing_traffics": [{ "name": "processJob", "multiplier": 1 }]
    }
  ]
}
```

---

## Configuration Schema

### Traffic Routes

Traffic is "pulled" through components via named routes:

- **Internal Traffic**: Must be defined in the global `traffics` list and emitted by an `outgoing_traffics` entry in a route or by a `ScheduledJob`.
- **Multipliers**: If a service calls a DB twice per request, set `multiplier: 2` (not valid on queues).
- **`base_latency_ms`**: Optional per-route processing overhead added to the component's base latency.

---

## Step-by-Step Level Creation

1. **Draft the Architecture**: Map out your services and their dependencies. Decide which component type fits each node.
2. **Define Attributes**: Decide what the player can scale (CPU, RAM, Connections, Backlog, Egress Rate).
3. **Set Baselines**: Ensure `initialLimit × request_capacity_per_unit` is greater than the incoming external traffic volume at game start.
4. **Add Status Effects**: Create scripted incidents using `statusEffects`. Use `warning_config` to give players a chance to react before the metrics spike.
5. **Validate**: Run `npm run validate` to check for circular dependencies, missing traffic definitions, or queue constraint violations.
6. **Define ScheduledJobs**: Add periodic background load (e.g., log rotation filling a storage node, a nightly batch job consuming queue egress). See Section 5.
7. **Configure StatusEffects**: Script the incidents that make the level challenging. See Section 6.
8. **Tune AlertConfigs**: Add `alerts` to each component so that `warning` fires well before `critical`, giving players reaction time. See Section 7.

---

## 5. ScheduledJob

`ScheduledJob` entries model periodic background tasks that run every N ticks (e.g., log rotation, batch data exports, nightly reindexing).

**How it works:**

- On every tick where `tick % interval === 0`, the job fires.
- It can **mutate attributes** (e.g., increment storage fill level) and/or **emit internal traffic** (injected into the two-pass system — demand is recorded first, then handled).

**Attribute mutation formula:**

```
newValue = max(0, base + base * multiplier + offset)
```

where `base` is the current `limit` (if `target` is omitted or `'limit'`) or the current `current` value (if `target` is `'value'`).

**Schema fields:**

```json
{
  "name": "log-rotation",
  "targetName": "Log Storage",
  "schedule": { "interval": 10 },
  "affectedAttributes": [
    {
      "name": "storage_usage",
      "target": "value",
      "offset": 500
    }
  ],
  "emittedTraffic": [{ "name": "logWrite", "value": 50 }]
}
```

| Field                             | Description                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `name`                            | Unique identifier for the job                                                |
| `targetName`                      | Component `name` or `id` that owns the affected attributes                   |
| `schedule.interval`               | Fire every N ticks                                                           |
| `affectedAttributes[].name`       | Attribute key within the target component                                    |
| `affectedAttributes[].target`     | `'limit'` (default) to change capacity, or `'value'` to change current usage |
| `affectedAttributes[].multiplier` | Relative change (e.g., `0.1` = +10% per firing). Defaults to `0`.            |
| `affectedAttributes[].offset`     | Absolute delta (e.g., `500` = +500 per firing). Defaults to `0`.             |
| `emittedTraffic[].name`           | Internal traffic name (must exist in the global `traffics` list)             |
| `emittedTraffic[].value`          | Volume emitted per firing                                                    |

---

## 6. StatusEffect

StatusEffects are stochastic incidents that temporarily modify component metrics or traffic volumes.

**Lifecycle:**

1. **Dormant**: Each tick, the effect rolls `materialization_probability`. If it fires:
   - If `warning_config` is set → enters **Warning** phase (opens a warning ticket and waits `delay_ticks` before going active).
   - Otherwise → immediately enters **Active** phase.
2. **Active**: The multiplier/offset is applied every tick. If `resolution_ticks` is set, the effect auto-resolves after that many ticks. If not, it is permanent (until game end or level reset).

### Component StatusEffect

Applies a multiplier/offset to a specific metric within a component (e.g., spike CPU utilization, increase latency).

```json
{
  "type": "component",
  "name": "Memory Leak",
  "component_affected": "api-gateway",
  "metric_affected": "ram_usage",
  "multiplier": 0.05,
  "offset": 0,
  "materialization_probability": 0.02,
  "resolution_ticks": 30,
  "max_instances_at_once": 1,
  "warning_config": {
    "delay_ticks": 5,
    "ticket_title": "Memory usage rising on API Gateway",
    "ticket_description": "A gradual memory leak has been detected. Investigate before it causes an OOM crash."
  }
}
```

| Field                         | Description                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| `component_affected`          | Component `id` to apply the effect to                          |
| `metric_affected`             | The metric key within that component                           |
| `multiplier`                  | Relative modifier: `effectiveValue = base + base * multiplier` |
| `offset`                      | Absolute modifier added on top                                 |
| `materialization_probability` | Probability per tick of the effect triggering (0–1)            |
| `resolution_ticks`            | Ticks until auto-resolution. Omit for a permanent effect.      |
| `max_instances_at_once`       | Maximum concurrent instances of this effect                    |
| `warning_config`              | Optional pre-incident warning phase                            |

### Traffic StatusEffect

Applies a multiplier/offset to a named traffic flow's volume (e.g., simulate a traffic spike or viral event).

```json
{
  "type": "traffic",
  "name": "Viral Post",
  "traffic_affected": "webRequest",
  "multiplier": 3.0,
  "offset": 0,
  "materialization_probability": 0.01,
  "turnsRemaining": 20,
  "warning_config": {
    "delay_ticks": 3,
    "ticket_title": "Unusual traffic spike detected",
    "ticket_description": "A social media post is driving unusual traffic to the service. Prepare for 3× normal load."
  }
}
```

| Field                         | Description                                                           |
| ----------------------------- | --------------------------------------------------------------------- |
| `traffic_affected`            | Traffic name from the global `traffics` list                          |
| `multiplier`                  | Volume multiplier: `newVolume = base + base * multiplier`             |
| `offset`                      | Absolute volume added on top                                          |
| `materialization_probability` | Probability per tick of triggering                                    |
| `turnsRemaining`              | How many ticks the effect stays active (required for traffic effects) |

---

## 7. AlertConfig

`alerts` is an array on each `ComponentConfig` that defines monitoring thresholds. Every tick, each alert is evaluated and may generate a ticket.

**How it works:**

- Alerts can reference either a **metric key** (uses the metric's current value) or an **attribute key** (uses the attribute's `utilization %`, i.e., `current / limit * 100`).
- A `warning` trigger adds a status indicator. A `critical` trigger opens a unique ticket (deduplicated by `(componentId, alertName)`).
- If the underlying condition is still critical after a ticket is manually resolved, a new ticket opens on the next tick.

```json
"alerts": [
  {
    "name": "High CPU Utilization",
    "metric": "gcu",
    "direction": "above",
    "warning_threshold": 70,
    "critical_threshold": 90
  },
  {
    "name": "Low Cache Hit Rate",
    "metric": "hit_rate",
    "direction": "below",
    "warning_threshold": 60,
    "critical_threshold": 30
  }
]
```

| Field                | Description                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `name`               | Unique alert name within the component (used for ticket deduplication)                         |
| `metric`             | Key in the component's `metrics` or `attributes` map                                           |
| `direction`          | `'above'`: value exceeding threshold is bad. `'below'`: value dropping below threshold is bad. |
| `warning_threshold`  | Value at which the warning state activates                                                     |
| `critical_threshold` | Value at which a critical ticket is opened                                                     |

**Good practice:** Set `warning_threshold` at least 10–20 units before `critical_threshold` (for `above`) so players have time to react before a ticket fires.

---

## Common Pitfalls

- **Circular Dependencies**: The validator will block any traffic loops (A → B → A). Use the queue's decoupled model to break cycles.
- **Missing Internal Traffic**: Every internal traffic name must exist in the global `traffics` array AND be emitted by at least one component route or scheduled job.
- **Saturation Spikes**: Latency is capped at 100× the base value in code, so values will never reach millions of ms. However, with `saturation_penalty_factor` above 0.5, saturation at 150%+ utilisation will still push latency to thousands of ms. Keep penalty factors below 0.5 for gameplay-friendly behaviour.
- **Queue multiplier ≠ 1**: Setting `multiplier` to anything other than `1` on a queue's `outgoing_traffics` is a validator error. Queues forward at their egress rate, not a multiple of it.
- **Queue targeting invalid consumer**: A queue's egress traffic must target a `compute` or `storage` component. Targeting a `database` or another `queue` is rejected.
- **ScheduledJob `target: 'value'` mutates `current`, not `limit`**: Use `target: 'value'` only for simulating fill growth (e.g., disk usage accumulation). Use the default `target: 'limit'` for capacity configuration.
- **`materialization_probability: 1.0` without `resolution_ticks`**: The effect will materialize on tick 1 and never resolve. This is intentional for permanent degradation scenarios but easy to overlook. Add `resolution_ticks` if you want auto-recovery.
- **Alert metric key mismatch**: The validator checks that `alert.metric` matches a key in either the component's `metrics` or `attributes` map. A typo here is a hard validation error.
- **Alert thresholds inverted**: For `direction: "above"`, `warning_threshold` must be less than `critical_threshold`. For `direction: "below"`, `warning_threshold` must be greater than `critical_threshold`. Inverted thresholds are now a hard validation error.
- **Status effect `metric_affected` mismatch**: `metric_affected` must match a key in the target component's `metrics` or `attributes` map. The validator enforces this — a typo will fail `npm run validate`.

# Level Configuration Guide

This guide explains how to design and implement new levels for the Oncall Simulator. Levels are defined as JSON files in `src/data/` and registered in `src/lib/game/levels.ts`.

## Core Concepts

### 1. The Two-Pass Traffic System
The simulation uses a two-pass system to ensure fair traffic distribution:
- **Demand Pass (Pass 1):** Every component calculates the total intended traffic it will receive.
- **Resolution Pass (Pass 2):** Every component uses its total demand to calculate a failure rate. This rate is applied proportionally to all incoming flows.

**Rule of Thumb:** If you add a new way to emit traffic (like a StatusEffect or ScheduledJob), ensure it participates in both passes to avoid breaking saturation physics.

### 2. Component Types
- **Compute (`compute`):** General-purpose nodes. Capacity is usually tied to `gcu` or `cpu` attributes.
- **Database (`database`):** High-latency penalty for connection saturation. Metrics focus on `query_latency`.
- **Storage (`storage`):** Capacity is tied to `storage_usage`. It has no request limit but fails completely if the disk is 100% full.

## Configuration Schema

### Component Physics
Physics constants define how the component behaves under load:
```json
"physics": {
  "request_capacity_per_unit": 20, // Reqs/sec per 1 unit of primary attribute
  "saturation_threshold_percent": 80, // When non-linear latency begins
  "saturation_penalty_factor": 0.5, // How sharply latency spikes
  "noise_factor": 0.2 // Random variance in metrics
}
```

### Traffic Routes
Traffic is "pulled" through components via named routes.
- **Internal Traffic:** Must be defined in the global `traffics` list and emitted by an `outgoing_traffics` entry in a route.
- **Multipliers:** If a service calls a DB twice per request, set `multiplier: 2`.

## Step-by-Step Level Creation

1. **Draft the Architecture:** Map out your services and their dependencies.
2. **Define Attributes:** Decide what the player can scale (CPU, RAM, Connections).
3. **Set Baselines:** Ensure `initialLimit * request_capacity_per_unit` is greater than the incoming `external` traffic volume.
4. **Add Status Effects:** Create "Incidents" using `statusEffects`. Use `warning_config` to give players a chance to react before the metrics spike.
5. **Validate:** Run `npm run validate` to check for circular dependencies or missing traffic definitions.

## Common Pitfalls
- **Circular Dependencies:** The validator will block any traffic loops (A -> B -> A).
- **Missing Internal Traffic:** Every internal traffic name must exist in the global `traffics` array AND be emitted by at least one component route or scheduled job.
- **Saturation Spikes:** Setting a high `saturation_penalty_factor` (e.g., > 2.0) can cause latency to explode into the millions of milliseconds instantly. Use with caution.

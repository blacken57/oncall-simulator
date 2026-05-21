# Operational Events & Incidents

Short list — this level is intentionally focused on queue dynamics under two recurring stressors.

## Scheduled Jobs

### Backlog Cleanup

- **Every**: 100 ticks (target: `Telemetry Buffer Queue`)
- **Effect**: Subtracts **1000** from the queue's current backlog value (one-shot decrement).
- **SOP**: This is not a real-world feature — treat it as a "scheduled forgiveness pulse" that the simulation grants you. If you are relying on it to stay above water, you are already losing data; scale the worker instead.

## Status Effects (Incidents)

### Morning Sensor Sync Surge

- **Type**: `traffic` → `sensorData`
- **Trigger**: 2% chance per tick (frequent — expect this often).
- **Impact**: **5×** multiplier on incoming sensor data. Baseline 150 req/s briefly becomes ~750 req/s.
- **SOP**: The queue's job is to absorb this. Verify worker GCU and queue egress are both comfortable; ingress failures are the disaster scenario. If the surge is sustained and the backlog climbs, scale **worker GCU** (not gateway).

### Database Vacuum Lock

- **Type**: `component` → `Timeseries Database`
- **Trigger**: 1% chance per tick.
- **Duration**: 20 ticks.
- **Impact**: **3×** multiplier on `query_latency`. Propagates back through the worker.
- **SOP**: No direct mitigation — vacuum has to finish. The downstream effect is that the worker stalls and the backlog climbs even at normal traffic. Pre-emptively raising worker GCU does _not_ help (the bottleneck is the DB). The only useful prep is making sure the queue's backlog has headroom before this fires; if you see this _during_ a Morning Surge, expect ingress failures.

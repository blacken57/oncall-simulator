# Infrastructure Overview

A linear ingestion pipeline with a queue in the middle to absorb spikes. Read it left-to-right.

## Traffic Flow

```
sensorData (150 req/s baseline, external)
  → Ingestion API Gateway   [compute]
    → enqueueTelemetry
      → Telemetry Buffer Queue   [queue]
        → processTelemetry  (queue egress, drains at fixed rate)
          → Data Processing Worker   [compute]
            → writeTimeseries
              → Timeseries Database   [database]
```

## Component Tiers

### Ingestion API Gateway (`compute`)

The front door. Receives all `sensorData` traffic and enqueues it. If this saturates, raw sensor packets are dropped at the edge — there is no retry.

- Scale by adding **GCU**.
- Realistically, this only saturates during `Morning Sensor Sync Surge`.

### Telemetry Buffer Queue (`queue`)

The shock absorber. Decouples ingress from worker capacity via a bounded backlog.

- **Backlog** attribute: how many messages are currently buffered. Hard ceiling — once full, ingress _fails_.
- **Egress** attribute: messages drained per tick toward the worker. This is your real ingestion rate when the worker can keep up.
- **Ingress failures** ≠ **egress failures**. The dashboard tracks them separately. Ingress failures mean the queue is full; egress failures mean the worker is rejecting deliveries.

### Data Processing Worker (`compute`)

Pulls from the queue and writes to the database. The bottleneck during sustained load.

- Scale by adding **GCU**.
- Saturation here causes egress failures, which keeps messages stuck in the backlog.

### Timeseries Database (`database`)

The terminal sink. Latency here propagates back through the worker.

- Scale by raising **connections**.
- Vulnerable to the **Database Vacuum Lock** effect, which 3× the `query_latency` for 20 ticks.

## Key Scaling Rules

- **The queue does not save you from a slow worker** — it only delays the failure. If egress < ingress for sustained periods, the backlog will fill and ingress failures begin.
- **Worker GCU drives effective throughput, not gateway GCU.** During a surge, scaling the gateway only buys you faster route-to-queue; the queue was going to accept that traffic anyway.
- **Watch `egress_failures` on the queue.** This is the early-warning sign that the downstream worker or database is the real problem.

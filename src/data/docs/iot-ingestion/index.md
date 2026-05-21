# Engineering Wiki - Global IoT Sensor Network

Welcome to the IoT pipeline. Millions of sensors around the world dump telemetry at us — a sneezing refrigerator in Stockholm, a slightly-too-warm shipping container in Singapore, an industrial valve in Houston that has Opinions. Your job is to ingest the data and not lose any.

**NOTICE**: The pipeline is built around a **buffer queue**. Spikes are not a problem; backlog growth is. If you ever see the backlog climbing without recovering, you are losing data downstream.

## Onboarding Overview

The architecture is intentionally narrow: one gateway, one queue, one worker, one database. The queue is the entire reason this level exists — it lets the gateway absorb large spikes (e.g., the morning sensor-sync surge at 5× baseline) while the worker drains at a steady rate.

Traffic shape: 150 req/s baseline `sensorData`, with periodic 5× surges. The queue's `egress` rate is what determines whether you fall behind. The worker's GCU is what determines whether the egress _succeeds_.

## Current Priorities

1. **Backlog growth is the only metric that matters.** A growing backlog means ingress > egress. Fix the worker, not the queue.
2. **The DB Vacuum Lock is silent until it isn't.** Watch `timeseries-db.query_latency` — when it triples, the worker stalls and the backlog climbs.
3. **Resist the urge to add ingress capacity during the morning surge.** The queue can absorb it. Add `data-worker` GCU instead so the backlog actually drains.

## Quick Links

- [Infrastructure Hierarchy](infrastructure.md)
- [Operational Events & Incidents](events.md)

---

_Last edited: this morning by "queue-monitor-bot" (Status: Mildly concerned)_

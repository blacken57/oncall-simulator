# Infrastructure Overview

RideShare is three traffic streams sharing one backend. Two components — **Geo Cache** and **Trip DB** — are on the critical path of more than one stream, which makes them the first things to saturate and the easiest things to forget when scaling.

## Traffic Flow

Everything enters through the **Edge Gateway** (`compute`), which routes each stream to its own subsystem.

### Ride Matching (synchronous)

```
ride_request → Edge Gateway → Matching Service ─┬─> Geo Cache   (×3 lookups per match)
                                                └─> Trip DB     (×2 reads per match)
```

`Matching Service` is CPU-heavy and fans out aggressively: every match does **3 geo-cache lookups and 2 trip-db reads**. A 7× rider surge therefore becomes a **21× lookup surge** on Geo Cache. Plan capacity around the multiplier, not the inbound rate.

### GPS Ingestion (asynchronous)

```
driver_gps → Edge Gateway → GPS Queue → Location Worker ─┬─> Geo Cache    (driver positions)
                                                         └─> Trip Archive (raw traces)
```

The **GPS Queue** (`queue`) decouples the 2000 req/s ping firehose from the workers. It accepts pings into a bounded **backlog** and drains at a configurable **egress** rate. If ingest exceeds egress, the backlog grows; if the backlog fills, new pings are **dropped**.

### Payment Settlement

```
payment_webhook → Edge Gateway → Payment Service ─┬─> Stripe API (external, not scalable)
                                                  └─> Trip DB    (fare write)
```

## Component Tiers

### Internal Compute (`compute`)

- `Edge Gateway`, `Matching Service`, `Payment Service`, `Location Worker`
- Scale by raising **CPU Cores**. Non-linear latency penalty kicks in past the saturation threshold (75–85% depending on the service).

### Internal Databases (`database`)

- `Geo Cache` — high-throughput, low-latency key/value store. Scale **connections**. Shared by Matching (reads) and Location Worker (writes).
- `Trip DB` — the system of record. Scale **connections** (slow: **15-tick** provisioning delay). Also has a growing **Disk Usage** attribute. Shared by Matching (reads), Payment (writes), and the analytics batch job.

### Queue (`queue`)

- `GPS Ingest Queue` — two knobs: **Drain Rate** (egress, msgs/s) and **Backlog Depth** (max capacity). Raise drain rate to clear a backlog, but remember the consumer (`Location Worker`) must have the CPU to keep up — a fast queue feeding a slow worker just moves the failure downstream.

### Blob Storage (`storage`)

- `Trip Archive` — append-only GPS trace storage. Fills from `Location Worker` writes; drained by the compaction cron. **Hard-fails all writes at 100% disk** — there is no graceful degradation.

### External API (`external_api`) — _Not Scalable_

- `Stripe API` — fixed `quota_rps` (rate limit). Traffic above the cap is dropped (HTTP 429). Latency is fixed plus jitter and is **not** load-dependent — but it _is_ affected by vendor incidents (see [events.md](events.md)).

## Key Scaling Rules

- **The shared dependencies (Geo Cache, Trip DB) are your blind spots.** Scaling Matching Service without scaling them just relocates the bottleneck.
- **Trip DB has the longest provisioning delay (15 ticks).** It is the single most important thing to scale _ahead_ of a known surge.
- **A fast queue needs a fast consumer.** Raise GPS Queue egress and Location Worker CPU together.
- **Disk and backlog fail quietly.** They do not spike latency on the way down — they just start dropping work. Keep an eye on Backlog Depth and Disk Usage even when the dashboards look green.

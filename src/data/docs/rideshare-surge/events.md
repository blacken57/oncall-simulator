# Operational Events & Incidents

Every scheduled job and status effect on this level, with standard operating procedures. Most incidents fire a **warning ticket** before going active — that window is when the level is won or lost.

## Scheduled Jobs

### Driver Analytics Batch

- **Every**: 30 ticks (target: `Trip Database`)
- **Effect**: Injects **600 req/s** of `batch_trip_read` traffic for one tick.
- **SOP**: A classic noisy-neighbor. This burst stacks on top of online read traffic and will trip the Trip DB connection-pool alert if you have scaled too tight. Leave headroom above steady-state — especially during a rider surge, when the batch lands on an already-loaded pool.

### Archive Log Compaction

- **Every**: 25 ticks (target: `Trip Archive`)
- **Effect**: Reclaims **40%** of current Trip Archive disk usage.
- **SOP**: This is the _only_ thing keeping the archive from filling up. At baseline GPS volume it comfortably keeps pace. During a GPS storm, write volume can outrun the 25-tick cycle — if Disk Usage is climbing toward 95%, raise the archive's max capacity or reduce ingest, because the next compaction may arrive too late.

## Status Effects (Incidents)

### Friday Night Surge

- **Type**: `traffic` → `ride_request`
- **Warning**: **15-tick delay** (the longest on the level). _"Demand modeling predicts a 7x rider spike."_
- **Duration**: 45 ticks.
- **Impact**: **7× multiplier** on `ride_request`. Because Matching fans out ×3 to Geo Cache and ×2 to Trip DB, the real downstream impact is far larger than 7×.
- **SOP**: The defining incident. On the warning ticket, **immediately** scale Matching Service CPU, Geo Cache connections, _and_ Trip DB connections. Trip DB's 15-tick provisioning delay means it must go first — start it the moment the ticket opens.

### Bad Weather GPS Storm

- **Type**: `traffic` → `driver_gps`
- **Warning**: 10-tick delay. _"Heavy rain triples driver density downtown."_
- **Duration**: 30 ticks.
- **Impact**: **2× multiplier** on `driver_gps` (≈4000 req/s into a queue draining at 2200).
- **SOP**: The GPS Queue backlog will start climbing immediately. Raise **Drain Rate** _and_ **Location Worker CPU** together — a faster queue feeding a saturated worker just relocates the failure. Watch Trip Archive disk too; the write rate doubles.

### Stripe Regional Degradation

- **Type**: `component` → `Stripe API`
- **Warning**: 8-tick delay. _"Stripe status: elevated latency (us-east-1)."_
- **Duration**: 25 ticks.
- **Impact**: **5× latency + 200ms** on Stripe responses.
- **SOP**: **You cannot scale Stripe.** Latency propagates up through Payment Service, so the payment path will look slow — that is expected and contained. Do not panic-scale Payment Service CPU; the bottleneck is external, not local. Keep the rest of the system healthy and ride it out. (In the real world: this is where you'd reach for timeouts, async retry queues, and a capacity buffer — none of which you can scale away after the fact.)

### Geo Cache Eviction Storm

- **Type**: `component` → `Geo Cache`
- **Warning**: None — fires without notice.
- **Duration**: 20 ticks.
- **Impact**: **6× lookup latency.** Propagates up into Matching Service P99, since every match waits on 3 cache lookups.
- **SOP**: No warning means you react, not pre-empt. The Matching latency alert will fire as a _symptom_; the root cause is the cache. Don't chase Matching CPU — the cache latency is the thing degrading, and it will resolve on its own in 20 ticks.

### Trip DB Autovacuum Lock

- **Type**: `component` → `Trip Database`
- **Warning**: 5-tick delay. _"Autovacuum will hold locks and slow queries."_
- **Duration**: 15 ticks.
- **Impact**: **4× query latency** during the lock window.
- **SOP**: Short and self-resolving, but it _stacks_ with the Driver Analytics Batch and any active surge. If the warning lands near a batch tick or during the Friday surge, expect the combined load to push the pool toward exhaustion. Mind the connection count.

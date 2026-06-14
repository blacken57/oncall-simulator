# Operational Events & Incidents

Every scheduled job and status effect on this level, with standard operating procedures. Most incidents fire a **warning ticket** before going active — that window is when the level is won or lost.

## Reading Async Failures (read this first)

The GPS path is asynchronous: `driver_gps` → **GPS Queue** → **Location Worker**. The queue decouples the producer from the consumer, which changes how failures show up — and it is the single most common way to get blindsided on this level.

When the Location Worker degrades (e.g. you under-provisioned its CPU), **you will _not_ see `driver_gps` errors at the Edge Gateway.** From the producer's point of view, every ping that lands in the queue succeeded — it was durably accepted. The worker failing to process it afterwards is an async _processing_ failure, not a request failure. This is correct, and it mirrors real message-queue behaviour: your front door stays green while the pipeline behind it quietly melts down.

So don't trust inbound success rate for the GPS path. The real signals live downstream:

- **Location Worker `error_rate`** — the consumer itself, the root cause.
- **GPS Queue → Backlog Depth** — climbs when the worker can't keep up; trips the **"GPS Backlog Growing"** alert. This is your earliest warning.
- **GPS Queue → Drain Failures** (`egress_failures`) — pushes the queue attempted but the consumer rejected.
- **GPS Queue → Drop Rate** — stays **0% while the backlog still has room** (buffered ≠ failed). It only spikes once the backlog is _full_ and messages are genuinely lost. By then you are already dropping data — the backlog alert should have moved you long before this.

Contrast the synchronous paths: if `Matching Service`, `Trip DB`, or `Geo Cache` degrade, the failure _does_ propagate back to the `ride_request` error rate at the gateway, because those calls are inline. The asymmetry is the lesson — **synchronous failures announce themselves; asynchronous ones you have to go looking for.**

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
- **Impact**: **4× rider volume** (config multiplier 3 → base + 3×base). Because Matching fans out ×3 to Geo Cache and ×2 to Trip DB, the downstream read amplification is far larger.
- **SOP**: The defining incident. On the warning ticket, scale Matching Service CPU and the read path (Trip DB connections especially). Trip DB's 10-tick provisioning delay means it must go first — start it the moment the ticket opens. A modest bump (roughly a third of each slider) is plenty; you do not need to max anything.

### Bad Weather GPS Storm

- **Type**: `traffic` → `driver_gps`
- **Warning**: 10-tick delay. _"Heavy rain triples driver density downtown."_
- **Duration**: 30 ticks.
- **Impact**: **2× GPS volume** (config multiplier 1), ≈4000 req/s into a queue draining at 3000.
- **SOP**: The GPS Queue backlog will start climbing immediately. Raise **Drain Rate** _and_ **Location Worker CPU** together — a faster queue feeding a saturated worker just relocates the failure. Watch Trip Archive disk too; the write rate doubles.

### Stripe Regional Degradation

- **Type**: `component` → `Stripe API`
- **Warning**: 8-tick delay. _"Stripe status: elevated latency (us-east-1)."_
- **Duration**: 25 ticks.
- **Impact**: **6× latency + 200ms** on Stripe responses (config multiplier 5).
- **SOP**: **You cannot scale Stripe.** Latency propagates up through Payment Service, so the payment path will look slow — that is expected and contained. Do not panic-scale Payment Service CPU; the bottleneck is external, not local. Keep the rest of the system healthy and ride it out. (In the real world: this is where you'd reach for timeouts, async retry queues, and a capacity buffer — none of which you can scale away after the fact.)

### Geo Cache Eviction Storm

- **Type**: `component` → `Geo Cache`
- **Warning**: None — fires without notice.
- **Duration**: 20 ticks.
- **Impact**: **5× lookup latency** (config multiplier 4). Propagates up into Matching Service P99, since every match waits on 3 cache lookups.
- **SOP**: No warning means you react, not pre-empt. The Matching latency alert will fire as a _symptom_; the root cause is the cache. Don't chase Matching CPU — the cache latency is the thing degrading, and it will resolve on its own in 20 ticks.

### Trip DB Autovacuum Lock

- **Type**: `component` → `Trip Database`
- **Warning**: 5-tick delay. _"Autovacuum will hold locks and slow queries."_
- **Duration**: 15 ticks.
- **Impact**: **4× query latency** during the lock window (config multiplier 3).
- **SOP**: Short and self-resolving, but it _stacks_ with the Driver Analytics Batch and any active surge. If the warning lands near a batch tick or during the Friday surge, expect the combined load to push the pool toward exhaustion. Mind the connection count.

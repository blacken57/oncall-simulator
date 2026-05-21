# Operational Events & Incidents

A breakdown of every scheduled job and status effect on this level. All status effects have a warning phase — you will _always_ get a heads-up ticket before the incident goes active.

## Scheduled Jobs

### Batch Reconciliation

- **Every**: 30 ticks (target: `Transaction DB`)
- **Effect**: Injects **80 req/s** of `save_transaction` traffic for one tick.
- **SOP**: Keep `Transaction DB` connections well above the steady-state baseline. The reconciliation burst will trip a connection-pool alert if you scale too tight.

### End-of-Day Settlement

- **Every**: 60 ticks (target: `Payment API`)
- **Effect**: Injects **30 req/s** of `checkout` traffic. This fans out to every downstream service, including all five external APIs.
- **SOP**: This is the closest thing to a periodic "small surge." If it lands on top of a `Payment Surge` warning, expect quota breaches.

### Compliance Audit Scan

- **Every**: 45 ticks (target: `User DB`)
- **Effect**: Injects **25 req/s** of `verify_identity` traffic _and_ adds **+10 connections** to `User DB`'s current count for one tick (transient pool pressure even if the GCU is fine).
- **SOP**: Mostly harmless. Worth knowing about only when User DB is already near saturation.

## Status Effects (Incidents)

Each external API has its own dedicated failure mode. Plus one traffic-level surge that hits all five at once.

### Stripe Degradation

- **Type**: `component` → `Stripe`
- **Trigger**: 1% chance per tick.
- **Warning**: 5-tick delay. _"Stripe is reporting elevated latency. Expect checkout times to spike within 5 ticks."_
- **Duration**: 25 ticks.
- **Impact**: 4× latency on Stripe responses.
- **SOP**: No mitigation available — Stripe is external. Pre-warn stakeholders. Latency propagates through `Payment API` so the entire checkout path will look slow.

### Twilio Rate Limit

- **Type**: `component` → `Twilio`
- **Trigger**: 1% chance per tick.
- **Warning**: 5-tick delay. _"Twilio is about to enforce rate limits. SMS 2FA will fail for most users in 5 ticks."_
- **Duration**: 20 ticks.
- **Impact**: +75% error rate on Twilio (most 2FA messages will fail).
- **SOP**: Once active, 2FA failures will cascade up through `User Service`. The auth leg of `checkout` will degrade.

### MaxMind API Slow

- **Type**: `component` → `MaxMind`
- **Trigger**: 1.5% chance per tick.
- **Warning**: 5-tick delay. _"Fraud checks will take 3x longer in 5 ticks."_
- **Duration**: 30 ticks.
- **Impact**: 3× latency on MaxMind. Propagates through `Fraud Service`.

### Plaid Maintenance

- **Type**: `component` → `Plaid`
- **Trigger**: 1% chance per tick.
- **Warning**: 8-tick delay (longest warning window of any incident — vendors give us notice).
- **Duration**: 15 ticks.
- **Impact**: +90% error rate on Plaid. Bank verification effectively unavailable.

### Payment Surge

- **Type**: `traffic` → `checkout`
- **Trigger**: 1% chance per tick.
- **Warning**: 5-tick delay. _"Unusual checkout traffic detected. Volume expected to reach 2.5x normal in 5 ticks — all external API quotas will be breached."_
- **Impact**: 1.5× multiplier on `checkout` traffic (real impact at peak is higher due to End-of-Day overlap).
- **SOP**: The only level-wide event. Scale `Payment API`, `Fraud Service`, and `User Service` GCU immediately on warning. External quotas will breach regardless — accept that revenue will dip.

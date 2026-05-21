# Infrastructure Overview

FinPay is a fan-out architecture. One inbound `checkout` request explodes into four parallel sub-requests, each of which may further fan out. Failure on any leg fails the entire transaction.

## Traffic Flow

All traffic originates from the `checkout` external traffic (40 req/s baseline).

### Entry Point

**Payment API** (`compute`) receives every `checkout` request and immediately fans out to four downstream legs:

- `stripe_charge` → **Stripe** (external API)
- `fraud_check` → **Fraud Service**
- `auth_user` → **User Service**
- `send_receipt` → **SendGrid** (external API)

### Fraud Leg

**Fraud Service** (`compute`) → fans out to:

- `geo_score` → **MaxMind** (external API)
- `save_transaction` → **Transaction DB**

### Auth Leg

**User Service** (`compute`) → fans out to:

- `verify_identity` → **User DB**
- `sms_2fa` → **Twilio** (external API)
- `verify_bank` → **Plaid** (external API)

## Component Tiers

### Internal Compute (`compute`)

- `Payment API`, `Fraud Service`, `User Service`
- Scale by adding **GCU**. Standard 80% saturation rules apply.

### Internal Databases (`database`)

- `Transaction DB`, `User DB`
- Scale by raising the **connections** limit. Connection pool exhaustion causes hard errors, not just slowness.

### External APIs (`external_api`) — _Not Scalable_

- `Stripe`, `Twilio`, `MaxMind`, `Plaid`, `SendGrid`
- Each has a fixed `quota_rps` limit. Excess traffic is dropped — there is no fair queueing, no retries.
- Latency is fixed (jitter notwithstanding) and is **not** affected by load. It _is_ affected by upstream-vendor incidents (see [events.md](events.md)).
- The only quota-relief action available today is "wait for the incident to expire." A `Request Quota Increase` action is on the roadmap.

## Key Scaling Rules

- **GCU on Payment API is the cheapest insurance against `Payment Surge`** — it raises capacity for every downstream leg.
- **You cannot scale your way out of an external quota breach.** Watch the warning tickets and pre-emptively reduce dependent traffic if possible.
- **Transaction DB is the only write-path database.** If it goes down, no payments complete regardless of upstream health.

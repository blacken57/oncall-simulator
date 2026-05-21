# Engineering Wiki - FinPay Processing Hub

Welcome to FinPay. You are now responsible for the payment processing platform that moves _real money_ between _real banks_. The compliance officer has a printout of your name on her desk; please act accordingly.

**NOTICE**: Five upstream vendors sit on the critical path of every checkout. We do not control them, we cannot scale them, and they break on their own schedule. Pre-empting their failures is the entire job.

## Onboarding Overview

FinPay routes every `checkout` request through a fan-out of internal services (`Payment API` → `Fraud Service`, `User Service`) which in turn call **five external APIs**: Stripe (charge), Twilio (2FA SMS), MaxMind (geo-scoring), Plaid (bank verification), and SendGrid (receipts). Two internal databases (`Transaction DB`, `User DB`) absorb the writes.

If any one of the externals exceeds its `quota_rps`, traffic above the cap is dropped proportionally — there is no queue, no retry, just lost revenue.

## Current Priorities

1. **Watch the quotas, not the latency.** Latency spikes resolve themselves. Quota breaches do not — every dropped request is a failed payment.
2. **Warning tickets are gifts.** Every status effect on this level fires a warning ticket 5–8 ticks before going active. Use that window to request quota increases (when that action ships) or scale internal capacity.
3. **The "Payment Surge" effect breaches all five external quotas simultaneously.** When you see the warning, assume the worst.

## Quick Links

- [Infrastructure Hierarchy](infrastructure.md)
- [Operational Events & Incidents](events.md)

---

_Last edited: yesterday by "compliance-bot" (Status: Anxious)_

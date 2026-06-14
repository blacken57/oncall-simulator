# Engineering Wiki - RideShare Platform

Welcome to the on-call rotation. You own the backend that matches riders to drivers, ingests a firehose of driver GPS pings, and settles fares through a third-party payment processor. It is Thursday afternoon. It will not stay Thursday afternoon.

**NOTICE**: This is a _peak-demand_ level. The system is comfortably healthy at baseline — every red light you see is an incident you can act on, not a misconfiguration. Your job is to keep P99 and error rates down through a Friday-night surge, a weather-driven GPS storm, a flaky payment vendor, and a disk that fills faster than the cleanup cron drains it.

## Onboarding Overview

Three streams of external traffic hit the **Edge Gateway**:

- `ride_request` (400 req/s) — riders asking to be matched with a driver.
- `driver_gps` (2000 req/s) — location pings from every active driver. High volume, latency-tolerant, so we buffer it.
- `payment_webhook` (150 req/s) — fare settlement callbacks.

From there the system fans out across a **shared read path** (Matching Service → Geo Cache + Trip DB) and an **async ingest path** (GPS Queue → Location Worker → Geo Cache + Trip Archive). Payments call out to **Stripe**, which you do not own and cannot scale.

## Current Priorities

1. **Pre-scale on the warning ticket.** The Friday surge fires a heads-up ticket **15 ticks** before it lands. The Trip DB connection pool takes **15 ticks to provision** — if you wait for the surge to hit, your scaling action arrives after the incident is over. Provision ahead.
2. **Scale the whole read path, not just the front.** A rider surge multiplies load on Matching _and_ everything Matching calls. Adding CPU to Matching while leaving Geo Cache and Trip DB at baseline just moves the bottleneck one hop down.
3. **You cannot scale Stripe.** When the Stripe degradation warning lands, accept that payment latency will rise and focus on keeping the rest of the system healthy so the slowdown stays contained to the payment path.
4. **Watch the queue, watch the disk.** Async paths fail silently. The GPS queue drops messages when its backlog fills; the Trip Archive hard-fails writes at 100% disk. Neither will page you the way a latency spike does — you have to look.

## Quick Links

- [Infrastructure Hierarchy](infrastructure.md)
- [Operational Events & Incidents](events.md)

---

_Last edited: 03:47 by "the-previous-oncall" (Status: Asleep, finally)_

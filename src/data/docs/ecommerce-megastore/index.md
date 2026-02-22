# Engineering Wiki - E-commerce Megastore

Welcome to the internal engineering portal for the Megastore platform. You have been assigned as the primary on-call engineer for the most complex system in our fleet.

**NOTICE**: Due to the high traffic volume (1000+ RPS), please ensure all scaling actions are planned. Latency is our primary enemy.

## Onboarding Overview

The Megastore platform is a distributed architecture designed to handle massive scale. Our primary goal is to maintain a < 200ms P99 latency across all user-facing paths.

## Current Priorities

1.  **Scale for the Sale**: We are expecting a "Cyber Monday" event. The API Gateway is the first point of failure—keep an eye on its CPU usage.
2.  **Inventory Accuracy**: The Inventory Service runs a batch sync every 60 ticks. This creates a massive (20k+) query spike on the Inventory DB. Do not panic; this is expected behavior (mostly).
3.  **Cache Efficiency**: The Cart Cache is the backbone of our low-latency shopping experience. If connections saturate, the Cart Service will grind to a halt.

## Quick Links

- [Infrastructure Overview](infrastructure.md)
- [Compute Services](services.md)
- [Data & Storage](databases.md)
- [Operational Events & Jobs](events.md)

---

_Last edited: 2 hours ago by "Megastore-Arch-Lead" (Status: Panic)_

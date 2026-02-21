# Infrastructure Overview

The system is split into several tiers. Most of them are actually necessary.

## The Core Services
We rely on three primary components to process user purchases. Each has its own quirks and "personality" (mostly bad).

1. [Checkout Server](checkout-server.md): Where the magic happens (and where the GCU disappears).
2. [Checkout DB](checkout-db.md): A collection of tables that we hope never gets corrupted.
3. [Log Storage](log-storage.md): Where we put logs that nobody ever reads, unless something breaks.

## Historical Context
In 2022, we tried to move everything to a serverless architecture, but the latency became so bad that the frontend team had to implement a "Loading Spinner" that actually played a full game of Tetris. We moved back to the current setup in 2023. 

## Known Issues
- If you hear a loud humming noise from the server room, it's just the cooling fans. If the humming stops, **run**.
- The `initiatePurchase` route occasionally fails if the user is in a specific timezone that we forgot to account for. We've marked this as `Won't Fix`.

[Go back home](index.md)

# Service: Checkout Server (Compute)

The Checkout Server is the brain of the operation. It is currently hosted on a cluster of machines that we named after extinct flightless birds.

## Technical Specs

- **Logic**: It processes two main flows: `initiatePurchase` and `commitPurchase`.
- **Scaling**: We use RAM and GCU. Adding more units takes some time to provision because our cloud provider's API is "leisurely."
- **Failure Modes**:
  - If GCU usage gets near the limit, it starts to sweat.
  - If usage crosses the 80% mark, the "Saturation Penalty" kicks in—this is a feature, not a bug, designed to encourage "graceful degradation" (mostly it just makes things slow).

## Note from Sarah (Lead Dev)

"Stop trying to scale RAM when the error rate is high. It's usually the [Database](checkout-db.md) being slow. Check the dependency latency first!"

## Fun Fact

This server was originally written in Fortran as a prank, but it was so fast we kept it for three weeks until someone realized nobody could maintain it. It's since been rewritten in something else.

[Back to Infrastructure](infrastructure.md)

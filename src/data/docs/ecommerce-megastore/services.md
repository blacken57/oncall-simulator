# Compute Services

Detailed specifications for our application tier services.

## API Gateway

The front door to the platform.

- **Type**: `compute`
- **Capacity**: 250 req/s per CPU Core.
- **Physics**: Extremely low base latency (10ms) but sensitive to CPU saturation.
- **Routes**:
  - `search_request`: Forwards to Search Service.
  - `cart_request`: Forwards to Cart Service.
  - `checkout_request`: Forwards to Order Service.

## Search Service

The compute-heavy search engine.

- **Type**: `compute`
- **Capacity**: 100 req/s per CPU Core.
- **Physics**: 20ms base latency. Performs 3x IOPS for every request to the Search DB.

## Cart Service

Highly optimized for speed.

- **Type**: `compute`
- **Capacity**: 200 req/s per CPU Core.
- **Physics**: 5ms base latency. Heavily utilizes the Cart Cache (2 queries per action).

## Order Service

Complex business logic handler.

- **Type**: `compute`
- **Capacity**: 20 req/s per CPU Core.
- **Physics**: High base latency (100ms). Hits the Order DB hard (4 queries per checkout).

## Inventory Service

Manages real-time stock availability.

- **Type**: `compute`
- **Capacity**: 200 req/s per CPU Core.
- **Physics**: 10ms base latency. Also handles the background "Batch Sync" traffic.

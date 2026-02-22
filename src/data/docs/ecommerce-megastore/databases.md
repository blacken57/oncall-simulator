# Data & Storage

Details on our storage and database tier.

## Search Database
Block storage for the search engine.
- **Type**: `storage`
- **Initial Limit**: 2000 GB.
- **Physics**: Does not use "Connections." It will only fail if it reaches 100% fullness.
- **Metrics**: IOPS and Fill Rate.

## Cart Cache
Our in-memory Redis cluster.
- **Type**: `database`
- **Initial Limit**: 5000 Active Connections.
- **Physics**: Extremely fast (1ms base latency).
- **Critical Threshold**: 95% utilization of connections.

## Order Database
The core SQL transaction store.
- **Type**: `database`
- **Initial Limit**: 1000 Max Connections.
- **Physics**: 20ms base latency. Sharp penalty (4x) for connection saturation.
- **Critical Threshold**: 100% utilization.

## Inventory Database
Real-time stock database.
- **Type**: `database`
- **Initial Limit**: 500 Connections.
- **Physics**: 5ms base latency.
- **Critical Threshold**: 95% utilization.
- **Note**: The Inventory Service periodically sends 20,000 queries here during a "Batch Sync." Ensure connections are scaled accordingly!

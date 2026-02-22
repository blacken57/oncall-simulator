# Infrastructure Overview

The Megastore architecture is split into several tiers, each with its own performance characteristics.

## Traffic Flow Hierarchy

All requests enter the system through the **API Gateway** and are routed as follows:

### 1. Search Path

- **API Gateway** -> **Search Service** -> **Search Database** (Block Storage)
- **Primary Metric**: Search Latency.
- **Dependency**: The Search DB reindexing is a known performance killer.

### 2. Cart Path

- **API Gateway** -> **Cart Service** -> **Cart Cache** (Redis-style Database)
- **Primary Metric**: Cart Action speed.
- **Dependency**: High connection counts on the Cache can lead to sharp latency spikes.

### 3. Checkout Path

- **API Gateway** -> **Order Service**
  - -> **Order Database** (SQL Store)
  - -> **Inventory Service** -> **Inventory Database**
- **Primary Metric**: Error Rate. We cannot lose orders.
- **Dependency**: The most sensitive path in the system. Any failure here hits our bottom line.

## Key Scaling Rules

- **Compute Nodes**: Scale by adding CPU cores. This increases request capacity.
- **Database Nodes**: Scale by increasing max connections.
- **Storage Nodes**: Scale by adding disk space. Note: Storage does not have a "request limit," only a "fullness" limit.

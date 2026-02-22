# Operational Events & Jobs

Detailed breakdown of scheduled jobs and status effects that impact system health.

## Scheduled Jobs

### 1. Inventory Batch Sync

- **Interval**: Every 60 ticks (approx. 1 minute).
- **Target**: `Inventory Service`.
- **Action**: Emits **20,000** queries to the Inventory DB.
- **SOP**: Ensure the Inventory DB has at least 500 max connections to handle the sudden burst of SQL traffic.

### 2. Search DB Cleanup

- **Interval**: Every 120 ticks (approx. 2 minutes).
- **Target**: `Search Database`.
- **Action**: Reduces `storage_usage` by 20% (multiplier -0.2).
- **SOP**: No action required. This maintains our disk health.

## Status Effects (Incidents)

### 1. Cyber Monday Sale

- **Type**: `traffic`
- **Trigger**: 1/1000 chance per tick.
- **Warning**: 10-tick delay with a "Cyber Monday Sale" ticket.
- **Duration**: 20 ticks.
- **Impact**: Multiplies **Search Request** volume by **10x** (10,000+ RPS).
- **SOP**: Scale API Gateway, Search Service, and Search DB connections _immediately_ upon seeing the ticket.

### 2. Search DB Reindexing

- **Type**: `component`
- **Trigger**: 1/50 chance per tick.
- **Duration**: 5 ticks.
- **Impact**: Multiplies **Search Database Latency** by **2x**.
- **SOP**: This is a background maintenance task. It will resolve itself, but expect search latency alerts during the reindexing.

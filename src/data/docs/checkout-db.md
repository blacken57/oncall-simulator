# Service: Checkout DB (Database)

This is the Checkout DB. It's a relational database, though the relations are sometimes strained.

## Performance Metrics
The primary constraint is the **Connection Pool**. 
- Each incoming query requires 1 connection. 
- If you run out of connections, the DB simply stops answering the phone. This results in a 100% failure rate for any new requests.
- Latency spikes sharply when utilization crosses 90%. Dave says this is because the DB is "thinking really hard."

## Maintenance
- **Scaling**: You can increase the max connections, but it costs more.
- **Storage**: The DB grows over time. Make sure you have enough overhead.

## Warning
Do not touch the `legacy_user_table`. We don't know what it does, but when we tried to delete it once, the office lights started flickering.

[Infrastructure Home](infrastructure.md)

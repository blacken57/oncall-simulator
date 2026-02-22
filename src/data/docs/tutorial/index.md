# Tutorial: Simple Service Management

Welcome to your first on-call shift. This tutorial will guide you through the basics of the simulator.

## Your Goal

Maintain a healthy **Basic Server**. You need to monitor its CPU and respond if things get out of hand.

## Monitoring the Dashboard

- **Incoming**: Shows the current traffic hitting your server.
- **Latency**: How long it takes for the server to process requests. Higher CPU usage usually leads to higher latency.
- **Error Rate**: Percentage of requests failing. If you exceed your CPU limit, this will spike.
- **CPU**: This is your primary resource. You can see both current usage and your current limit.

## Handling Incidents

1. **Identify the problem**: Check the "Tickets" tab for any critical alerts.
2. **Investigate**: Go to the "Actions" tab to see your components.
3. **Remediate**: If CPU is too high, you can increase the **CPU limit**. Note that this costs money and takes a few ticks to apply.

## Budget

Watch your budget! Every resource you provision costs money per tick. If you run out of money, it's game over.

Good luck!

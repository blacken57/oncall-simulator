# Incident Response Protocol

If your pager goes off, follow these steps in order. Deviation from the protocol may result in "Strongly Worded Feedback" during the weekly post-mortem.

## Step 1: Acknowledge

Don't just stare at the screen. Move the ticket to "Investigating." This signals to the rest of the team (and the system) that you are on it. Ignoring an alert for too long will tank our department's reputation.

## Step 2: Triage

Look at the **Dashboard**. Is it a latency spike or an error spike?

- **Latency**: Usually means a resource is saturated (>80% usage). Check the [Architecture](architecture.md) to see what's slow.
- **Errors**: Usually means a hard limit was hit (Connection pool full, disk space 100%).

## Step 3: Mitigate

Use the **Actions** tab.

- **Wait**: Remember that changes take time. Don't double-scale just because you're impatient.
- **Budget**: Every action has a cost. If you scale to 100x capacity, Finance will be at your desk before the ticket is resolved.

## Step 4: Resolve

Once the metrics look healthy, resolve the ticket. If the problem isn't actually fixed, the system will just open a new one anyway.

[Go back](index.md)

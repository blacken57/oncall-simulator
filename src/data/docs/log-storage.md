# Service: Log Block Storage (Storage)

This is where all our audit logs live. It's essentially a very expensive digital basement.

## The "Full Disk" Problem

This service is the most common cause of "Invisible Failures."

- If `storage_usage` hits 100%, every write request to this service fails.
- Because the [Checkout Server](checkout-server.md) is configured to log every purchase, a failure here will cause the purchase itself to fail.
- **Result**: Even if the Server and DB are healthy, your "Success" metric will crash if this disk is full.

## Automation

There is an automated job that clears out 50% of the used space periodically. If you see the disk filling up too fast between clearings, you'll need to increase the total capacity to give it more "breathing room."

## Irrelevant Information

The original name for this service was "Project: Bottomless Pit," but the marketing team thought that sounded too negative.

[Back to Infrastructure](infrastructure.md)

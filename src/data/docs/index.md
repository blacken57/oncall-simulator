# Engineering Wiki - Home

Welcome to the internal documentation for the Checkout System. If you are reading this, you have likely been assigned to the primary on-call rotation. 

**IMPORTANT**: Please ensure you have completed the "Health and Safety in the Data Center" training module before touching anything. 

## Onboarding Overview
Our system is a highly complex, "battle-tested" (meaning we haven't restarted it in months) microservices architecture. While the original architects left the company in 2024 to start a goat farm, the [Infrastructure Overview](infrastructure.md) should provide enough info to keep things running.

## Current Priorities
1. **Reduce Pager Noise**: We are currently seeing a lot of alerts. Most are probably fine.
2. **Budget Optimization**: Finance is asking why our GCU usage is so high. 
3. **Don't break the Database**: Dave from the DB team says if we run one more unoptimized join, he's taking away our write access.

## Quick Links
- [Infrastructure Hierarchy](infrastructure.md)
- [How to (maybe) fix things](incident-response.md)
- [The Coffee Machine Manual](coffee-machine.md) (Crucial during outages)

---
*Last edited: 3 months ago by "Auto-Doc-Bot-9000" (Status: Failing)*

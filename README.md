# Oncall Simulator

An interactive simulation game where players step into the shoes of an oncall engineer. Manage high-traffic systems, respond to urgent pages, diagnose performance bottlenecks using real-time dashboards, and resolve tickets while balancing operational costs and service health.

## 🕹️ Game Concept

As the oncall engineer, you are responsible for the health of a distributed system. For a deep dive into the underlying systems and simulation physics, see the [Design Document](oncall-simulator-design.md).

The game features:

- **Tickets Page**: A queue of incoming issues ranging from customer complaints to critical system failures.
- **Monitoring Dashboards**: Real-time graphs and metrics (Latency, Error Rate, CPU/RAM utilization) to diagnose issues.
- **Actions Interface**: Take corrective measures like scaling compute resources, adjusting database connection pools, or flushing caches.
- **Latency-based Execution**: Actions aren't instantaneous. Simulating real-world delays, infrastructure changes take time to propagate.
- **Budget Tracking**: Every resource has a cost. Scaling up might solve a performance issue but could blow your monthly budget.
- **Documentation**: Searchable internal docs to help you understand system architecture and standard operating procedures (SOPs).

## 🛠️ Technical Architecture

Built with **Svelte 5**, the game leverages the new **Runes** system for a highly reactive and performant engine.

### Core Engine

The game operates on a **tick-based loop** (defaulting to 1 second per tick). Each tick:

1. Calculates global traffic and environmental factors.
2. Updates component-level "physics" (e.g., higher traffic leading to increased CPU usage and latency).
3. Processes pending infrastructure actions in the latency queue.
4. Evaluates health status and triggers potential alerts or tickets.

### Reactive Models

- **Attributes**: Configurable properties with limits and current usage (e.g., RAM, GCU, Connections).
- **Metrics**: Time-series telemetry data with history for sparkline visualization.
- **System Components**: Specialized classes for different infrastructure types:
  - `ComputeNode`: Simulates APIs and workers.
  - `DatabaseNode`: Manages connection pools and query latency.
  - `StorageNode`: Tracks disk growth and fill rates.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/) or your preferred package manager

### Installation

```bash
git clone https://github.com/your-repo/oncall-simulator.git
cd oncall-simulator
npm install
```

### Development

Start the development server with:

```bash
npm run dev
```

### Building

To create a production-ready build:

```bash
npm run build
```

Preview the build with `npm run preview`.

## 📂 Project Structure

- `src/lib/game/`: Core engine logic, reactive models, and scenario definitions.
- `src/components/`: Reusable Svelte components for Dashboards, Tickets, and Action panels.
- `src/data/`: JSON templates for tickets, documentation, and status effects.
- `src/routes/`: Main application layouts and pages.

## 🗺️ Roadmap

We are actively expanding the simulator's capabilities. For a detailed technical roadmap, see the [Future Plans](FUTURE_PLANS.md).

- [x] Svelte 5 + Vite initialization
- [x] Core game engine and OO state models
- [x] Metrics system and SVG sparklines
- [x] Latency-based action system
- [x] Sequential Short-circuiting Traffic Physics
- [x] Enforced Resource Capacity Caps
- [ ] Status effects system (e.g., "Viral Post", "Regional Outage")
- [ ] Automated ticket spawning and resolution flow
- [ ] PagerDuty-style urgent alerts
- [ ] Documentation search and integration
- [ ] Level-based progression and scoring

## 📄 License

This project is licensed under the MIT License.

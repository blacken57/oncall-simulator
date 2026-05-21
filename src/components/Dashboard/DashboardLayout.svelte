<script lang="ts">
  import { engine } from '$lib/game/engine.svelte';
  import MetricCard from './MetricCard.svelte';
</script>

<div class="dashboard">
  <!-- System-wide Traffic Overview -->
  <section class="traffic-overview full-width">
    <header class="section-header">
      <div class="header-title-row">
        <span class="pulse-ring"></span>
        <h2>INBOUND NETWORK TRAFFIC</h2>
      </div>
      <span class="tech-sub">EDGE_GATEWAY // PROD_ROUTING</span>
    </header>

    <div class="traffic-groups-container">
      {#each Object.values(engine.traffics) as traffic}
        {#if traffic.type === 'external'}
          <div class="traffic-group">
            <div class="traffic-header">
              <span class="traffic-id">🔌 {traffic.id}</span>
            </div>
            <div class="metrics-grid traffic">
              <MetricCard
                name="Demand"
                value={traffic.actualValue}
                unit="req/s"
                history={traffic.successHistory.map((s, i) => s + (traffic.failureHistory[i] || 0))}
                status="healthy"
              />
              <MetricCard
                name="Success"
                value={traffic.successHistory[traffic.successHistory.length - 1] || 0}
                unit="req/s"
                history={traffic.successHistory}
                status="healthy"
              />
              <MetricCard
                name="Failed"
                value={traffic.failureHistory[traffic.failureHistory.length - 1] || 0}
                unit="req/s"
                history={traffic.failureHistory}
                status={(traffic.failureHistory[traffic.failureHistory.length - 1] || 0) > 0
                  ? 'critical'
                  : 'healthy'}
              />
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </section>

  <!-- Infrastructure Nodes Grid -->
  {#each Object.values(engine.components) as component}
    <section class="component-group {component.status}">
      <header class="component-header">
        <div class="component-title-area">
          <h2>{component.name}</h2>
          <span class="status-lbl">{component.status.toUpperCase()}</span>
        </div>
        <span class="type-badge badge-{component.type}">{component.type}</span>
      </header>

      <div class="metrics-grid">
        <!-- Primary Metrics (Latency, Error Rate, etc) -->
        {#each Object.values(component.metrics) as metric}
          <MetricCard
            name={metric.name}
            value={metric.value}
            unit={metric.unit}
            history={metric.history}
            status={component.status}
          />
        {/each}

        <!-- Resource Attributes (RAM, GCU, Storage) rendered as graphs -->
        {#each Object.values(component.attributes) as attr}
          <MetricCard
            name={attr.name}
            value={attr.current}
            unit={attr.unit}
            history={attr.history}
            limit={attr.limit}
            status={attr.utilization > 90
              ? 'critical'
              : attr.utilization > 70
                ? 'warning'
                : 'healthy'}
          />
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .traffic-overview {
    background: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    margin-bottom: 0.5rem;
    box-shadow: var(--shadow-md);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .header-title-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .pulse-ring {
    width: 8px;
    height: 8px;
    background: var(--accent);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--accent);
  }

  .tech-sub {
    font-size: 0.65rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
    font-weight: bold;
  }

  .traffic-groups-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .metrics-grid.traffic {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    max-width: none;
  }

  .traffic-group {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1rem;
  }

  .traffic-header {
    margin-bottom: 0.75rem;
  }

  .traffic-id {
    font-size: 0.7rem;
    font-weight: bold;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-mono);
    background: var(--surface-subtle);
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  .component-group {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
    transition: all 0.25s ease;
    position: relative;
    overflow: hidden;
  }

  .component-group:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
  }

  .component-group.warning {
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: 0 4px 20px -5px rgba(245, 158, 11, 0.05);
  }

  .component-group.warning .status-lbl {
    color: var(--warning);
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.2);
  }

  .component-group.critical {
    border-color: rgba(239, 68, 68, 0.4);
    box-shadow: 0 4px 20px -5px rgba(239, 68, 68, 0.08);
    animation: critical-pulse 3s infinite;
  }

  .component-group.critical .status-lbl {
    color: var(--critical);
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.2);
  }

  @keyframes critical-pulse {
    0% {
      border-color: rgba(239, 68, 68, 0.4);
    }
    50% {
      border-color: rgba(239, 68, 68, 0.7);
    }
    100% {
      border-color: rgba(239, 68, 68, 0.4);
    }
  }

  .component-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.75rem;
  }

  .component-title-area {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-lbl {
    font-size: 0.55rem;
    font-family: var(--font-mono);
    font-weight: bold;
    background: rgba(16, 185, 129, 0.15);
    color: var(--success);
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    border: 1px solid rgba(16, 185, 129, 0.2);
    letter-spacing: 0.05em;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .type-badge {
    font-size: 0.6rem;
    padding: 0.2rem 0.5rem;
    background: var(--surface-subtle);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-weight: bold;
    letter-spacing: 0.05em;
  }

  .badge-database {
    color: #c084fc;
    border-color: rgba(192, 132, 252, 0.2);
    background: rgba(192, 132, 252, 0.05);
  }

  .badge-compute {
    color: #22d3ee;
    border-color: rgba(34, 211, 238, 0.2);
    background: rgba(34, 211, 238, 0.05);
  }

  .badge-queue {
    color: #60a5fa;
    border-color: rgba(96, 165, 250, 0.2);
    background: rgba(96, 165, 250, 0.05);
  }

  .badge-storage {
    color: #94a3b8;
    border-color: rgba(148, 163, 184, 0.2);
    background: rgba(148, 163, 184, 0.05);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.85rem;
  }

  @media (max-width: 1024px) {
    .dashboard {
      grid-template-columns: 1fr;
      gap: 1rem;
      padding: 1rem;
    }
  }

  @media (max-width: 500px) {
    .metrics-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

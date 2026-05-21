<script lang="ts">
  interface Props {
    name: string;
    value: number;
    unit: string;
    history: number[];
    limit?: number;
    status?: 'healthy' | 'warning' | 'critical';
  }

  let { name, value, unit, history, limit, status = 'healthy' }: Props = $props();

  // Create a unique ID for the SVG gradient fill to avoid collision
  const gradientId = 'grad-' + Math.random().toString(36).substring(2, 9);

  // Calculate SVG Path for the line and the filled area
  let paths = $derived.by(() => {
    if (history.length < 2) return { line: '', area: '' };

    let min: number, max: number;

    if (limit !== undefined) {
      // Scaled to the limit set by the user
      min = 0;
      max = limit || 0.1;
    } else {
      // Auto-scale for metrics without a defined limit
      const hMin = Math.min(...history);
      const hMax = Math.max(...history);
      const hRange = hMax - hMin;

      if (hRange < 0.1) {
        min = hMin - 1;
        max = hMax + 1;
      } else {
        min = hMin - hRange * 0.1;
        max = hMax + hRange * 0.1;
      }
    }

    const range = max - min;
    const width = 100;
    const height = 30;

    const points = history.map((v, i) => {
      const x = (i / (history.length - 1)) * width;
      const pct = (v - min) / range;
      const y = height - pct * height;
      return { x, y };
    });

    const linePath = 'M ' + points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ');
    const areaPath = linePath + ` L 100,${height} L 0,${height} Z`;

    return { line: linePath, area: areaPath };
  });

  let utilization = $derived(limit ? (value / limit) * 100 : 0);
</script>

<div class="metric-card {status}">
  <div class="header">
    <span class="name">{name}</span>
    <div class="status-indicator">
      <span class="status-dot"></span>
    </div>
  </div>

  <div class="body">
    <div class="value-container">
      <span class="value">{value.toFixed(1)}</span>
      <span class="unit">{unit}</span>
      {#if limit !== undefined}
        <span class="limit">/ {limit}</span>
      {/if}
    </div>

    <div class="visuals">
      <div class="sparkline-container">
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height="30">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="currentColor" stop-opacity="0.25" />
              <stop offset="100%" stop-color="currentColor" stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <!-- Area Fill -->
          <path d={paths.area} fill={`url(#${gradientId})`} />
          <!-- The Line -->
          <path
            d={paths.line}
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
      </div>

      {#if limit !== undefined}
        <div class="utilization-v-side">
          <div class="v-bar-container" title="Utilization: {utilization.toFixed(1)}%">
            <div class="v-bar-fill" style="height: {Math.min(100, utilization)}%"></div>
          </div>
          <span class="util-text-v">{utilization.toFixed(0)}%</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .metric-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 120px;
    box-sizing: border-box;
    position: relative;
    box-shadow: var(--shadow-sm);
    transition: all 0.25s ease;
  }

  .metric-card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
  }

  .metric-card.warning {
    border-color: rgba(245, 158, 11, 0.35);
    background: linear-gradient(to bottom right, var(--surface), rgba(245, 158, 11, 0.02));
    box-shadow: 0 4px 15px -3px rgba(245, 158, 11, 0.05);
  }

  .metric-card.critical {
    border-color: rgba(239, 68, 68, 0.35);
    background: linear-gradient(to bottom right, var(--surface), rgba(239, 68, 68, 0.02));
    box-shadow: 0 4px 15px -3px rgba(239, 68, 68, 0.05);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .name {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--text-muted);
    font-weight: bold;
    font-family: var(--font-mono);
  }

  .value-container {
    margin-bottom: 0.85rem;
    display: flex;
    align-items: baseline;
  }

  .value {
    font-size: 1.6rem;
    font-weight: bold;
    color: var(--text-primary);
    font-family: var(--font-mono);
    letter-spacing: -0.02em;
  }

  .unit {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-left: 0.25rem;
    font-family: var(--font-mono);
  }

  .limit {
    font-size: 0.7rem;
    color: var(--text-faint);
    margin-left: 0.5rem;
    font-family: var(--font-mono);
  }

  .visuals {
    display: flex;
    align-items: stretch;
    gap: 1rem;
    height: 35px;
  }

  .sparkline-container {
    flex: 1;
    height: 30px;
    color: var(--success);
    overflow: hidden;
    align-self: flex-end;
  }

  .utilization-v-side {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    width: 55px;
  }

  .v-bar-container {
    width: 8px;
    height: 30px;
    background: var(--bg-deep);
    border-radius: 2px;
    overflow: hidden;
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .v-bar-fill {
    width: 100%;
    background: currentColor;
    border-radius: 1px;
    transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .util-text-v {
    font-size: 0.65rem;
    font-weight: bold;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    min-width: 25px;
  }

  /* Status Colors */
  .healthy .sparkline-container,
  .healthy .v-bar-fill {
    color: var(--success);
  }
  .warning .sparkline-container,
  .warning .v-bar-fill {
    color: var(--warning);
  }
  .critical .sparkline-container,
  .critical .v-bar-fill {
    color: var(--critical);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: block;
    position: relative;
  }

  .healthy .status-dot {
    background: var(--success);
  }

  .warning .status-dot {
    background: var(--warning);
    box-shadow: 0 0 8px var(--warning-glow);
    animation: status-pulse 1.5s infinite;
  }

  .critical .status-dot {
    background: var(--critical);
    box-shadow: 0 0 10px var(--critical-glow);
    animation: status-pulse 1s infinite;
  }

  @keyframes status-pulse {
    0% {
      transform: scale(0.95);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.15);
      opacity: 1;
    }
    100% {
      transform: scale(0.95);
      opacity: 0.7;
    }
  }
</style>

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
          <!-- Area Fill -->
          <path d={paths.area} fill="currentColor" fill-opacity="0.1" />
          <!-- The Line -->
          <path
            d={paths.line}
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
      </div>

      {#if limit !== undefined}
        <div class="utilization-v-side">
          <div class="v-bar-container">
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
    background: #111;
    border: 1px solid #222;
    border-radius: 4px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 110px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .name {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #666;
    font-weight: bold;
  }

  .value-container {
    margin-bottom: 0.75rem;
    display: flex;
    align-items: baseline;
  }

  .value {
    font-size: 1.4rem;
    font-weight: 700;
    color: #fff;
  }

  .unit {
    font-size: 0.7rem;
    color: #444;
    margin-left: 0.2rem;
  }

  .limit {
    font-size: 0.7rem;
    color: #444;
    margin-left: 0.4rem;
  }

  .visuals {
    display: flex;
    align-items: stretch;
    gap: 0.75rem;
    height: 35px;
  }

  .sparkline-container {
    flex: 1;
    height: 30px;
    color: #4ade80;
    overflow: hidden;
    align-self: flex-end;
  }

  .utilization-v-side {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    width: 45px;
  }

  .v-bar-container {
    width: 8px;
    height: 30px;
    background: #222;
    border-radius: 1px;
    overflow: hidden;
    border: 1px solid #333;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .v-bar-fill {
    width: 100%;
    background: currentColor;
    transition: height 0.3s ease;
  }

  .util-text-v {
    font-size: 0.6rem;
    font-weight: bold;
    color: #888;
    min-width: 25px;
  }

  /* Status Colors */
  .healthy .sparkline-container,
  .healthy .v-bar-fill {
    color: #4ade80;
  }
  .warning .sparkline-container,
  .warning .v-bar-fill {
    color: #fbbf24;
  }
  .critical .sparkline-container,
  .critical .v-bar-fill {
    color: #f87171;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: block;
  }

  .healthy .status-dot {
    background: #4ade80;
    box-shadow: 0 0 8px #4ade8055;
  }
  .warning .status-dot {
    background: #fbbf24;
    box-shadow: 0 0 8px #fbbf2455;
  }
  .critical .status-dot {
    background: #f87171;
    box-shadow: 0 0 8px #f8717155;
  }
</style>

<script lang="ts">
  import { engine } from '$lib/game/engine.svelte';

  // Initialize local limits using an effect to handle dynamic level loading
  let localLimits = $state<Record<string, Record<string, number>>>({});

  $effect(() => {
    // Re-initialize localLimits whenever the level changes
    const newLimits: Record<string, Record<string, number>> = {};
    for (const [compId, component] of Object.entries(engine.components)) {
      newLimits[compId] = {};
      for (const [attrId, attr] of Object.entries(component.attributes)) {
        newLimits[compId][attrId] = attr.limit;
      }
    }
    localLimits = newLimits;
  });

  function handleQueue(compId: string, attrId: string) {
    const newValue = localLimits[compId][attrId];
    const attr = engine.components[compId].attributes[attrId];
    engine.queueAction(compId, attrId, newValue, attr.applyDelay);
  }

  function getPendingAction(compId: string, attrId: string) {
    return engine.pendingActions.find((a) => a.componentId === compId && a.attributeId === attrId);
  }
</script>

<div class="actions-container">
  {#each Object.entries(engine.components) as [compId, component]}
    <div class="component-actions status-{component.status}">
      <header class="component-header">
        <div class="title-section">
          <span class="status-indicator"></span>
          <h3>{component.name}</h3>
        </div>
        <span class="type-badge badge-{component.type}">{component.type.replace('_', ' ')}</span>
      </header>

      <div class="attribute-list">
        {#each Object.entries(component.attributes) as [attrId, attr]}
          {@const pending = getPendingAction(compId, attrId)}
          {@const isDirty =
            localLimits[compId] &&
            localLimits[compId][attrId] !== undefined &&
            localLimits[compId][attrId] !== attr.limit}
          <div class="attribute-row" class:is-dirty={isDirty} class:is-pending={!!pending}>
            <div class="info">
              <span class="name">{attr.name}</span>
              <span class="current-limit">Active: {attr.limit}{attr.unit}</span>
            </div>

            <div class="controls">
              <!-- Added safety check for localLimits[compId] -->
              {#if localLimits[compId] && localLimits[compId][attrId] !== undefined}
                <div class="slider-wrapper">
                  <input
                    type="range"
                    min={attr.minLimit}
                    max={attr.maxLimit}
                    bind:value={localLimits[compId][attrId]}
                    disabled={!!pending}
                    aria-label="{attr.name} limit"
                  />
                  <div class="slider-labels">
                    <span class="limit-min">{attr.minLimit}</span>
                    <span class="limit-max">{attr.maxLimit}</span>
                  </div>
                </div>

                <div class="value-action-cell">
                  <span class="target-value" class:dirty-value={isDirty}>
                    {localLimits[compId][attrId]}<span class="unit">{attr.unit}</span>
                  </span>

                  {#if pending}
                    {@const progress =
                      attr.applyDelay > 0
                        ? Math.round(
                            ((attr.applyDelay - pending.ticksRemaining) / attr.applyDelay) * 100
                          )
                        : 100}
                    <div class="pending-container" title="Propagating configuration limits...">
                      <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: {progress}%"></div>
                      </div>
                      <span class="pending-lbl">{pending.ticksRemaining}s</span>
                    </div>
                  {:else if isDirty}
                    <button
                      class="apply-btn animate-pulse"
                      onclick={() => handleQueue(compId, attrId)}
                    >
                      APPLY
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .actions-container {
    padding: 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.25rem;
  }

  .component-actions {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: var(--shadow-sm);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    border-left: 3px solid var(--border);
  }

  .component-actions:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
  }

  .component-actions.status-healthy {
    border-left-color: var(--success);
  }
  .component-actions.status-warning {
    border-left-color: var(--warning);
  }
  .component-actions.status-critical {
    border-left-color: var(--critical);
  }

  .component-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.75rem;
  }

  .title-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .status-healthy .status-indicator {
    background: var(--success);
    box-shadow: 0 0 6px var(--success);
  }
  .status-warning .status-indicator {
    background: var(--warning);
    box-shadow: 0 0 6px var(--warning);
  }
  .status-critical .status-indicator {
    background: var(--critical);
    box-shadow: 0 0 6px var(--critical);
  }

  h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-sans);
    letter-spacing: -0.01em;
  }

  /* Badges from dashboard layout */
  .type-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: bold;
    text-transform: uppercase;
    padding: 0.15rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .badge-compute {
    color: #22d3ee;
    border-color: rgba(34, 211, 238, 0.2);
    background: rgba(34, 211, 238, 0.05);
  }

  .badge-database {
    color: #a855f7;
    border-color: rgba(168, 85, 247, 0.2);
    background: rgba(168, 85, 247, 0.05);
  }

  .badge-queue {
    color: #60a5fa;
    border-color: rgba(96, 165, 250, 0.2);
    background: rgba(96, 165, 250, 0.05);
  }

  .badge-storage {
    color: #f43f5e;
    border-color: rgba(244, 63, 94, 0.2);
    background: rgba(244, 63, 94, 0.05);
  }

  .badge-external_api {
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.2);
    background: rgba(245, 158, 11, 0.05);
  }

  .attribute-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .attribute-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-deep);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: all 0.2s ease;
  }

  .attribute-row.is-dirty {
    border-color: rgba(59, 130, 246, 0.35);
    background: linear-gradient(to right, var(--bg-deep), rgba(59, 130, 246, 0.02));
  }

  .attribute-row.is-pending {
    border-color: rgba(245, 158, 11, 0.3);
    background: linear-gradient(to right, var(--bg-deep), rgba(245, 158, 11, 0.02));
  }

  .info {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-sans);
  }

  .current-limit {
    font-size: 0.65rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .slider-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  /* Slider Overhaul */
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    outline: none;
    margin: 0;
    transition: background 0.2s ease;
  }

  input[type='range']:hover:not(:disabled) {
    background: var(--border-strong);
  }

  /* Webkit custom thumb */
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-primary);
    border: 2px solid var(--accent);
    box-shadow: 0 0 6px var(--accent-glow);
    cursor: pointer;
    transition:
      transform 0.1s ease,
      border-color 0.2s ease;
  }

  input[type='range']::-webkit-slider-thumb:hover {
    transform: scale(1.25);
  }

  .is-dirty input[type='range']::-webkit-slider-thumb {
    border-color: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
  }

  input[type='range']:disabled::-webkit-slider-thumb {
    background: var(--border);
    border-color: var(--border-strong);
    box-shadow: none;
    cursor: not-allowed;
    transform: none;
  }

  /* Firefox custom thumb */
  input[type='range']::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-primary);
    border: 2px solid var(--accent);
    box-shadow: 0 0 6px var(--accent-glow);
    cursor: pointer;
    transition:
      transform 0.1s ease,
      border-color 0.2s ease;
  }

  input[type='range']::-moz-range-thumb:hover {
    transform: scale(1.25);
  }

  .is-dirty input[type='range']::-moz-range-thumb {
    border-color: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
  }

  input[type='range']:disabled::-moz-range-thumb {
    background: var(--border);
    border-color: var(--border-strong);
    box-shadow: none;
    cursor: not-allowed;
    transform: none;
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.55rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .value-action-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 135px;
    justify-content: flex-end;
  }

  .target-value {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    min-width: 50px;
    text-align: right;
  }

  .target-value .unit {
    font-size: 0.65rem;
    color: var(--text-muted);
    margin-left: 0.1rem;
  }

  .dirty-value {
    color: var(--accent);
    text-shadow: 0 0 8px var(--accent-glow);
  }

  .apply-btn {
    background: rgba(59, 130, 246, 0.1);
    color: var(--accent);
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 0.25rem 0.65rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.65rem;
    font-weight: 700;
    font-family: var(--font-sans);
    letter-spacing: 0.05em;
    transition: all 0.2s ease;
  }

  .apply-btn:hover {
    background: var(--accent);
    color: var(--text-primary);
    box-shadow: 0 0 8px var(--accent-glow);
  }

  /* Propagation Delay Loader style */
  .pending-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.15);
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-sm);
    min-width: 75px;
    justify-content: space-between;
  }

  .progress-bar-container {
    flex: 1;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
    max-width: 40px;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--warning);
    border-radius: 2px;
    background-image: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.15) 25%,
      transparent 25%,
      transparent 50%,
      rgba(255, 255, 255, 0.15) 50%,
      rgba(255, 255, 255, 0.15) 75%,
      transparent 75%,
      transparent
    );
    background-size: 10px 10px;
    animation: barberpole 1s linear infinite;
  }

  .pending-lbl {
    font-size: 0.6rem;
    color: var(--warning);
    font-family: var(--font-mono);
    font-weight: bold;
  }

  @keyframes barberpole {
    from {
      background-position: 0 0;
    }
    to {
      background-position: 10px 0;
    }
  }

  @keyframes pulse {
    0% {
      opacity: 0.9;
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 8px var(--accent-glow);
    }
    100% {
      opacity: 0.9;
    }
  }

  .animate-pulse {
    animation: pulse 2s infinite ease-in-out;
  }

  @media (max-width: 900px) {
    .actions-container {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 500px) {
    .controls {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .value-action-cell {
      justify-content: space-between;
      min-width: 0;
    }

    .slider-wrapper {
      width: 100%;
    }
  }
</style>

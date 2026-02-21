<script lang="ts">
  import { onMount } from 'svelte';
  import { engine } from '$lib/game/engine.svelte';
  import DashboardLayout from '../components/Dashboard/DashboardLayout.svelte';
  import ComponentList from '../components/Actions/ComponentList.svelte';
  import TicketList from '../components/Tickets/TicketList.svelte';
  import level1 from '../data/level1.json';

  onMount(() => {
    // @ts-ignore - level1.json might need casting to LevelConfig if not automatically typed
    engine.loadLevel(level1);
  });

  let tick = $derived(engine.tick);
  let isRunning = $derived(engine.isRunning);
  let currentSpend = $derived(engine.currentSpend);
  let budgetRemaining = $derived(engine.budget - currentSpend);
  let activeTicketsCount = $derived(engine.tickets.filter(t => t.status !== 'resolved').length);

  let activeView = $state('dashboard');
</script>

<main class="game-container">
  <header class="global-header">
    <div class="brand">
      <h1>ONCALL <span class="highlight">SIMULATOR</span></h1>
      <span class="version">v0.1.0-alpha</span>
    </div>

    <div class="game-stats">
      <div class="stat-item">
        <span class="label">TICK:</span>
        <span class="value">{tick}</span>
      </div>
      <div class="stat-item {budgetRemaining < 500 ? 'low-budget' : ''}">
        <span class="label">BUDGET:</span>
        <span class="value">${budgetRemaining.toFixed(0)}</span>
      </div>
      <div class="stat-item">
        <span class="label">SPEND:</span>
        <span class="value">${currentSpend.toFixed(0)}/tick</span>
      </div>
    </div>

    <div class="controls">
      <button
        class="btn {isRunning ? 'stop' : 'start'}"
        onclick={() => (isRunning ? engine.stop() : engine.start())}
      >
        {isRunning ? 'PAUSE' : 'RUN'}
      </button>
    </div>
  </header>

  <div class="content">
    <nav class="side-nav">
      <button
        class="nav-item {activeView === 'dashboard' ? 'active' : ''}"
        onclick={() => (activeView = 'dashboard')}>Dashboard</button
      >
      <button
        class="nav-item {activeView === 'actions' ? 'active' : ''}"
        onclick={() => (activeView = 'actions')}>Actions</button
      >
      <button 
        class="nav-item {activeView === 'tickets' ? 'active' : ''}" 
        onclick={() => (activeView = 'tickets')}
      >
        Tickets
        {#if activeTicketsCount > 0}
          <span class="badge">{activeTicketsCount}</span>
        {/if}
      </button>
      <button class="nav-item">Docs</button>
    </nav>

    <div class="main-view">
      {#if activeView === 'dashboard'}
        <DashboardLayout />
      {:else if activeView === 'actions'}
        <ComponentList />
      {:else if activeView === 'tickets'}
        <TicketList />
      {/if}
    </div>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #000;
    color: #e0e0e0;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
  }

  .badge {
    background: #f87171;
    color: #fff;
    font-size: 0.6rem;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    margin-left: 0.4rem;
    vertical-align: middle;
  }

  .game-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .global-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: #0a0a0a;
    border-bottom: 2px solid #222;
  }

  .brand h1 {
    margin: 0;
    font-size: 1.2rem;
    letter-spacing: 0.1em;
  }

  .highlight {
    color: #f87171;
  }
  .version {
    font-size: 0.6rem;
    color: #555;
  }

  .game-stats {
    display: flex;
    gap: 2rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-item .label {
    font-size: 0.6rem;
    color: #666;
  }
  .stat-item .value {
    font-size: 1.1rem;
    font-weight: 700;
    color: #4ade80;
  }
  .low-budget .value {
    color: #f87171;
  }

  .btn {
    background: #222;
    color: #fff;
    border: 1px solid #444;
    padding: 0.4rem 1rem;
    cursor: pointer;
    font-family: inherit;
    font-weight: bold;
    letter-spacing: 0.1em;
  }

  .btn:hover {
    background: #333;
  }
  .btn.start {
    color: #4ade80;
    border-color: #4ade8055;
  }
  .btn.stop {
    color: #f87171;
    border-color: #f8717155;
  }

  .content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .side-nav {
    width: 120px;
    background: #0a0a0a;
    border-right: 1px solid #222;
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
  }

  .nav-item {
    background: none;
    border: none;
    color: #666;
    padding: 0.75rem;
    text-align: center;
    cursor: pointer;
    font-size: 0.8rem;
    font-family: inherit;
    text-transform: uppercase;
    width: 100%;
  }

  .nav-item.active {
    color: #fff;
    background: #111;
    border-left: 3px solid #f87171;
  }

  .main-view {
    flex: 1;
    overflow-y: auto;
    background: #050505;
  }
</style>

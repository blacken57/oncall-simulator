<script lang="ts">
  import { page } from '$app/stores';
  import { engine } from '$lib/game/engine.svelte';
  import { getLevel } from '$lib/game/levels';
  import { customLevelStore } from '$lib/game/customLevel.svelte';
  import DashboardLayout from '../../../components/Dashboard/DashboardLayout.svelte';
  import ComponentList from '../../../components/Actions/ComponentList.svelte';
  import TicketList from '../../../components/Tickets/TicketList.svelte';
  import DocsView from '../../../components/Docs/DocsView.svelte';
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import { onMount, untrack } from 'svelte';

  let levelId = $derived($page.params.levelId || '');
  let level = $derived(
    levelId === 'custom' ? customLevelStore.config : levelId ? getLevel(levelId) : null
  );

  $effect(() => {
    if (level) {
      untrack(() => {
        engine.loadLevel(level!);
      });
    }
  });

  onMount(() => {
    return () => {
      engine.stop();
    };
  });

  let tick = $derived(engine.tick);
  let isRunning = $derived(engine.isRunning);
  let activeTicketsCount = $derived(engine.tickets.filter((t) => t.status !== 'resolved').length);

  let activeView = $state('dashboard');
</script>

{#if !level}
  <div class="error-view">
    <h1>Level not found</h1>
    <a href="/">Back to Home</a>
  </div>
{:else}
  <main class="game-container">
    <header class="global-header">
      <div class="brand">
        <a href="/" class="home-link">
          <h1>ONCALL <span class="highlight">SIMULATOR</span></h1>
        </a>
        <div class="level-info">
          <span class="level-name">{level.name}</span>
          <span class="version">v0.1.0-alpha</span>
        </div>
      </div>

      <div class="game-stats">
        <div class="stat-item">
          <span class="label">TICK:</span>
          <span class="value">{tick}</span>
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
        <button
          class="nav-item {activeView === 'docs' ? 'active' : ''}"
          onclick={() => (activeView = 'docs')}
        >
          Docs
        </button>
      </nav>

      <div class="main-view">
        {#if activeView === 'dashboard'}
          <DashboardLayout />
        {:else if activeView === 'actions'}
          <ComponentList />
        {:else if activeView === 'tickets'}
          <TicketList />
        {:else if activeView === 'docs'}
          <DocsView {levelId} />
        {/if}
      </div>
    </div>

    <div class="notifications-container">
      {#each engine.notifications as notification (notification.id)}
        <div
          class="notification {notification.type}"
          animate:flip={{ duration: 300 }}
          transition:fade
        >
          <div class="message">{notification.message}</div>
        </div>
      {/each}
    </div>
  </main>
{/if}

<style>
  .error-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #000;
    color: #fff;
  }

  .error-view a {
    color: #f87171;
    text-decoration: none;
    margin-top: 1rem;
    border: 1px solid #f87171;
    padding: 0.5rem 1rem;
  }

  .home-link {
    text-decoration: none;
    color: inherit;
  }

  .level-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: -0.2rem;
  }

  .level-name {
    font-size: 0.7rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .notifications-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
    z-index: 1000;
  }

  .notification {
    background: #111;
    border: 1px solid #333;
    padding: 0.75rem 1.5rem;
    color: #fff;
    font-size: 0.8rem;
    border-left: 4px solid #4ade80;
    pointer-events: auto;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .notification.info {
    border-left-color: #4ade80;
  }

  .notification.error {
    border-left-color: #f87171;
  }

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
    height: 100dvh;
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

  @media (max-width: 768px) {
    .global-header {
      flex-wrap: wrap;
      padding: 0.5rem 0.75rem;
      gap: 0.25rem;
    }

    .brand {
      flex: 1;
    }

    .brand h1 {
      font-size: 1rem;
    }

    .level-info {
      display: none;
    }

    .game-stats {
      width: 100%;
      order: 3;
      justify-content: space-around;
      gap: 0;
      border-top: 1px solid #1a1a1a;
      padding-top: 0.4rem;
    }

    .stat-item .value {
      font-size: 0.9rem;
    }

    .side-nav {
      width: 100%;
      height: 56px;
      flex-direction: row;
      border-right: none;
      border-top: 1px solid #222;
      padding: 0;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
    }

    .nav-item {
      flex: 1;
      font-size: 0.65rem;
      padding: 0.5rem 0.25rem;
      border-left: none !important;
      border-bottom: 3px solid transparent;
    }

    .nav-item.active {
      border-left: none;
      border-bottom: 3px solid #f87171;
      background: #111;
    }

    .main-view {
      padding-bottom: 56px;
    }

    .notifications-container {
      bottom: calc(56px + 0.75rem);
      right: 0.75rem;
    }
  }
</style>

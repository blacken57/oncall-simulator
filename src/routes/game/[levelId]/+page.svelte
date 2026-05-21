<script lang="ts">
  import { page } from '$app/stores';
  import { engine } from '$lib/game/engine.svelte';
  import { getLevel } from '$lib/game/levels';
  import { customLevelStore } from '$lib/game/customLevel.svelte';
  import ThemeToggle from '../../../components/ThemeToggle.svelte';
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
    <div class="terminal-box">
      <h1>[CRITICAL] LEVEL NOT FOUND</h1>
      <p>The requested simulation level config could not be retrieved from registry.</p>
      <a href="/" class="btn-terminal">RETURN TO MAIN TERMINAL</a>
    </div>
  </div>
{:else}
  <main class="game-container">
    <header class="global-header">
      <div class="brand">
        <a href="/" class="home-link">
          <h1>ONCALL <span class="highlight">SIMULATOR</span></h1>
        </a>
        <div class="level-info">
          <span class="level-badge">MISSION</span>
          <span class="level-name">{level.name}</span>
        </div>
      </div>

      <div class="game-stats">
        <div class="stat-item telemetry-tick">
          <span class="label">SIMULATOR TICK:</span>
          <span class="value">{tick}s</span>
        </div>
        <div class="stat-item telemetry-incidents">
          <span class="label">ACTIVE ALERTS:</span>
          <span class="value {activeTicketsCount > 0 ? 'alerting' : 'healthy'}">
            {activeTicketsCount}
          </span>
        </div>
      </div>

      <div class="controls">
        <div class="theme-wrapper">
          <ThemeToggle />
        </div>
        <button
          class="btn {isRunning ? 'stop' : 'start'}"
          onclick={() => (isRunning ? engine.stop() : engine.start())}
        >
          {isRunning ? 'PAUSE SIM' : 'RUN SIM'}
        </button>
      </div>
    </header>

    <div class="content-wrapper">
      <nav class="side-nav">
        <button
          class="nav-item {activeView === 'dashboard' ? 'active' : ''}"
          onclick={() => (activeView = 'dashboard')}
        >
          <span class="nav-icon">📊</span>
          <span class="nav-text">Telemetry</span>
        </button>
        <button
          class="nav-item {activeView === 'actions' ? 'active' : ''}"
          onclick={() => (activeView = 'actions')}
        >
          <span class="nav-icon">⚙️</span>
          <span class="nav-text">Controls</span>
        </button>
        <button
          class="nav-item {activeView === 'tickets' ? 'active' : ''}"
          onclick={() => (activeView = 'tickets')}
        >
          <span class="nav-icon">🚨</span>
          <span class="nav-text">Incidents</span>
          {#if activeTicketsCount > 0}
            <span class="badge pulsing-badge">{activeTicketsCount}</span>
          {/if}
        </button>
        <button
          class="nav-item {activeView === 'docs' ? 'active' : ''}"
          onclick={() => (activeView = 'docs')}
        >
          <span class="nav-icon">📖</span>
          <span class="nav-text">Runbooks</span>
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
          <div class="notif-accent"></div>
          <div class="notif-body">
            <span class="notif-header">[{notification.type.toUpperCase()}] SYSTEM_LOG</span>
            <div class="message">{notification.message}</div>
          </div>
        </div>
      {/each}
    </div>
  </main>
{/if}

<style>
  .error-view {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--bg-deep);
    color: var(--text-primary);
    padding: 2rem;
    box-sizing: border-box;
  }

  .terminal-box {
    background: var(--surface);
    border: 1px solid var(--critical);
    padding: 3rem;
    max-width: 600px;
    border-radius: var(--radius-lg);
    box-shadow: 0 10px 30px rgba(239, 68, 68, 0.1);
    text-align: center;
  }

  .terminal-box h1 {
    font-size: 1.8rem;
    color: var(--critical);
    margin-top: 0;
    margin-bottom: 1.5rem;
    letter-spacing: 0.05em;
    font-family: var(--font-mono);
  }

  .terminal-box p {
    color: var(--text-secondary);
    font-size: 0.95rem;
    line-height: 1.6;
    margin-bottom: 2rem;
  }

  .btn-terminal {
    display: inline-block;
    color: var(--text-primary);
    text-decoration: none;
    border: 1px solid var(--border-strong);
    padding: 0.75rem 1.5rem;
    font-weight: bold;
    font-size: 0.85rem;
    border-radius: var(--radius-md);
    transition: all 0.2s;
    background: var(--surface-raised);
  }

  .btn-terminal:hover {
    border-color: var(--text-primary);
    background: var(--surface-subtle);
  }

  .home-link {
    text-decoration: none;
    color: inherit;
  }

  .level-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.1rem;
  }

  .level-badge {
    font-size: 0.55rem;
    background: var(--border-strong);
    color: var(--text-secondary);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-weight: bold;
  }

  .level-name {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: bold;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .notifications-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    pointer-events: none;
    z-index: 1000;
    max-width: 400px;
    width: 100%;
  }

  .notification {
    background: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    position: relative;
    overflow: hidden;
    color: var(--text-primary);
    font-size: 0.8rem;
    pointer-events: auto;
    box-shadow: var(--shadow-lg);
    display: flex;
    transition: transform 0.2s;
  }

  .notif-accent {
    width: 4px;
    background: var(--success);
    flex-shrink: 0;
  }

  .notification.info .notif-accent {
    background: var(--success);
  }

  .notification.error .notif-accent {
    background: var(--critical);
  }

  .notif-body {
    padding: 0.75rem 1.25rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .notif-header {
    font-size: 0.6rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
    font-weight: bold;
    letter-spacing: 0.05em;
  }

  .notification .message {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text);
    line-height: 1.4;
  }

  .badge {
    background: var(--critical);
    color: #fff;
    font-size: 0.6rem;
    padding: 0.15rem 0.45rem;
    border-radius: 10px;
    font-weight: bold;
    font-family: var(--font-mono);
  }

  .pulsing-badge {
    box-shadow: 0 0 10px var(--critical-glow);
    animation: badge-pulse 2s infinite;
  }

  @keyframes badge-pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.15);
    }
    100% {
      transform: scale(1);
    }
  }

  .game-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-deep);
  }

  .global-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.85rem 2rem;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    z-index: 10;
  }

  .brand h1 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--text-primary);
  }

  .highlight {
    color: var(--critical);
  }

  .game-stats {
    display: flex;
    gap: 2.5rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-item .label {
    font-size: 0.6rem;
    color: var(--text-muted);
    letter-spacing: 0.1em;
    font-family: var(--font-mono);
    font-weight: bold;
    margin-bottom: 0.15rem;
  }

  .stat-item .value {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .telemetry-tick .value {
    color: var(--accent);
  }

  .telemetry-incidents .value.alerting {
    color: var(--critical);
    text-shadow: 0 0 10px var(--critical-glow);
    animation: blink-value 1.5s infinite;
  }

  .telemetry-incidents .value.healthy {
    color: var(--success);
  }

  @keyframes blink-value {
    0% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.7;
    }
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .theme-wrapper {
    display: inline-flex;
    align-items: center;
  }

  .btn {
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
    padding: 0.5rem 1.2rem;
    cursor: pointer;
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .btn:hover {
    background: var(--surface-subtle);
  }

  .btn.start {
    color: var(--success);
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.05);
  }

  .btn.start:hover {
    background: rgba(16, 185, 129, 0.15);
    border-color: var(--success);
  }

  .btn.stop {
    color: var(--critical);
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.05);
  }

  .btn.stop:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: var(--critical);
  }

  .content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .side-nav {
    width: 180px;
    background: var(--surface-raised);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 1.5rem 0.75rem;
    gap: 0.5rem;
    z-index: 5;
  }

  .nav-item {
    background: none;
    border: 1px solid transparent;
    color: var(--text-secondary);
    padding: 0.75rem 1rem;
    text-align: left;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: var(--font-sans);
    font-weight: 600;
    width: 100%;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s;
    position: relative;
  }

  .nav-item:hover {
    color: var(--text-primary);
    background: var(--surface);
    border-color: var(--border);
  }

  .nav-item.active {
    color: var(--text-primary);
    background: var(--surface-subtle);
    border-color: var(--border-strong);
  }

  .nav-item.active::after {
    content: '';
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 12px;
    background: var(--accent);
    border-radius: 10px;
  }

  .nav-item:hover .nav-icon {
    transform: scale(1.1);
  }

  .nav-icon {
    font-size: 1.1rem;
    transition: transform 0.2s;
  }

  .nav-text {
    flex: 1;
  }

  .main-view {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-deep);
  }

  @media (max-width: 768px) {
    .global-header {
      flex-wrap: wrap;
      padding: 0.75rem 1rem;
      gap: 0.75rem;
    }

    .brand {
      flex: 1;
    }

    .brand h1 {
      font-size: 1.1rem;
    }

    .level-info {
      display: none;
    }

    .game-stats {
      width: 100%;
      order: 3;
      justify-content: space-around;
      gap: 0;
      border-top: 1px solid var(--border);
      padding-top: 0.5rem;
    }

    .stat-item .value {
      font-size: 1rem;
    }

    .side-nav {
      width: 100%;
      height: 60px;
      flex-direction: row;
      border-right: none;
      border-top: 1px solid var(--border);
      padding: 0 0.5rem;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
      gap: 0.25rem;
    }

    .nav-item {
      flex: 1;
      flex-direction: column;
      font-size: 0.65rem;
      padding: 0.4rem 0.25rem;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
      border-radius: 0;
    }

    .nav-item.active::after {
      display: none;
    }

    .nav-item.active {
      border-top: 3px solid var(--accent);
      background: var(--surface);
    }

    .nav-icon {
      font-size: 0.95rem;
    }

    .main-view {
      padding-bottom: 60px;
    }

    .notifications-container {
      bottom: calc(60px + 1rem);
      right: 1rem;
      left: 1rem;
      max-width: none;
      width: auto;
    }
  }
</style>

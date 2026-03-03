<script lang="ts">
  import { getAllLevels } from '$lib/game/levels';
  import { fade, fly } from 'svelte/transition';
  import ThemeToggle from '../components/ThemeToggle.svelte';

  const allLevels = getAllLevels();

  let hoveredLevel = $state<string | null>(null);
</script>

<svelte:head>
  <title>Oncall Simulator | Site Reliability Engineering Game</title>
  <meta
    name="description"
    content="Experience the thrill and terror of systems at scale. A SRE simulator where you monitor metrics, respond to alerts, and manage incidents."
  />
  <meta
    name="keywords"
    content="oncall simulator, SRE game, site reliability engineering, incident response, system architecture game"
  />
  <link rel="canonical" href="https://oncall-simulator.avroy.dev/" />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://oncall-simulator.avroy.dev/" />
  <meta property="og:title" content="Oncall Simulator | SRE Game" />
  <meta
    property="og:description"
    content="Experience the thrill and terror of systems at scale. A SRE simulator where you monitor metrics, respond to alerts, and manage incidents."
  />

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content="https://oncall-simulator.avroy.dev/" />
  <meta property="twitter:title" content="Oncall Simulator | SRE Game" />
  <meta
    property="twitter:description"
    content="Experience the thrill and terror of systems at scale. A SRE simulator where you monitor metrics, respond to alerts, and manage incidents."
  />
</svelte:head>

<div class="landing-container">
  <header class="landing-header">
    <div class="brand" in:fly={{ y: -20, duration: 800 }}>
      <div class="brand-row">
        <h1>ONCALL <span class="highlight">SIMULATOR</span></h1>
        <ThemeToggle />
      </div>
      <p class="tagline">Experience the thrill and terror of systems at scale.</p>
    </div>
  </header>

  <main class="landing-content">
    <section class="intro" in:fade={{ delay: 300, duration: 800 }}>
      <h2>SYSTEM OVERVIEW</h2>
      <p>
        Welcome, Engineer. You've been tasked with maintaining our critical infrastructure. Each
        level presents a different architectural challenge. Monitor metrics, respond to alerts, and
        Keep the system running.
      </p>
      <div class="features">
        <div class="feature-card">
          <h3>Real-time Physics</h3>
          <p>Traffic propagation, latency spikes, and cascading failures.</p>
        </div>
        <div class="feature-card">
          <h3>Incident Response</h3>
          <p>Acknowledge tickets and investigate root causes.</p>
        </div>
        <div class="feature-card">
          <h3>Documentation</h3>
          <p>Read the runbooks. They are your only friend when everything is on fire.</p>
        </div>
      </div>
    </section>

    <section class="level-selection" in:fade={{ delay: 600, duration: 800 }}>
      <h2>SELECT MISSION</h2>
      <div class="level-grid">
        {#each allLevels as level}
          <a
            href="/game/{level.id}"
            class="level-card"
            onmouseenter={() => (hoveredLevel = level.id)}
            onmouseleave={() => (hoveredLevel = null)}
          >
            <div class="level-card-content">
              <h3>{level.name}</h3>
              <p>{level.description}</p>
              <div class="level-meta">
                <span class="difficulty">ID: {level.id}</span>
                <span class="action">INITIALIZE_SEQUENCE ></span>
              </div>
            </div>
            {#if hoveredLevel === level.id}
              <div class="level-card-glow" transition:fade={{ duration: 200 }}></div>
            {/if}
          </a>
        {/each}
        <a
          href="/custom"
          class="level-card custom-card"
          onmouseenter={() => (hoveredLevel = '__custom')}
          onmouseleave={() => (hoveredLevel = null)}
        >
          <div class="level-card-content">
            <h3>Custom Level</h3>
            <p>Upload or paste your own JSON level config and play it in the simulator.</p>
            <div class="level-meta">
              <span class="difficulty">ID: custom</span>
              <span class="action custom-action">DEPLOY_CUSTOM ></span>
            </div>
          </div>
          {#if hoveredLevel === '__custom'}
            <div class="level-card-glow custom-glow" transition:fade={{ duration: 200 }}></div>
          {/if}
        </a>
      </div>
    </section>
  </main>

  <footer class="landing-footer">
    <span class="version">v0.1.0-alpha | LOG_LEVEL: INFO</span>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'JetBrains Mono', 'Courier New', monospace;
  }

  .landing-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    background: radial-gradient(circle at 50% 0%, var(--surface) 0%, var(--bg) 70%);
  }

  .landing-header {
    margin-bottom: 4rem;
    text-align: center;
  }

  .brand-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .brand h1 {
    font-size: 3rem;
    letter-spacing: 0.2em;
    margin: 0;
    color: var(--text-primary);
  }

  .highlight {
    color: #f87171;
    text-shadow: 0 0 10px rgba(248, 113, 113, 0.3);
  }

  .tagline {
    font-size: 1rem;
    color: var(--text-muted);
    margin-top: 0.5rem;
    letter-spacing: 0.1em;
  }

  .landing-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4rem;
  }

  h2 {
    font-size: 1.2rem;
    color: var(--text-faint);
    letter-spacing: 0.3em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .intro p {
    font-size: 1.1rem;
    line-height: 1.6;
    max-width: 800px;
    color: var(--text-secondary);
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .feature-card {
    background: var(--bg-deep);
    border: 1px solid var(--border);
    padding: 1.5rem;
  }

  .feature-card h3 {
    font-size: 0.9rem;
    color: var(--text-primary);
    margin-top: 0;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
  }

  .feature-card p {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0;
  }

  .level-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 2rem;
  }

  .level-card {
    position: relative;
    background: var(--surface-raised);
    border: 1px solid var(--border-strong);
    padding: 2rem;
    text-decoration: none;
    color: inherit;
    transition:
      transform 0.2s,
      border-color 0.2s;
    overflow: hidden;
  }

  .level-card:hover {
    transform: translateY(-5px);
    border-color: #f8717155;
  }

  .level-card h3 {
    font-size: 1.4rem;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .level-card p {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 2rem;
    line-height: 1.5;
  }

  .level-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }

  .difficulty {
    color: var(--text-faint);
  }

  .action {
    color: #f87171;
    font-weight: bold;
  }

  .level-card-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent, rgba(248, 113, 113, 0.05), transparent);
    pointer-events: none;
  }

  .custom-card:hover {
    border-color: #4ade8055;
  }

  .custom-action {
    color: #4ade80;
  }

  .custom-glow {
    background: linear-gradient(45deg, transparent, rgba(74, 222, 128, 0.05), transparent);
  }

  .landing-footer {
    margin-top: 4rem;
    padding-top: 2rem;
    border-top: 1px solid var(--surface);
    text-align: center;
    color: var(--border-strong);
    font-size: 0.7rem;
  }

  @media (max-width: 640px) {
    .landing-container {
      padding: 1rem;
    }

    .landing-content {
      gap: 2rem;
    }

    .brand h1 {
      font-size: 2rem;
    }

    .landing-header {
      margin-bottom: 2rem;
    }

    .level-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
</style>

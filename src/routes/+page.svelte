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
  <div class="grid-overlay"></div>

  <header class="landing-header">
    <div class="brand" in:fly={{ y: -20, duration: 800 }}>
      <div class="brand-row">
        <h1>ONCALL <span class="highlight">SIMULATOR</span></h1>
        <div class="theme-wrapper">
          <ThemeToggle />
        </div>
      </div>
      <p class="tagline">Experience the thrill and terror of systems at scale.</p>
      <div class="system-status-pill">
        <span class="status-indicator-ping"></span>
        <span class="status-indicator-text">SYSTEM STATUS: OPERATIONAL</span>
      </div>
    </div>
  </header>

  <main class="landing-content">
    <section class="intro" in:fade={{ delay: 300, duration: 800 }}>
      <h2>SYSTEM OVERVIEW</h2>
      <p class="intro-desc">
        Welcome, Engineer. You are tasked with maintaining high-availability infrastructure. Each
        level simulates real-world production architectures. Monitor real-time telemetry, scale
        compute groups, respond to cascading incidents, and keep systems online.
      </p>

      <div class="features">
        <div class="feature-card">
          <div class="card-accent accent-physics"></div>
          <h3>Real-time Physics</h3>
          <p>
            Simulates queue backlogs, database locking, resource contention, and cascading traffic
            failures.
          </p>
        </div>
        <div class="feature-card">
          <div class="card-accent accent-incident"></div>
          <h3>Incident Response</h3>
          <p>
            Acknowledge SEV tickets, review logs, check system utilization limits, and deploy
            hotfixes.
          </p>
        </div>
        <div class="feature-card">
          <div class="card-accent accent-docs"></div>
          <h3>Runbooks</h3>
          <p>
            Consult technical documentation. They are your primary guide when system components are
            failing.
          </p>
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
              <div class="level-header-row">
                <h3>{level.name}</h3>
                <span class="system-badge">MISSION</span>
              </div>
              <p>{level.description}</p>

              <div class="level-meta">
                <span class="difficulty">ID: {level.id}</span>
                <span class="action">INIT_SEQUENCE ></span>
              </div>
            </div>
            {#if hoveredLevel === level.id}
              <div class="level-card-glow" transition:fade={{ duration: 250 }}></div>
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
            <div class="level-header-row">
              <h3>Custom Level</h3>
              <span class="system-badge custom-badge">SANDBOX</span>
            </div>
            <p>
              Upload or paste your own JSON level configuration and test your architecture under
              load.
            </p>

            <div class="level-meta">
              <span class="difficulty">ID: custom</span>
              <span class="action custom-action">DEPLOY_CUSTOM ></span>
            </div>
          </div>
          {#if hoveredLevel === '__custom'}
            <div class="level-card-glow custom-glow" transition:fade={{ duration: 250 }}></div>
          {/if}
        </a>
      </div>
    </section>
  </main>

  <footer class="landing-footer">
    <div class="footer-left">
      <span class="version">v0.1.0-alpha | PLATFORM: SVELTE 5</span>
    </div>
    <div class="footer-right">
      <span class="log-level">LOG_LEVEL: <span class="log-info">INFO</span></span>
    </div>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
  }

  .landing-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 3rem 2rem;
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
    box-sizing: border-box;
  }

  .grid-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image:
      radial-gradient(var(--border) 1px, transparent 1px),
      radial-gradient(var(--border) 1px, transparent 1px);
    background-size: 40px 40px;
    background-position:
      0 0,
      20px 20px;
    opacity: 0.15;
    pointer-events: none;
    z-index: 0;
  }

  .landing-header {
    margin-bottom: 5rem;
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .brand-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    position: relative;
  }

  .theme-wrapper {
    display: inline-flex;
    align-items: center;
  }

  .brand h1 {
    font-size: 3.5rem;
    font-weight: 800;
    letter-spacing: 0.15em;
    margin: 0;
    color: var(--text-primary);
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .highlight {
    color: var(--critical);
    text-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
  }

  .tagline {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin-top: 0.75rem;
    letter-spacing: 0.08em;
    font-weight: 400;
  }

  .system-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    padding: 0.35rem 0.9rem;
    border-radius: 50px;
    margin-top: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .status-indicator-ping {
    width: 8px;
    height: 8px;
    background: var(--success);
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 10px var(--success);
    animation: pulse-ping 2s infinite;
  }

  @keyframes pulse-ping {
    0% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
    }
    70% {
      transform: scale(1);
      box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
    }
    100% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }

  .status-indicator-text {
    font-size: 0.65rem;
    font-weight: bold;
    letter-spacing: 0.1em;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .landing-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5rem;
    position: relative;
    z-index: 1;
  }

  h2 {
    font-size: 0.9rem;
    color: var(--text-muted);
    letter-spacing: 0.25em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.75rem;
    margin-bottom: 2rem;
    font-family: var(--font-mono);
    font-weight: bold;
  }

  .intro-desc {
    font-size: 1.15rem;
    line-height: 1.6;
    max-width: 900px;
    color: var(--text);
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-top: 3rem;
  }

  .feature-card {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 1.75rem;
    position: relative;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    transition:
      transform 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    border-color: var(--border-strong);
    box-shadow: var(--shadow-lg);
  }

  .card-accent {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
  }

  .accent-physics {
    background: var(--accent);
  }
  .accent-incident {
    background: var(--critical);
  }
  .accent-docs {
    background: var(--warning);
  }

  .feature-card h3 {
    font-size: 1.1rem;
    color: var(--text-primary);
    margin-top: 0.25rem;
    margin-bottom: 0.75rem;
    font-weight: 700;
  }

  .feature-card p {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .level-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 2rem;
  }

  .level-card {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    padding: 2.25rem;
    text-decoration: none;
    color: inherit;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    transition:
      transform 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .level-card:hover {
    transform: translateY(-4px);
    border-color: var(--critical);
    box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.15);
  }

  .level-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .level-card h3 {
    font-size: 1.4rem;
    margin: 0;
    color: var(--text-primary);
    font-weight: 700;
  }

  .system-badge {
    font-size: 0.6rem;
    font-family: var(--font-mono);
    font-weight: bold;
    background: var(--border-strong);
    color: var(--text-secondary);
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .level-card p {
    font-size: 0.95rem;
    color: var(--text-secondary);
    margin-bottom: 2.25rem;
    line-height: 1.5;
    flex: 1;
  }

  .level-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    border-top: 1px solid var(--border);
    padding-top: 1.25rem;
    font-family: var(--font-mono);
  }

  .difficulty {
    color: var(--text-muted);
  }

  .action {
    color: var(--critical);
    font-weight: bold;
    letter-spacing: 0.05em;
  }

  .level-card-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 100% 0%, var(--critical-glow) 0%, transparent 60%);
    pointer-events: none;
  }

  /* Custom level card specificity overrides */
  .custom-card:hover {
    border-color: var(--success);
    box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.15);
  }

  .custom-badge {
    background: var(--success-glow);
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .custom-action {
    color: var(--success);
  }

  .custom-glow {
    background: radial-gradient(circle at 100% 0%, var(--success-glow) 0%, transparent 60%);
  }

  .landing-footer {
    margin-top: 6rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-family: var(--font-mono);
    position: relative;
    z-index: 1;
  }

  .log-info {
    color: var(--success);
    font-weight: bold;
  }

  @media (max-width: 768px) {
    .landing-container {
      padding: 2rem 1rem;
    }

    .landing-header {
      margin-bottom: 3rem;
    }

    .brand h1 {
      font-size: 2.2rem;
    }

    .landing-content {
      gap: 3rem;
    }

    .level-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .landing-footer {
      flex-direction: column;
      gap: 0.5rem;
      text-align: center;
    }
  }
</style>

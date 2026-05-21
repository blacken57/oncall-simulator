<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import { onMount } from 'svelte';
  import { theme } from '$lib/theme.svelte';

  let { children } = $props();

  onMount(() => theme.init());
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
  :global(:root) {
    /* Theme colors: Dark Mode (Default) */
    --bg: #0b0f19;
    --bg-deep: #070911;
    --surface: #121826;
    --surface-raised: #182235;
    --surface-subtle: #202c45;
    --border: #1f2a3f;
    --border-strong: #2f3e5f;
    --border-active: #3b82f6;

    --success: #10b981;
    --success-glow: rgba(16, 185, 129, 0.15);
    --warning: #f59e0b;
    --warning-glow: rgba(245, 158, 11, 0.15);
    --critical: #ef4444;
    --critical-glow: rgba(239, 68, 68, 0.15);
    --accent: #3b82f6;
    --accent-glow: rgba(59, 130, 246, 0.15);

    --text-primary: #f8fafc;
    --text: #cbd5e1;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --text-faint: #475569;

    --font-sans:
      'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
      sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;

    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
    --shadow-glow: 0 0 15px rgba(59, 130, 246, 0.1);
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
  }

  :global([data-theme='light']) {
    /* Theme colors: Light Mode */
    --bg: #f8fafc;
    --bg-deep: #f1f5f9;
    --surface: #ffffff;
    --surface-raised: #f8fafc;
    --surface-subtle: #e2e8f0;
    --border: #cbd5e1;
    --border-strong: #94a3b8;
    --border-active: #2563eb;

    --success: #059669;
    --success-glow: rgba(5, 150, 105, 0.12);
    --warning: #d97706;
    --warning-glow: rgba(217, 119, 6, 0.12);
    --critical: #dc2626;
    --critical-glow: rgba(220, 38, 38, 0.12);
    --accent: #2563eb;
    --accent-glow: rgba(37, 99, 235, 0.12);

    --text-primary: #0f172a;
    --text: #334155;
    --text-secondary: #475569;
    --text-muted: #64748b;
    --text-faint: #94a3b8;

    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
    --shadow-glow: 0 0 15px rgba(37, 99, 235, 0.05);
  }

  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Custom Professional Scrollbar styling */
  :global(::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }

  :global(::-webkit-scrollbar-track) {
    background: var(--bg-deep);
  }

  :global(::-webkit-scrollbar-thumb) {
    background: var(--border-strong);
    border-radius: var(--radius-sm);
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: var(--text-faint);
  }
</style>

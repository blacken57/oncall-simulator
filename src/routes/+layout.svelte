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
    --bg: #000;
    --bg-deep: #050505;
    --surface-raised: #0a0a0a;
    --surface: #111;
    --surface-subtle: #1a1a1a;
    --border: #222;
    --border-strong: #333;
    --text-primary: #fff;
    --text: #e0e0e0;
    --text-secondary: #aaa;
    --text-muted: #666;
    --text-faint: #444;
  }

  :global([data-theme='light']) {
    --bg: #f0f0f0;
    --bg-deep: #f5f5f5;
    --surface-raised: #e8e8e8;
    --surface: #fff;
    --surface-subtle: #ebebeb;
    --border: #d0d0d0;
    --border-strong: #bbb;
    --text-primary: #111;
    --text: #222;
    --text-secondary: #555;
    --text-muted: #888;
    --text-faint: #aaa;
  }
</style>

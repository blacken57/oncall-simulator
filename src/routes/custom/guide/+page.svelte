<script lang="ts">
  import DocsView from '../../../components/Docs/DocsView.svelte';
</script>

<div class="guide-page">
  <header class="guide-header">
    <a href="/custom" class="back-link">← BACK TO DEPLOY</a>
    <h1>LEVEL CREATION <span class="highlight">GUIDE</span></h1>
  </header>
  <div class="docs-container">
    <DocsView levelId="custom" />
  </div>
</div>

<style>
  .guide-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #000;
  }

  .guide-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #222;
    background: #0a0a0a;
  }

  .back-link {
    color: #555;
    text-decoration: none;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    display: inline-block;
    margin-bottom: 0.75rem;
  }

  .back-link:hover {
    color: #aaa;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    letter-spacing: 0.15em;
    color: #fff;
  }

  .highlight {
    color: #4ade80;
  }

  .docs-container {
    flex: 1;
    overflow: hidden;
  }
</style>

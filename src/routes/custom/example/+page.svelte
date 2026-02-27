<script lang="ts">
  import level1 from '../../../data/level1.json';
  const jsonCode = JSON.stringify(level1, null, 2);
</script>

<div class="example-page">
  <header class="example-header">
    <a href="/custom" class="back-link">← BACK TO DEPLOY</a>
    <h1>EXAMPLE <span class="highlight">LEVEL1.JSON</span></h1>
    <p class="subtitle">Use this as a template for your own custom levels.</p>
  </header>

  <main class="code-container">
    <div class="code-header">
      <span class="filename">level1.json</span>
      <button class="copy-btn" onclick={() => navigator.clipboard.writeText(jsonCode)}>
        COPY CODE
      </button>
    </div>
    <pre><code>{jsonCode}</code></pre>
  </main>
</div>

<style>
  .example-page {
    min-height: 100vh;
    background: #000;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
  }

  .example-header {
    padding: 2rem;
    background: #0a0a0a;
    border-bottom: 1px solid #222;
  }

  .back-link {
    color: #555;
    text-decoration: none;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    display: inline-block;
    margin-bottom: 1rem;
  }

  .back-link:hover {
    color: #aaa;
  }

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.8rem;
    letter-spacing: 0.15em;
    color: #fff;
  }

  .highlight {
    color: #4ade80;
  }

  .subtitle {
    color: #666;
    font-size: 0.85rem;
    margin: 0;
  }

  .code-container {
    flex: 1;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #111;
    border: 1px solid #333;
    border-bottom: none;
    padding: 0.75rem 1.25rem;
  }

  .filename {
    font-size: 0.75rem;
    color: #888;
    letter-spacing: 0.1em;
  }

  .copy-btn {
    background: none;
    border: 1px solid #444;
    color: #4ade80;
    font-family: inherit;
    font-size: 0.7rem;
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .copy-btn:hover {
    background: #4ade8022;
    border-color: #4ade80;
  }

  pre {
    flex: 1;
    margin: 0;
    padding: 1.5rem;
    background: #080808;
    border: 1px solid #333;
    overflow-x: auto;
    line-height: 1.5;
  }

  code {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 0.9rem;
    color: #ccc;
  }
</style>

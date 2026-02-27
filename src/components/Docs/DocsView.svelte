<script lang="ts">
  import { marked } from 'marked';

  interface Props {
    levelId?: string;
  }

  let { levelId = 'level-1' }: Props = $props();

  // Load all markdown files from the docs directory recursively
  const docs = import.meta.glob('../../data/docs/**/*.md', { query: '?raw', eager: true });

  let currentDoc = $state('index.md');

  // Filter docs for the current level
  const filteredDocs = $derived.by(() => {
    const prefix = `../../data/docs/${levelId}/`;
    const result: Record<string, string> = {};
    for (const [path, content] of Object.entries(docs)) {
      if (path.startsWith(prefix)) {
        const relativePath = path.replace(prefix, '');
        result[relativePath] = (content as any).default as string;
      }
    }
    return result;
  });

  let htmlContent = $derived.by(() => {
    const raw = filteredDocs[currentDoc];
    if (!raw) return '# Error\nDocument not found.';
    return marked.parse(raw);
  });

  function navigate(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href && href.endsWith('.md')) {
        e.preventDefault();
        currentDoc = href;
        // Scroll to top of the view
        const container = document.querySelector('.docs-content');
        if (container) container.scrollTop = 0;
      }
    }
  }

  // Sidebar list based on filtered docs
  const docList = $derived(
    Object.keys(filteredDocs).map((filename) => {
      return {
        filename,
        label: filename
          .replace('.md', '')
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      };
    })
  );
</script>

<div class="docs-view">
  <aside class="docs-sidebar">
    <header>DOCUMENTATION ({docList.length})</header>
    <nav>
      {#each docList as doc}
        <button
          class="doc-nav-item {currentDoc === doc.filename ? 'active' : ''}"
          onclick={() => (currentDoc = doc.filename)}
        >
          {doc.label}
        </button>
      {/each}
    </nav>
  </aside>

  <main class="docs-content">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="markdown-container" onclick={navigate}>
      <article class="markdown-body">
        {@html htmlContent}
      </article>
    </div>
  </main>
</div>

<style>
  .docs-view {
    display: flex;
    height: 100%;
    background: #050505;
  }

  .docs-sidebar {
    width: 200px;
    background: #0a0a0a;
    border-right: 1px solid #222;
    padding: 1.5rem 0;
    display: flex;
    flex-direction: column;
  }

  .docs-sidebar header {
    padding: 0 1.5rem;
    font-size: 0.7rem;
    font-weight: bold;
    color: #444;
    letter-spacing: 0.2em;
    margin-bottom: 1rem;
  }

  .doc-nav-item {
    background: none;
    border: none;
    color: #888;
    padding: 0.6rem 1.5rem;
    text-align: left;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    width: 100%;
    transition: all 0.2s;
  }

  .doc-nav-item:hover {
    color: #eee;
    background: #111;
  }

  .doc-nav-item.active {
    color: #f87171;
    background: #111;
    border-left: 2px solid #f87171;
  }

  .docs-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 4rem;
    line-height: 1.6;
  }

  /* Markdown Styling */
  .markdown-body {
    color: #ccc;
    max-width: 800px;
  }

  :global(.markdown-body h1) {
    color: #fff;
    font-size: 2rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #222;
    padding-bottom: 0.5rem;
  }

  :global(.markdown-body h2) {
    color: #eee;
    font-size: 1.4rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  :global(.markdown-body p) {
    margin-bottom: 1rem;
  }

  :global(.markdown-body a) {
    color: #f87171;
    text-decoration: none;
  }

  :global(.markdown-body a:hover) {
    text-decoration: underline;
  }

  :global(.markdown-body ul) {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }

  :global(.markdown-body li) {
    margin-bottom: 0.5rem;
  }

  :global(.markdown-body table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.5rem;
    font-size: 0.85rem;
  }

  :global(.markdown-body th) {
    background: #111;
    color: #fff;
    text-align: left;
    padding: 0.75rem;
    border: 1px solid #222;
  }

  :global(.markdown-body td) {
    padding: 0.75rem;
    border: 1px solid #222;
    color: #aaa;
  }

  :global(.markdown-body tr:nth-child(even)) {
    background: #080808;
  }

  :global(.markdown-body code) {
    background: #222;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9em;
  }

  :global(.markdown-body strong) {
    color: #fff;
  }
</style>

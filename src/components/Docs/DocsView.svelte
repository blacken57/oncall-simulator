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

  function navigateToDoc(target: HTMLElement, e: Event) {
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href && href.endsWith('.md')) {
        e.preventDefault();
        currentDoc = href;
        const container = document.querySelector('.docs-content');
        if (container) container.scrollTop = 0;
      }
    }
  }

  function navigate(e: MouseEvent) {
    navigateToDoc(e.target as HTMLElement, e);
  }

  function navigateKeyboard(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      navigateToDoc(e.target as HTMLElement, e);
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
    <header>runbook files</header>
    <nav>
      {#each docList as doc}
        <button
          class="doc-nav-item {currentDoc === doc.filename ? 'active' : ''}"
          onclick={() => (currentDoc = doc.filename)}
        >
          <span class="file-icon">📄</span>
          <span class="file-label">{doc.label}</span>
        </button>
      {/each}
    </nav>
  </aside>

  <main class="docs-content">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="markdown-container"
      onclick={navigate}
      onkeydown={navigateKeyboard}
      role="region"
      aria-label="Documentation content"
    >
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
    background: var(--bg);
    box-sizing: border-box;
  }

  .docs-sidebar {
    width: 220px;
    background: var(--bg-deep);
    border-right: 1px solid var(--border);
    padding: 1.25rem 0;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .docs-sidebar header {
    padding: 0 1.25rem;
    font-size: 0.6rem;
    font-weight: bold;
    color: var(--text-muted);
    letter-spacing: 0.25em;
    text-transform: uppercase;
    margin-bottom: 1rem;
    font-family: var(--font-mono);
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .doc-nav-item {
    background: none;
    border: none;
    color: var(--text-secondary);
    padding: 0.5rem 1.25rem;
    text-align: left;
    cursor: pointer;
    font-size: 0.8rem;
    font-family: var(--font-sans);
    width: 100%;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-left: 3px solid transparent;
  }

  .doc-nav-item:hover {
    color: var(--text-primary);
    background: var(--surface-raised);
  }

  .doc-nav-item.active {
    color: var(--accent);
    background: var(--surface-raised);
    border-left-color: var(--accent);
    font-weight: 600;
  }

  .file-icon {
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .doc-nav-item.active .file-icon {
    opacity: 1;
  }

  .docs-content {
    flex: 1;
    overflow-y: auto;
    padding: 2.5rem 3.5rem;
    line-height: 1.7;
    background: var(--bg);
  }

  /* Custom scrollbar for docs content */
  .docs-content::-webkit-scrollbar {
    width: 6px;
  }
  .docs-content::-webkit-scrollbar-track {
    background: transparent;
  }
  .docs-content::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  .docs-content::-webkit-scrollbar-thumb:hover {
    background: var(--border-strong);
  }

  /* Markdown Styling (Gitbook Console Theme) */
  .markdown-body {
    color: var(--text);
    max-width: 800px;
    font-family: var(--font-sans);
    font-size: 0.925rem;
  }

  :global(.markdown-body h1) {
    color: var(--text-primary);
    font-size: 1.8rem;
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }

  :global(.markdown-body h2) {
    color: var(--text-primary);
    font-size: 1.3rem;
    font-weight: 600;
    margin-top: 2rem;
    margin-bottom: 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    padding-bottom: 0.25rem;
    letter-spacing: -0.01em;
  }

  :global(.markdown-body h3) {
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }

  :global(.markdown-body p) {
    margin-bottom: 1.25rem;
  }

  :global(.markdown-body a) {
    color: var(--accent);
    text-decoration: none;
    border-bottom: 1px dashed rgba(59, 130, 246, 0.4);
    transition: all 0.2s ease;
  }

  :global(.markdown-body a:hover) {
    color: var(--text-primary);
    border-bottom-style: solid;
    border-bottom-color: var(--accent);
  }

  :global(.markdown-body ul, .markdown-body ol) {
    margin-bottom: 1.25rem;
    padding-left: 1.5rem;
  }

  :global(.markdown-body li) {
    margin-bottom: 0.5rem;
  }

  :global(.markdown-body blockquote) {
    margin: 1.5rem 0;
    padding: 0.75rem 1.25rem;
    background: var(--surface-raised);
    border-left: 4px solid var(--accent);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    color: var(--text-secondary);
  }

  :global(.markdown-body blockquote p:last-child) {
    margin-bottom: 0;
  }

  :global(.markdown-body table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  :global(.markdown-body th) {
    background: var(--surface-raised);
    color: var(--text-primary);
    text-align: left;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    font-family: var(--font-sans);
    font-weight: 600;
  }

  :global(.markdown-body td) {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    color: var(--text);
  }

  :global(.markdown-body tr:nth-child(even)) {
    background: var(--bg-deep);
  }

  /* Inline code formatting */
  :global(.markdown-body code) {
    background: var(--surface-raised);
    padding: 0.15rem 0.35rem;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.85em;
    color: #e0f2fe;
    border: 1px solid var(--border);
  }

  /* Code blocks formatting */
  :global(.markdown-body pre) {
    background: var(--bg-deep);
    border: 1px solid var(--border);
    padding: 1rem;
    border-radius: var(--radius-md);
    overflow-x: auto;
    margin-bottom: 1.5rem;
  }

  :global(.markdown-body pre code) {
    background: transparent;
    padding: 0;
    border: none;
    font-size: 0.8rem;
    color: var(--text);
  }

  :global(.markdown-body strong) {
    color: var(--text-primary);
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .docs-view {
      flex-direction: column;
    }

    .docs-sidebar {
      width: 100%;
      flex-direction: row;
      overflow-x: auto;
      border-right: none;
      border-bottom: 1px solid var(--border);
      padding: 0;
      height: auto;
      min-height: unset;
    }

    .docs-sidebar header {
      display: none;
    }

    nav {
      flex-direction: row;
      gap: 0;
      width: 100%;
    }

    .doc-nav-item {
      white-space: nowrap;
      padding: 0.75rem 1rem;
      border-left: none !important;
      border-bottom: 2px solid transparent;
      width: auto;
      justify-content: center;
    }

    .doc-nav-item.active {
      border-left: none;
      border-bottom-color: var(--accent);
    }

    .docs-content {
      padding: 1.5rem;
    }
  }
</style>

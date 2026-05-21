<script lang="ts">
  import { goto } from '$app/navigation';
  import { validateLevel, type ValidationError } from '$lib/game/validator';
  import { customLevelStore } from '$lib/game/customLevel.svelte';
  import type { LevelConfig } from '$lib/game/schema';

  let jsonText = $state('');
  let fileInput: HTMLInputElement;

  type ValidationState =
    | { kind: 'idle' }
    | { kind: 'parse-error'; message: string }
    | { kind: 'schema-errors'; errors: ValidationError[] }
    | { kind: 'valid'; config: LevelConfig };

  let validation = $state<ValidationState>({ kind: 'idle' });

  function loadFile() {
    fileInput.click();
  }

  function onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      jsonText = (e.target?.result as string) ?? '';
      validation = { kind: 'idle' };
    };
    reader.readAsText(file);
  }

  function validate() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      validation = { kind: 'parse-error', message: (e as Error).message };
      return;
    }
    const errors = validateLevel(parsed as LevelConfig);
    if (errors.length > 0) {
      validation = { kind: 'schema-errors', errors };
    } else {
      validation = { kind: 'valid', config: parsed as LevelConfig };
    }
  }

  function loadLevel() {
    if (validation.kind !== 'valid') return;
    customLevelStore.config = validation.config;
    goto('/game/custom');
  }

  function onTextareaInput() {
    if (validation.kind !== 'idle') {
      validation = { kind: 'idle' };
    }
  }
</script>

<div class="page-container">
  <div class="grid-overlay"></div>

  <header class="editor-header">
    <a href="/" class="back-link">← BACK TO TERMINAL</a>
    <h1>DEPLOY <span class="highlight">CUSTOM LEVEL</span></h1>
    <p class="subtitle">
      Paste or upload a JSON level config to play it in the simulator. See the
      <a href="/custom/guide" class="doc-link">level creation guide</a>
      for the schema reference, or open
      <a href="/custom/example" class="doc-link">level1.json</a> as a template.
    </p>
  </header>

  <div class="editor-workspace">
    <div class="input-section">
      <div class="editor-terminal-window">
        <div class="terminal-bar">
          <div class="terminal-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <span class="terminal-title">level_config.json</span>
          <div class="terminal-actions">
            <button class="btn-secondary" onclick={loadFile}>LOAD FILE</button>
            <input
              bind:this={fileInput}
              type="file"
              accept=".json"
              class="hidden-input"
              onchange={onFileChange}
            />
          </div>
        </div>

        <div class="textarea-wrapper">
          <textarea
            bind:value={jsonText}
            oninput={onTextareaInput}
            rows={20}
            spellcheck={false}
            placeholder={'{\n  "id": "my-custom-level",\n  "name": "My Custom Level",\n  "description": "Describe the architecture and incident challenges...",\n  "timeLimit": 300,\n  ...\n}'}
            aria-label="Level JSON Configuration"
          ></textarea>
        </div>
      </div>

      <div class="action-row">
        <button class="btn-primary" onclick={validate} disabled={jsonText.trim() === ''}>
          VALIDATE CONFIG
        </button>
        {#if validation.kind === 'valid'}
          <button class="btn-launch" onclick={loadLevel}> INITIALIZE SIMULATOR → </button>
        {/if}
      </div>
    </div>

    <div class="result-sidebar">
      <h2 class="sidebar-title">DIAGNOSTIC CONSOLE</h2>

      {#if validation.kind === 'idle'}
        <div class="result-panel idle">
          <div class="pulse-icon">⚡</div>
          <div class="result-title">AWAITING VALIDATION</div>
          <p class="result-body">
            Enter your level JSON payload above and trigger validation to run telemetry integrity
            checks.
          </p>
        </div>
      {:else if validation.kind === 'parse-error'}
        <div class="result-panel error">
          <div class="result-title">SYNTAX ERROR</div>
          <pre class="result-body">{validation.message}</pre>
        </div>
      {:else if validation.kind === 'schema-errors'}
        <div class="result-panel error">
          <div class="result-title">INTEGRITY CHECK FAILED ({validation.errors.length} errors)</div>
          <ul class="error-list">
            {#each validation.errors as err}
              <li>
                <span class="err-path">[{err.path}]</span>
                <span class="err-msg">{err.message}</span>
              </li>
            {/each}
          </ul>
        </div>
      {:else if validation.kind === 'valid'}
        <div class="result-panel success">
          <div class="result-title">✓ VALIDATION PASSED</div>
          <h3 class="success-level-name">{validation.config.name}</h3>
          <p class="result-body">{validation.config.description}</p>
          <div class="diagnostic-meta">
            <div class="meta-item">
              <span class="meta-lbl">TIME LIMIT:</span>
              <span class="meta-val">{validation.config.timeLimit}s</span>
            </div>
            <div class="meta-item">
              <span class="meta-lbl">COMPONENTS:</span>
              <span class="meta-val">{validation.config.components.length}</span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
  }

  .page-container {
    min-height: 100vh;
    max-width: 1200px;
    margin: 0 auto;
    padding: 3rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 3rem;
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
    opacity: 0.12;
    pointer-events: none;
    z-index: 0;
  }

  .editor-header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 1.5rem;
    position: relative;
    z-index: 1;
  }

  .back-link {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    font-family: var(--font-mono);
    font-weight: bold;
    display: inline-block;
    margin-bottom: 1rem;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  h1 {
    margin: 0 0 0.75rem 0;
    font-size: 2.2rem;
    letter-spacing: 0.1em;
    color: var(--text-primary);
    font-weight: 800;
  }

  .highlight {
    color: var(--success);
    text-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: 0.95rem;
    margin: 0;
    line-height: 1.6;
  }

  .doc-link {
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
  }

  .doc-link:hover {
    text-decoration: underline;
  }

  .editor-workspace {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 2rem;
    position: relative;
    z-index: 1;
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .editor-terminal-window {
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  .terminal-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface-raised);
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }

  .terminal-dots {
    display: flex;
    gap: 0.4rem;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: block;
  }

  .dot.red {
    background: var(--critical);
  }
  .dot.yellow {
    background: var(--warning);
  }
  .dot.green {
    background: var(--success);
  }

  .terminal-title {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    font-weight: 600;
  }

  .textarea-wrapper {
    position: relative;
  }

  textarea {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 1.25rem;
    resize: vertical;
    outline: none;
    line-height: 1.6;
    box-sizing: border-box;
    display: block;
  }

  textarea::placeholder {
    color: var(--text-faint);
  }

  .action-row {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .btn-primary {
    background: var(--surface);
    border: 1px solid var(--border-strong);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--surface-subtle);
    border-color: var(--border-active);
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--surface);
    border: 1px solid var(--border-strong);
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.35rem 0.85rem;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    border-color: var(--text-secondary);
    color: var(--text-primary);
  }

  .btn-launch {
    background: var(--success);
    border: 1px solid var(--success);
    color: #ffffff;
    font-family: var(--font-sans);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all 0.2s;
    box-shadow: 0 4px 15px -3px var(--success-glow);
  }

  .btn-launch:hover {
    background: #0ea5e9;
    border-color: #0ea5e9;
    box-shadow: 0 4px 15px -3px rgba(14, 165, 233, 0.3);
  }

  .hidden-input {
    display: none;
  }

  .result-sidebar {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-shadow: var(--shadow-sm);
    max-height: 520px;
    overflow-y: auto;
  }

  .sidebar-title {
    margin: 0;
    font-size: 0.75rem;
    font-weight: bold;
    color: var(--text-muted);
    letter-spacing: 0.15em;
    font-family: var(--font-mono);
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.75rem;
  }

  .result-panel {
    border-radius: var(--radius-md);
    padding: 1.25rem;
    border: 1px solid transparent;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .result-panel.idle {
    border-color: var(--border);
    background: var(--bg-deep);
    text-align: center;
    color: var(--text-secondary);
    padding: 2rem 1.5rem;
  }

  .pulse-icon {
    font-size: 1.8rem;
    margin-bottom: 0.75rem;
    color: var(--text-faint);
  }

  .result-panel.error {
    border-color: rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.05);
    align-items: stretch;
    justify-content: flex-start;
  }

  .result-panel.success {
    border-color: rgba(16, 185, 129, 0.2);
    background: rgba(16, 185, 129, 0.05);
    justify-content: flex-start;
  }

  .result-title {
    font-size: 0.75rem;
    font-weight: bold;
    letter-spacing: 0.1em;
    margin-bottom: 0.75rem;
    font-family: var(--font-mono);
  }

  .result-panel.error .result-title {
    color: var(--critical);
  }

  .result-panel.success .result-title {
    color: var(--success);
  }

  .success-level-name {
    font-size: 1.25rem;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-weight: 700;
  }

  .result-body {
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin: 0;
    line-height: 1.5;
  }

  .result-panel.error pre.result-body {
    font-family: var(--font-mono);
    background: var(--bg-deep);
    padding: 1rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    overflow-x: auto;
    color: #fca5a5;
    font-size: 0.8rem;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .error-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 350px;
    overflow-y: auto;
  }

  .error-list li {
    font-size: 0.8rem;
    color: var(--text);
    line-height: 1.5;
    font-family: var(--font-mono);
    border-bottom: 1px solid rgba(239, 68, 68, 0.1);
    padding-bottom: 0.5rem;
  }

  .error-list li:last-child {
    border-bottom: none;
  }

  .err-path {
    color: var(--critical);
    font-weight: bold;
    display: block;
    margin-bottom: 0.15rem;
  }

  .err-msg {
    color: var(--text-secondary);
  }

  .diagnostic-meta {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(16, 185, 129, 0.1);
    display: flex;
    gap: 1.5rem;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-lbl {
    font-size: 0.6rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .meta-val {
    font-size: 0.95rem;
    font-family: var(--font-mono);
    font-weight: bold;
    color: var(--text-primary);
  }

  @media (max-width: 900px) {
    .editor-workspace {
      grid-template-columns: 1fr;
    }

    .result-sidebar {
      max-height: none;
    }
  }
</style>

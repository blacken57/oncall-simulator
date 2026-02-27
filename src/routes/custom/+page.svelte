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

<div class="page">
  <header>
    <a href="/" class="back-link">← BACK</a>
    <h1>DEPLOY <span class="highlight">CUSTOM LEVEL</span></h1>
    <p class="subtitle">
      Paste or upload a JSON level config to play it in the simulator. See the
      <a href="/custom/guide" class="doc-link">level creation guide</a>
      for the schema reference, or open
      <a href="/custom/example" class="doc-link">level1.json</a> as a worked example.
    </p>
  </header>

  <div class="input-section">
    <div class="toolbar">
      <span class="toolbar-label">CONFIG INPUT</span>
      <button class="btn-secondary" onclick={loadFile}>LOAD FROM FILE</button>
      <input
        bind:this={fileInput}
        type="file"
        accept=".json"
        class="hidden-input"
        onchange={onFileChange}
      />
    </div>

    <textarea
      bind:value={jsonText}
      oninput={onTextareaInput}
      rows={22}
      spellcheck={false}
      placeholder={'{\n  "id": "my-level",\n  "name": "My Custom Level",\n  ...\n}'}
    ></textarea>

    <div class="action-row">
      <button class="btn-primary" onclick={validate} disabled={jsonText.trim() === ''}>
        VALIDATE
      </button>
      {#if validation.kind === 'valid'}
        <button class="btn-launch" onclick={loadLevel}> LOAD LEVEL → </button>
      {/if}
    </div>
  </div>

  {#if validation.kind === 'parse-error'}
    <div class="result-panel error">
      <div class="result-title">SYNTAX ERROR</div>
      <pre class="result-body">{validation.message}</pre>
    </div>
  {:else if validation.kind === 'schema-errors'}
    <div class="result-panel error">
      <div class="result-title">VALIDATION FAILED — {validation.errors.length} error(s)</div>
      <ul class="error-list">
        {#each validation.errors as err}
          <li><span class="err-path">[{err.path}]</span> {err.message}</li>
        {/each}
      </ul>
    </div>
  {:else if validation.kind === 'valid'}
    <div class="result-panel success">
      <div class="result-title">VALID — {validation.config.name}</div>
      <p class="result-body">{validation.config.description}</p>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    background: #000;
    color: #e0e0e0;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
  }

  .page {
    min-height: 100vh;
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  header {
    border-bottom: 1px solid #222;
    padding-bottom: 1.5rem;
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
    margin: 0 0 0.75rem 0;
    font-size: 2rem;
    letter-spacing: 0.2em;
    color: #fff;
  }

  .highlight {
    color: #4ade80;
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.3);
  }

  .subtitle {
    color: #666;
    font-size: 0.85rem;
    margin: 0;
    line-height: 1.5;
  }

  .doc-link {
    color: #4ade80;
    text-decoration: none;
  }

  .doc-link:hover {
    text-decoration: underline;
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .toolbar-label {
    font-size: 0.7rem;
    color: #444;
    letter-spacing: 0.3em;
    flex: 1;
  }

  textarea {
    width: 100%;
    background: #080808;
    border: 1px solid #333;
    color: #e0e0e0;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 0.85rem;
    padding: 1rem;
    resize: vertical;
    outline: none;
    line-height: 1.5;
    box-sizing: border-box;
  }

  textarea:focus {
    border-color: #555;
  }

  textarea::placeholder {
    color: #333;
  }

  .action-row {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .btn-primary {
    background: #111;
    border: 1px solid #f87171;
    color: #f87171;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: bold;
    letter-spacing: 0.15em;
    padding: 0.6rem 1.5rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1a0000;
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn-secondary {
    background: #0a0a0a;
    border: 1px solid #333;
    color: #888;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: bold;
    letter-spacing: 0.1em;
    padding: 0.4rem 1rem;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .btn-secondary:hover {
    border-color: #555;
    color: #aaa;
  }

  .btn-launch {
    background: #001a00;
    border: 1px solid #4ade80;
    color: #4ade80;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: bold;
    letter-spacing: 0.15em;
    padding: 0.6rem 1.5rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-launch:hover {
    background: #002200;
  }

  .hidden-input {
    display: none;
  }

  .result-panel {
    border: 1px solid;
    padding: 1.25rem 1.5rem;
  }

  .result-panel.error {
    border-color: #7f1d1d;
    background: #0d0000;
  }

  .result-panel.success {
    border-color: #166534;
    background: #00100a;
  }

  .result-title {
    font-size: 0.85rem;
    font-weight: bold;
    letter-spacing: 0.1em;
    margin-bottom: 0.75rem;
  }

  .result-panel.error .result-title {
    color: #f87171;
  }

  .result-panel.success .result-title {
    color: #4ade80;
  }

  .result-body {
    color: #aaa;
    font-size: 0.82rem;
    margin: 0;
    font-family: inherit;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .error-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .error-list li {
    font-size: 0.82rem;
    color: #ccc;
    line-height: 1.4;
  }

  .err-path {
    color: #f87171;
    margin-right: 0.4rem;
  }
</style>

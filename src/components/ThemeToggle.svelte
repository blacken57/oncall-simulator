<script lang="ts">
  import { theme } from '$lib/theme.svelte';
</script>

<label class="theme-toggle" title={theme.dark ? 'Switch to light mode' : 'Switch to dark mode'}>
  <input type="checkbox" checked={!theme.dark} onchange={() => theme.toggle()} />
  <span class="icon moon">☾</span>
  <span class="track"><span class="thumb"></span></span>
  <span class="icon sun">☀</span>
</label>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    user-select: none;
  }

  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .icon {
    font-size: 0.8rem;
    transition: color 0.2s;
    line-height: 1;
  }

  .moon {
    color: var(--text-secondary);
  }
  .sun {
    color: var(--text-faint);
  }

  input:checked ~ .moon {
    color: var(--text-faint);
  }
  input:checked ~ .sun {
    color: var(--text-secondary);
  }

  .track {
    position: relative;
    width: 34px;
    height: 18px;
    background: var(--border);
    border: 1px solid var(--border-strong);
    border-radius: 9px;
    flex-shrink: 0;
    transition: background 0.2s;
  }

  .thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 10px;
    height: 10px;
    background: var(--text-secondary);
    border-radius: 50%;
    transition:
      transform 0.2s ease,
      background 0.2s;
  }

  input:checked ~ .track .thumb {
    transform: translateX(16px);
  }

  .theme-toggle:hover .track {
    border-color: var(--text-faint);
  }
</style>

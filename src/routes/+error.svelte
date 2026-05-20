<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="error-page">
  <h1>{page.status}</h1>
  <p>{page.error?.message ?? 'Something went wrong'}</p>
  <a href="/">Back to Home</a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    color: var(--text);
    font-family: 'Courier New', monospace;
  }

  h1 {
    font-size: 4rem;
    margin: 0;
    color: var(--text-primary);
  }

  p {
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin: 1rem 0 2rem;
  }

  a {
    color: var(--text-primary);
    text-decoration: none;
    border: 1px solid var(--border-strong);
    padding: 0.5rem 1.5rem;
    transition: background-color 0.2s;
  }

  a:hover {
    background-color: var(--surface-subtle);
  }
</style>

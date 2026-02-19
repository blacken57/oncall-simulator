<script lang="ts">
	import { engine } from '$lib/game/engine.svelte';

	let tick = $derived(engine.tick);
	let isRunning = $derived(engine.isRunning);
</script>

<main>
	<h1>Oncall Simulator</h1>
	<p>Current Tick: {tick}</p>
	<p>Status: {isRunning ? 'Running' : 'Stopped'}</p>

	<div class="controls">
		{#if !isRunning}
			<button onclick={() => engine.start()}>Start Game</button>
		{:else}
			<button onclick={() => engine.stop()}>Stop Game</button>
		{/if}
	</div>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		font-family: sans-serif;
	}
	.controls {
		margin-top: 1rem;
	}
	button {
		padding: 0.5rem 1rem;
		font-size: 1.2rem;
		cursor: pointer;
	}
</style>

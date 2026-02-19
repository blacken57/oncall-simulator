<script lang="ts">
	import { engine } from '$lib/game/engine.svelte';

	// Initialize local limits immediately to avoid render race conditions
	let localLimits = $state<Record<string, Record<string, number>>>(
		Object.fromEntries(
			Object.entries(engine.components).map(([compId, comp]) => [
				compId,
				Object.fromEntries(
					Object.entries(comp.attributes).map(([attrId, attr]) => [attrId, attr.limit])
				)
			])
		)
	);

	function handleQueue(compId: string, attrId: string) {
		const newValue = localLimits[compId][attrId];
		engine.queueAction(compId, attrId, newValue);
	}

	function getPendingAction(compId: string, attrId: string) {
		return engine.pendingActions.find(a => a.componentId === compId && a.attributeId === attrId);
	}
</script>

<div class="actions-container">
	{#each Object.entries(engine.components) as [compId, component]}
		<div class="component-actions">
			<header>
				<h3>{component.name}</h3>
			</header>

			<div class="attribute-list">
				{#each Object.entries(component.attributes) as [attrId, attr]}
					{@const pending = getPendingAction(compId, attrId)}
					<div class="attribute-row">
						<div class="info">
							<span class="name">{attr.name}</span>
							<span class="current-limit">Config: {attr.limit}{attr.unit}</span>
						</div>

						<div class="controls">
							<!-- Added safety check for localLimits[compId] -->
							{#if localLimits[compId] && localLimits[compId][attrId] !== undefined}
								<input 
									type="range" 
									min={attr.minLimit} 
									max={attr.maxLimit} 
									bind:value={localLimits[compId][attrId]}
									disabled={!!pending}
								/>
								<span class="target-value">{localLimits[compId][attrId]}{attr.unit}</span>
								
								{#if pending}
									<div class="pending-badge">
										Updating... ({pending.ticksRemaining}s)
									</div>
								{:else if localLimits[compId][attrId] !== attr.limit}
									<button class="apply-btn" onclick={() => handleQueue(compId, attrId)}>
										APPLY
									</button>
								{/if}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.actions-container {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.component-actions {
		background: #111;
		border: 1px solid #222;
		border-radius: 8px;
		padding: 1rem;
	}

	h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #fff;
		border-bottom: 1px solid #222;
		padding-bottom: 0.5rem;
	}

	.attribute-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.attribute-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: #0a0a0a;
		border-radius: 4px;
	}

	.info {
		display: flex;
		flex-direction: column;
		width: 200px;
	}

	.name { font-size: 0.85rem; font-weight: bold; }
	.current-limit { font-size: 0.7rem; color: #666; }

	.controls {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: 1;
		justify-content: flex-end;
	}

	input[type="range"] {
		flex: 1;
		max-width: 200px;
		accent-color: #f87171;
	}

	.target-value {
		min-width: 60px;
		font-size: 0.9rem;
		font-family: monospace;
	}

	.apply-btn {
		background: #4ade8022;
		color: #4ade80;
		border: 1px solid #4ade8055;
		padding: 0.2rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.7rem;
		font-weight: bold;
	}

	.apply-btn:hover { background: #4ade8044; }

	.pending-badge {
		font-size: 0.7rem;
		color: #fbbf24;
		font-style: italic;
	}
</style>

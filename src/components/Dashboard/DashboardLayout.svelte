<script lang="ts">
	import { engine } from '$lib/game/engine.svelte';
	import MetricCard from './MetricCard.svelte';
</script>

<div class="dashboard">
	{#each Object.values(engine.components) as component}
		<section class="component-group {component.status}">
			<header>
				<h2>{component.name}</h2>
				<span class="type-badge">{component.type}</span>
			</header>

			<div class="metrics-grid">
				<!-- Primary Metrics (Latency, Error Rate, etc) -->
				{#each Object.values(component.metrics) as metric}
					<MetricCard 
						name={metric.name}
						value={metric.value}
						unit={metric.unit}
						history={metric.history}
						status={component.status}
					/>
				{/each}

				<!-- Resource Attributes (RAM, GCU, Storage) rendered as graphs -->
				{#each Object.values(component.attributes) as attr}
					<MetricCard 
						name={attr.name}
						value={attr.current}
						unit={attr.unit}
						history={attr.history}
						limit={attr.limit}
						status={attr.utilization > 90 ? 'critical' : attr.utilization > 70 ? 'warning' : 'healthy'}
					/>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.dashboard {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 1.5rem;
		padding: 1rem;
	}

	.component-group {
		background: #111;
		border: 1px solid #222;
		border-radius: 8px;
		padding: 1rem;
	}

	.component-group.warning { border-color: #fbbf2455; }
	.component-group.critical { border-color: #f8717155; }

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		border-bottom: 1px solid #222;
		padding-bottom: 0.5rem;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
		color: #fff;
	}

	.type-badge {
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		background: #333;
		border-radius: 4px;
		text-transform: uppercase;
		color: #aaa;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.attr-card {
		grid-column: span 2;
		font-size: 0.8rem;
		color: #aaa;
	}

	.attr-info {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.progress-bar {
		height: 6px;
		background: #222;
		border-radius: 3px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		transition: width 0.3s ease, background 0.3s ease;
	}
</style>

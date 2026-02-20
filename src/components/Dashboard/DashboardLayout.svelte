<script lang="ts">
	import { engine } from '$lib/game/engine.svelte';
	import MetricCard from './MetricCard.svelte';
</script>

<div class="dashboard">
	<!-- System-wide Traffic Overview -->
	<section class="traffic-overview full-width">
		<header>
			<h2>SYSTEM TRAFFIC</h2>
		</header>
		
		{#each Object.values(engine.traffics) as traffic}
			{#if traffic.type === 'external'}
				<div class="traffic-group">
					<div class="traffic-header">
						<span class="traffic-id">{traffic.id}</span>
					</div>
					<div class="metrics-grid traffic">
						<MetricCard 
							name="Incoming"
							value={traffic.actualValue}
							unit="req/s"
							history={traffic.successHistory.map((s, i) => s + (traffic.failureHistory[i] || 0))}
							status="healthy"
						/>
						<MetricCard 
							name="Success"
							value={traffic.successHistory[traffic.successHistory.length - 1] || 0}
							unit="req/s"
							history={traffic.successHistory}
							status="healthy"
						/>
						<MetricCard 
							name="Failed"
							value={traffic.failureHistory[traffic.failureHistory.length - 1] || 0}
							unit="req/s"
							history={traffic.failureHistory}
							status={(traffic.failureHistory[traffic.failureHistory.length - 1] || 0) > 0 ? 'critical' : 'healthy'}
						/>
					</div>
				</div>
			{/if}
		{/each}
	</section>

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

	.full-width {
		grid-column: 1 / -1;
	}

	.traffic-overview {
		background: #0a0a0a;
		border: 2px solid #222;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1rem;
	}

	.metrics-grid.traffic {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
		max-width: 1000px; /* Cap width to keep sparklines concise */
	}

	.traffic-group {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #1a1a1a;
	}

	.traffic-group:last-child {
		border-bottom: none;
		margin-bottom: 0;
	}

	.traffic-header {
		margin-bottom: 0.5rem;
	}

	.traffic-id {
		font-size: 0.75rem;
		font-weight: bold;
		color: #f87171;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		background: #1a1a1a;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
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

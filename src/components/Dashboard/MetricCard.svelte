<script lang="ts">
	interface Props {
		name: string;
		value: number;
		unit: string;
		history: number[];
		status?: 'healthy' | 'warning' | 'critical';
	}

	let { name, value, unit, history, status = 'healthy' }: Props = $props();

	// Calculate SVG Path for the line and the filled area
	let paths = $derived.by(() => {
		if (history.length < 2) return { line: "", area: "" };
		
		const min = Math.min(...history);
		const max = Math.max(...history);
		const range = Math.max(max - min, 0.0001); // Prevent division by zero
		const width = 100;
		const height = 30;
		
		const points = history.map((v, i) => {
			const x = (i / (history.length - 1)) * width;
			const y = height - ((v - min) / range) * height;
			return { x, y };
		});

		const linePath = "M " + points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ");
		const areaPath = linePath + ` L 100,${height} L 0,${height} Z`;

		return { line: linePath, area: areaPath };
	});
</script>

<div class="metric-card {status}">
	<div class="header">
		<span class="name">{name}</span>
		<div class="status-indicator">
			<span class="status-dot"></span>
		</div>
	</div>
	<div class="body">
		<div class="value-container">
			<span class="value">{value.toFixed(1)}</span>
			<span class="unit">{unit}</span>
		</div>
		<div class="sparkline-container">
			<svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height="30">
				<!-- Area Fill -->
				<path
					d={paths.area}
					fill="currentColor"
					fill-opacity="0.1"
				/>
				<!-- The Line -->
				<path
					d={paths.line}
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			</svg>
		</div>
	</div>
</div>

<style>
	.metric-card {
		background: #111;
		border: 1px solid #222;
		border-radius: 4px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 100px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.name {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #666;
		font-weight: bold;
	}

	.value-container {
		margin-bottom: 0.5rem;
	}

	.value {
		font-size: 1.4rem;
		font-weight: 700;
		color: #fff;
	}

	.unit {
		font-size: 0.7rem;
		color: #444;
		margin-left: 0.2rem;
	}

	.sparkline-container {
		height: 30px;
		width: 100%;
		color: #4ade80;
		overflow: hidden;
	}

	/* Status Colors */
	.healthy .sparkline-container { color: #4ade80; }
	.warning .sparkline-container { color: #fbbf24; }
	.critical .sparkline-container { color: #f87171; }

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		display: block;
	}

	.healthy .status-dot { background: #4ade80; box-shadow: 0 0 8px #4ade8055; }
	.warning .status-dot { background: #fbbf24; box-shadow: 0 0 8px #fbbf2455; }
	.critical .status-dot { background: #f87171; box-shadow: 0 0 8px #f8717155; }
</style>

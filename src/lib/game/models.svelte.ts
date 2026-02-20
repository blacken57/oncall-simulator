/**
 * Represents a configurable property of a system (e.g., RAM Limit vs RAM Usage)
 */
export class Attribute {
	name: string;
	unit: string;
	limit = $state(0);
	current = $state(0);
	history = $state<number[]>([]);
	maxHistory = 60;
	minLimit: number;
	maxLimit: number;
	costPerUnit: number;

	constructor(name: string, unit: string, initialLimit: number, min: number, max: number, cost: number) {
		this.name = name;
		this.unit = unit;
		this.limit = initialLimit;
		this.current = 0;
		this.minLimit = min;
		this.maxLimit = max;
		this.costPerUnit = cost;
	}

	update(newValue: number) {
		this.current = newValue;
		this.history = [...this.history, newValue].slice(-this.maxHistory);
	}

	/** Total cost of this attribute per tick based on its limit */
	get cost() {
		return this.limit * this.costPerUnit;
	}

	/** Percentage of the limit currently used */
	get utilization() {
		return (this.current / this.limit) * 100;
	}
}

/**
 * Tracks telemetry data over time
 */
export class Metric {
	name: string;
	unit: string;
	value = $state(0);
	history = $state<number[]>([]);
	maxHistory = 60;

	constructor(name: string, unit: string) {
		this.name = name;
		this.unit = unit;
	}

	update(newValue: number) {
		this.value = newValue;
		this.history = [...this.history, newValue].slice(-this.maxHistory);
	}
}

/**
 * The base class for all system components
 */
export abstract class SystemComponent {
	id: string;
	name: string;
	abstract type: string;
	
	attributes = $state<Record<string, Attribute>>({});
	metrics = $state<Record<string, Metric>>({});
	
	status = $state<'healthy' | 'warning' | 'critical'>('healthy');

	constructor(id: string, name: string) {
		this.id = id;
		this.name = name;
	}

	/** Every component calculates its own 'physics' here */
	abstract tick(traffic: number, dependencies: Record<string, SystemComponent>): void;

	/** Calculate total operational cost for this component */
	get totalCost() {
		return Object.values(this.attributes).reduce((sum, attr) => sum + attr.cost, 0);
	}
}

/**
 * Specialized Component: Compute Node (APIs, Workers)
 */
export class ComputeNode extends SystemComponent {
	type = 'compute';

	constructor(id: string, name: string, ramLimit: number, gcuLimit: number) {
		super(id, name);
		this.attributes.ram = new Attribute('Memory', 'GB', ramLimit, 2, 64, 10);
		this.attributes.gcu = new Attribute('GCU', 'GCU', gcuLimit, 1, 32, 25);
		
		this.metrics.latency = new Metric('P99 Latency', 'ms');
		this.metrics.error_rate = new Metric('Error Rate', '%');
	}

	tick(traffic: number) {
		// Logic: GCU usage scales with traffic (100 req/s ≈ 5 GCU)
		this.attributes.gcu.update((traffic / 20) + (Math.random() * 0.5));
		
		// Logic: RAM usage scales slowly with traffic
		this.attributes.ram.update(1.2 + (traffic / 200) + (Math.random() * 0.1 - 0.05));

		// Physics: Latency spikes as GCU utilization crosses 80%
		const util = this.attributes.gcu.utilization;
		let latency = 50 + (traffic / 5);
		if (util > 80) latency *= (1 + (util - 80) / 10);
		
		this.metrics.latency.update(latency);
		this.metrics.error_rate.update(util > 100 ? (util - 100) * 2 : 0);
		
		this.updateStatus();
	}

	private updateStatus() {
		const gcuUtil = this.attributes.gcu.utilization;
		if (gcuUtil > 95) this.status = 'critical';
		else if (gcuUtil > 80) this.status = 'warning';
		else this.status = 'healthy';
	}
}

/**
 * Specialized Component: Database Node
 */
export class DatabaseNode extends SystemComponent {
	type = 'database';

	constructor(id: string, name: string, connLimit: number, storageLimit: number) {
		super(id, name);
		this.attributes.connections = new Attribute('Max Connections', 'count', connLimit, 10, 1000, 1);
		this.attributes.storage = new Attribute('Storage', 'GB', storageLimit, 50, 5000, 0.5);
		
		this.metrics.query_latency = new Metric('Query Latency', 'ms');
	}

	tick(traffic: number) {
		this.attributes.connections.update((traffic / 4) + (Math.random() * 2));
		
		const connUtil = this.attributes.connections.utilization;
		let qLat = 10 + (this.attributes.connections.current / 5);
		if (connUtil > 90) qLat *= 5;

		this.metrics.query_latency.update(qLat);
		
		if (connUtil > 100) this.status = 'critical';
		else if (connUtil > 80) this.status = 'warning';
		else this.status = 'healthy';
	}
}

/**
 * Specialized Component: Storage Node (Logs, Block Storage)
 */
export class StorageNode extends SystemComponent {
	type = 'storage';
	fillRate = 0.05; // GB per request

	constructor(id: string, name: string, capacity: number) {
		super(id, name);
		this.attributes.storage_usage = new Attribute('Storage Usage', 'GB', capacity, 100, 10000, 0.1);
		this.metrics.fill_rate = new Metric('Fill Rate', 'GB/s');
	}

	tick(traffic: number) {
		const growth = traffic * this.fillRate;
		this.attributes.storage_usage.update(Math.min(
			this.attributes.storage_usage.limit, 
			this.attributes.storage_usage.current + growth
		));
		
		this.metrics.fill_rate.update(growth);

		const util = this.attributes.storage_usage.utilization;
		if (util >= 100) this.status = 'critical';
		else if (util > 85) this.status = 'warning';
		else this.status = 'healthy';
	}
}

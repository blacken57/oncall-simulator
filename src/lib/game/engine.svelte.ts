import { ComputeNode, DatabaseNode, StorageNode, type SystemComponent } from './models.svelte';

export interface QueuedAction {
	id: string;
	componentId: string;
	attributeId: string;
	newValue: number;
	ticksRemaining: number;
	status: 'pending' | 'completed';
}

export class GameEngine {
	tick = $state(0);
	isRunning = $state(false);
	
	// Game State
	baseTraffic = $state(100);
	budget = $state(5000);
	
	// The Scenario Components
	components: Record<string, SystemComponent> = $state({});
	
	// Pending actions with latency
	pendingActions = $state<QueuedAction[]>([]);
	
	currentSpend = $derived(
		Object.values(this.components).reduce((sum, comp) => sum + comp.totalCost, 0)
	);

	private interval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		this.initializeLevel1();
	}

	initializeLevel1() {
		this.components = {
			checkoutServer: new ComputeNode('checkout-server', 'Checkout Server', 8, 20),
			checkoutDb: new DatabaseNode('checkout-db', 'Checkout DB', 100, 500),
			logIngestor: new ComputeNode('log-ingestor', 'Log Ingestor', 4, 15),
			logStorage: new StorageNode('log-storage', 'Log Block Storage', 1000)
		};
		this.components.checkoutDb.attributes.storage.update(50);
		this.components.logStorage.attributes.storage_usage.update(200);

		// Pre-populate with some history so graphs aren't empty
		for (let i = 0; i < 5; i++) {
			this.update();
		}
		this.tick = 0; // Reset tick so game starts at 0
	}

	/** Queue a new action to be applied after a delay */
	queueAction(componentId: string, attributeId: string, newValue: number, latency = 5) {
		this.pendingActions.push({
			id: Math.random().toString(36).substr(2, 9),
			componentId,
			attributeId,
			newValue,
			ticksRemaining: latency,
			status: 'pending'
		});
	}

	start() {
		if (this.isRunning) return;
		this.isRunning = true;
		this.interval = setInterval(() => this.update(), 1000);
	}

	stop() {
		this.isRunning = false;
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	update() {
		this.tick++;

		// 1. Process Pending Actions
		this.pendingActions.forEach(action => {
			if (action.status === 'pending') {
				action.ticksRemaining--;
				if (action.ticksRemaining <= 0) {
					this.applyAction(action);
				}
			}
		});
		// Clean up completed actions
		this.pendingActions = this.pendingActions.filter(a => a.status === 'pending');

		// 2. Calculate Traffic
		const currentTraffic = this.baseTraffic + (Math.random() * 20 - 10);

		// 3. Tick each component
		Object.values(this.components).forEach(comp => {
			comp.tick(currentTraffic, this.components);
		});
	}

	private applyAction(action: QueuedAction) {
		const component = this.components[action.componentId];
		if (component && component.attributes[action.attributeId]) {
			component.attributes[action.attributeId].limit = action.newValue;
		}
		action.status = 'completed';
	}
}

export const engine = new GameEngine();

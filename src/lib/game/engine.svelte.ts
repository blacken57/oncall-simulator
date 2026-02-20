import { ComputeNode, DatabaseNode, StorageNode, type SystemComponent } from './models.svelte';

/**
 * Represents an action that has been queued by the user but is not yet applied.
 * This simulates the latency and delay inherent in infrastructure changes
 * (e.g., waiting for a cloud provider to provision more RAM or disk).
 */
export interface QueuedAction {
	/** Unique identifier for the pending action */
	id: string;
	/** The ID of the SystemComponent this action targets */
	componentId: string;
	/** The ID of the Attribute (e.g., 'ram', 'gcu') being modified */
	attributeId: string;
	/** The target limit value to be set once the latency period ends */
	newValue: number;
	/** Number of game ticks remaining before the action is applied */
	ticksRemaining: number;
	/** Current lifecycle status of the action */
	status: 'pending' | 'completed';
}

/**
 * GameEngine is the central coordinator for the On-Call Simulator.
 * It manages the global clock (ticks), handles the main simulation loop,
 * coordinates traffic generation, and manages the lifecycle of all system components.
 * 
 * It uses Svelte 5's $state runes for reactivity, allowing the UI to 
 * automatically update as the simulation progresses.
 */
export class GameEngine {
	/** Total number of ticks since the simulation started */
	tick = $state(0);
	/** Whether the simulation is currently advancing */
	isRunning = $state(false);
	
	/** 
	 * The baseline user traffic (requests/sec). 
	 * Components scale their usage and metrics based on this value.
	 */
	baseTraffic = $state(100);
	
	/** 
	 * Current available financial budget. 
	 * (Note: Currently only tracks spend, budget enforcement is a future feature)
	 */
	budget = $state(5000);
	
	/** 
	 * Map of all active infrastructure components in the current scenario.
	 * Keyed by component ID for O(1) lookups.
	 */
	components: Record<string, SystemComponent> = $state({});
	
	/** 
	 * List of actions currently 'in flight' (e.g., resizing a database).
	 * They will be applied to the components when their ticksRemaining reaches zero.
	 */
	pendingActions = $state<QueuedAction[]>([]);
	
	/** 
	 * Reactive calculation of the total cost per tick for the entire infrastructure.
	 * Updates automatically whenever component attributes change.
	 */
	currentSpend = $derived(
		Object.values(this.components).reduce((sum, comp) => sum + comp.totalCost, 0)
	);

	/** Reference to the browser's interval timer for the game loop */
	private interval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		// Defaulting to Level 1 for the prototype
		this.initializeLevel1();
	}

	/**
	 * Scaffolds the initial infrastructure for the first scenario.
	 * Sets up a standard 3-tier-ish architecture: App Server, DB, and Logging.
	 */
	initializeLevel1() {
		this.components = {
			checkoutServer: new ComputeNode('checkout-server', 'Checkout Server', 8, 20),
			checkoutDb: new DatabaseNode('checkout-db', 'Checkout DB', 100, 500),
			logIngestor: new ComputeNode('log-ingestor', 'Log Ingestor', 4, 15),
			logStorage: new StorageNode('log-storage', 'Log Block Storage', 1000)
		};
		
		// Set some initial 'unhealthy' states or non-zero usage
		this.components.checkoutDb.attributes.storage.update(50);
		this.components.logStorage.attributes.storage_usage.update(200);

		// Pre-populate with some history so graphs aren't empty on first render
		for (let i = 0; i < 5; i++) {
			this.update();
		}
		this.tick = 0; // Reset tick so game actually starts at 0 for the user
	}

	/** 
	 * Queues a new configuration change to be applied after a delay.
	 * @param componentId - ID of target component
	 * @param attributeId - ID of attribute to modify (e.g. 'ram')
	 * @param newValue - The new limit/capacity for that attribute
	 * @param latency - Delay in ticks (seconds) before application
	 */
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

	/** Starts the simulation clock */
	start() {
		if (this.isRunning) return;
		this.isRunning = true;
		this.interval = setInterval(() => this.update(), 1000); // 1 tick = 1 second
	}

	/** Pauses the simulation clock */
	stop() {
		this.isRunning = false;
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	/**
	 * The core simulation update loop. Called once per tick.
	 * 1. Decrements latency timers for pending actions and applies them if ready.
	 * 2. Generates 'noisy' traffic based on the baseline.
	 * 3. Triggers the 'physics' calculations for every component in the system.
	 */
	update() {
		this.tick++;

		// 1. Process Pending Actions
		// We iterate through actions, decrementing their wait time.
		this.pendingActions.forEach(action => {
			if (action.status === 'pending') {
				action.ticksRemaining--;
				if (action.ticksRemaining <= 0) {
					this.applyAction(action);
				}
			}
		});
		// Clean up completed actions from the reactive list
		this.pendingActions = this.pendingActions.filter(a => a.status === 'pending');

		// 2. Calculate Traffic
		// We add ±10% noise to the base traffic to simulate natural variance.
		const currentTraffic = this.baseTraffic + (Math.random() * 20 - 10);

		// 3. Tick each component
		// Each component computes its own internal state (utilization, latency, etc.)
		// based on the incoming traffic and its current configuration limits.
		Object.values(this.components).forEach(comp => {
			comp.tick(currentTraffic, this.components);
		});
	}

	/**
	 * Internal helper to finalize a pending action.
	 * Modifies the target attribute's 'limit' property.
	 */
	private applyAction(action: QueuedAction) {
		const component = this.components[action.componentId];
		if (component && component.attributes[action.attributeId]) {
			component.attributes[action.attributeId].limit = action.newValue;
		}
		action.status = 'completed';
	}
}

/**
 * Singleton instance of the GameEngine.
 * Imported by components and stores to interact with the game state.
 */
export const engine = new GameEngine();

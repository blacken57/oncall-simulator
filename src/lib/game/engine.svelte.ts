export class GameEngine {
	tick = $state(0);
	isRunning = $state(false);
	private interval: ReturnType<typeof setInterval> | null = null;

	start() {
		if (this.isRunning) return;
		this.isRunning = true;
		this.interval = setInterval(() => {
			this.update();
		}, 1000);
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
		console.log(`Tick: ${this.tick}`);
	}
}

export const engine = new GameEngine();

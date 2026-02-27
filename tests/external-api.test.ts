import { describe, it, expect } from 'vitest';
import { ExternalAPINode } from '../src/lib/game/components/external-api.svelte';
import { GameEngine } from '../src/lib/game/engine.svelte';
import { getLevel } from '../src/lib/game/levels';
import type { ComponentConfig, LevelConfig } from '../src/lib/game/schema';

const mockHandler = {
  recordDemand: () => {},
  handleTraffic: (_name: string, volume: number) => ({
    successfulVolume: volume,
    averageLatency: 0
  }),
  statusEffects: [],
  getActiveComponentEffects: () => [],
  getActiveTrafficEffects: () => [],
  components: {}
};

/** Minimal ExternalAPINode config with a 60 req/s quota and zero noise. */
const config: ComponentConfig = {
  id: 'stripe',
  name: 'Stripe',
  type: 'external_api',
  physics: { noise_factor: 0 },
  attributes: {
    quota_rps: {
      name: 'Quota',
      unit: 'req/s',
      initialLimit: 60,
      minLimit: 10,
      maxLimit: 500,
      costPerUnit: 10
    }
  },
  metrics: {
    incoming: { name: 'Requests', unit: 'req/s' },
    latency: { name: 'Response Time', unit: 'ms' },
    error_rate: { name: 'Error Rate', unit: '%' }
  },
  alerts: [
    {
      name: 'Quota Near Limit',
      metric: 'quota_rps',
      warning_threshold: 70,
      critical_threshold: 85,
      direction: 'above'
    },
    {
      name: 'Error Rate High',
      metric: 'error_rate',
      warning_threshold: 5,
      critical_threshold: 15,
      direction: 'above'
    }
  ],
  traffic_routes: [{ name: 'stripe_charge', base_latency_ms: 150, outgoing_traffics: [] }]
};

describe('ExternalAPINode — calculateFailureRate', () => {
  it('should return 0 when demand is under quota', () => {
    const node = new ExternalAPINode(config);
    node.localExpectedVolume = 40;
    // @ts-ignore
    expect(node.calculateFailureRate(40)).toBe(0);
  });

  it('should return 0 when demand exactly equals quota', () => {
    const node = new ExternalAPINode(config);
    node.localExpectedVolume = 60;
    // @ts-ignore
    expect(node.calculateFailureRate(60)).toBe(0);
  });

  it('should drop traffic proportionally when demand exceeds quota', () => {
    const node = new ExternalAPINode(config);
    // demand=90, limit=60: (90 - 60) / 90 = 1/3
    node.localExpectedVolume = 90;
    // @ts-ignore
    expect(node.calculateFailureRate(90)).toBeCloseTo(1 / 3, 5);
  });

  it('should drop half when demand is 2x quota', () => {
    const node = new ExternalAPINode(config);
    node.localExpectedVolume = 120;
    // @ts-ignore
    expect(node.calculateFailureRate(120)).toBe(0.5);
  });

  it('should return 0 when no quota_rps attribute is configured', () => {
    const node = new ExternalAPINode({ ...config, attributes: {} });
    node.localExpectedVolume = 100;
    // @ts-ignore
    expect(node.calculateFailureRate(100)).toBe(0);
  });
});

describe('ExternalAPINode — calculateLocalLatency', () => {
  it('should return base latency exactly when noise_factor is 0', () => {
    const node = new ExternalAPINode(config);
    // @ts-ignore
    expect(node.calculateLocalLatency(150, 0)).toBe(150);
  });

  it('should not vary with request volume', () => {
    const node = new ExternalAPINode(config);
    // @ts-ignore
    const lowLoad = node.calculateLocalLatency(200, 1);
    // @ts-ignore
    const highLoad = node.calculateLocalLatency(200, 10000);
    expect(lowLoad).toBe(highLoad);
  });

  it('should clamp to 0 when base latency is 0 and noise is zero', () => {
    const node = new ExternalAPINode(config);
    // @ts-ignore
    expect(node.calculateLocalLatency(0, 0)).toBe(0);
  });
});

describe('ExternalAPINode — quota_rps utilization tracking', () => {
  it('should set current to incoming volume when under quota', () => {
    const node = new ExternalAPINode(config);
    node.incomingTrafficVolume = 42; // 70% of 60
    node.tick(mockHandler as any);
    expect(node.attributes.quota_rps.current).toBe(42);
    expect(node.attributes.quota_rps.utilization).toBeCloseTo(70, 5);
  });

  it('should cap current at the quota limit even when incoming exceeds it', () => {
    const node = new ExternalAPINode(config);
    node.incomingTrafficVolume = 90;
    node.tick(mockHandler as any);
    expect(node.attributes.quota_rps.current).toBe(60);
    expect(node.attributes.quota_rps.utilization).toBe(100);
  });
});

describe('ExternalAPINode — quota utilization alerts', () => {
  it('should be healthy when utilization is below warning threshold', () => {
    const node = new ExternalAPINode(config);
    node.incomingTrafficVolume = 30; // 50% of 60
    node.tick(mockHandler as any);
    expect(node.status).toBe('healthy');
    expect(node.statusTriggers['Quota Near Limit']).toBeUndefined();
  });

  it('should trigger warning at 70% quota utilization', () => {
    const node = new ExternalAPINode(config);
    node.incomingTrafficVolume = 42; // exactly 70% of 60
    node.tick(mockHandler as any);
    expect(node.status).toBe('warning');
    expect(node.statusTriggers['Quota Near Limit']).toBe('warning');
  });

  it('should trigger critical at 85% quota utilization', () => {
    const node = new ExternalAPINode(config);
    node.incomingTrafficVolume = 51; // exactly 85% of 60
    node.tick(mockHandler as any);
    expect(node.status).toBe('critical');
    expect(node.statusTriggers['Quota Near Limit']).toBe('critical');
  });
});

describe('ExternalAPINode — error_rate metric', () => {
  it('should be 0 when no traffic is dropped', () => {
    const node = new ExternalAPINode(config);
    node.incomingTrafficVolume = 30;
    node.unsuccessfulTrafficVolume = 0;
    node.tick(mockHandler as any);
    expect(node.metrics.error_rate.value).toBe(0);
  });

  it('should reflect the proportion of failed requests', () => {
    const node = new ExternalAPINode(config);
    node.incomingTrafficVolume = 60;
    node.unsuccessfulTrafficVolume = 20; // 33.3%
    node.tick(mockHandler as any);
    expect(node.metrics.error_rate.value).toBeCloseTo(33.33, 1);
  });
});

// ---------------------------------------------------------------------------
// Engine integration: a minimal level with one caller and one external API.
// ---------------------------------------------------------------------------

/** A caller compute node that fans all traffic to an ExternalAPINode at quota=50. */
const integrationLevel: LevelConfig = {
  id: 'ext-api-test',
  name: 'External API Test',
  description: 'End-to-end quota throttling',
  components: [
    {
      id: 'caller',
      name: 'Caller',
      type: 'compute',
      // Capacity far exceeds traffic so the caller never throttles
      physics: { request_capacity_per_unit: 1000, noise_factor: 0 },
      attributes: {
        gcu: {
          name: 'GCU',
          unit: 'GCU',
          initialLimit: 10,
          minLimit: 1,
          maxLimit: 100,
          costPerUnit: 1
        }
      },
      metrics: {},
      alerts: [],
      traffic_routes: [
        { name: 'request', outgoing_traffics: [{ name: 'call_ext', multiplier: 1 }] }
      ]
    },
    {
      id: 'ext',
      name: 'External',
      type: 'external_api',
      physics: { noise_factor: 0 },
      attributes: {
        quota_rps: {
          name: 'Quota',
          unit: 'req/s',
          initialLimit: 50,
          minLimit: 10,
          maxLimit: 200,
          costPerUnit: 1
        }
      },
      metrics: {
        incoming: { name: 'Req', unit: 'req/s' },
        latency: { name: 'Lat', unit: 'ms' },
        error_rate: { name: 'Err', unit: '%' }
      },
      alerts: [],
      traffic_routes: [{ name: 'call_ext', base_latency_ms: 100, outgoing_traffics: [] }]
    }
  ],
  traffics: [
    {
      type: 'external',
      name: 'request',
      target_component_name: 'Caller',
      value: 100,
      base_variance: 0
    },
    { type: 'internal', name: 'call_ext', target_component_name: 'External' }
  ],
  statusEffects: []
};

describe('ExternalAPINode — engine integration', () => {
  it('should drop traffic above quota proportionally', () => {
    const engine = new GameEngine();
    engine.loadLevel(integrationLevel);
    engine.update();

    const ext = engine.components['ext'];
    // 100 req/s in, quota 50: (100-50)/100 = 50% failure
    expect(ext.metrics.incoming.value).toBe(100);
    expect(ext.metrics.error_rate.value).toBeCloseTo(50, 1);
    expect(ext.attributes.quota_rps.current).toBe(50); // Capped at limit
  });

  it('should pass all traffic when under quota', () => {
    const engine = new GameEngine();
    const underLevel: LevelConfig = JSON.parse(JSON.stringify(integrationLevel));
    underLevel.traffics[0].value = 30; // Below quota of 50
    engine.loadLevel(underLevel);
    engine.update();

    const ext = engine.components['ext'];
    expect(ext.metrics.error_rate.value).toBe(0);
    expect(ext.attributes.quota_rps.current).toBe(30);
  });

  it('should multiply latency via a StatusEffect', () => {
    const engine = new GameEngine();
    const seLevel: LevelConfig = JSON.parse(JSON.stringify(integrationLevel));
    seLevel.traffics[0].value = 10; // Well under quota so no quota failures
    seLevel.statusEffects.push({
      type: 'component',
      name: 'Latency Spike',
      component_affected: 'ext',
      metric_affected: 'latency',
      multiplier: 3, // applyEffects(100, mult=3): 100 + 100*3 = 400ms
      materialization_probability: 1, // Always activates on tick 1
      resolution_ticks: 100,
      max_instances_at_once: 1
    });
    engine.loadLevel(seLevel);
    engine.update();

    // base_latency_ms=100, multiplier=3: 100 + 100*3 = 400ms
    expect(engine.components['ext'].metrics.latency.value).toBe(400);
  });

  it('should add error_rate via a StatusEffect offset', () => {
    const engine = new GameEngine();
    const seLevel: LevelConfig = JSON.parse(JSON.stringify(integrationLevel));
    seLevel.traffics[0].value = 10; // Well under quota, no quota-driven failures
    seLevel.statusEffects.push({
      type: 'component',
      name: 'Rate Limit',
      component_affected: 'ext',
      metric_affected: 'error_rate',
      offset: 75,
      materialization_probability: 1,
      resolution_ticks: 100,
      max_instances_at_once: 1
    });
    engine.loadLevel(seLevel);
    engine.update();

    // Base error_rate=0%; with offset=75: applyEffects(0, offset=75) = 75%
    expect(engine.components['ext'].metrics.error_rate.value).toBeCloseTo(75, 1);
  });
});

// ---------------------------------------------------------------------------
// FinPay level smoke test
// ---------------------------------------------------------------------------

describe('FinPay level — ExternalAPINode smoke test', () => {
  it('should load the finpay level and create all external API components', () => {
    const finpay = getLevel('finpay');
    expect(finpay).toBeDefined();

    const engine = new GameEngine();
    expect(() => engine.loadLevel(finpay!)).not.toThrow();

    for (const id of ['stripe', 'twilio', 'maxmind', 'plaid', 'sendgrid']) {
      expect(engine.components[id]).toBeDefined();
      expect(engine.components[id].type).toBe('external_api');
    }
  });

  it('should run 5 ticks without crashing and produce metrics', () => {
    const finpay = getLevel('finpay')!;
    // Zero out noise and status-effect probability for determinism
    finpay.components.forEach((c) => {
      if (c.physics) c.physics.noise_factor = 0;
    });
    finpay.traffics.forEach((t) => {
      t.base_variance = 0;
    });
    finpay.statusEffects.forEach((se) => {
      se.materialization_probability = 0;
    });

    const engine = new GameEngine();
    engine.loadLevel(finpay);

    for (let i = 0; i < 5; i++) engine.update();

    // With 40 req/s checkout and quota 60, all external APIs should be under quota
    expect(engine.components['stripe'].metrics.error_rate.value).toBe(0);
    expect(engine.components['stripe'].metrics.incoming.value).toBeGreaterThan(0);
    expect(engine.components['twilio'].metrics.incoming.value).toBeGreaterThan(0);
  });
});

import {
  VALID_COMPONENT_TYPES,
  type LevelConfig,
  type ComponentConfig,
  type TrafficConfig
} from './schema';

export interface ValidationError {
  path: string;
  message: string;
}

export function validateLevel(config: LevelConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const componentIds = new Set<string>();
  const componentNames = new Set<string>();
  const trafficNames = new Set<string>();

  // 1. Unique component IDs and names, and valid component types
  config.components.forEach((comp, i) => {
    if (componentIds.has(comp.id)) {
      errors.push({ path: `components[${i}].id`, message: `Duplicate component ID: ${comp.id}` });
    }
    componentIds.add(comp.id);

    if (componentNames.has(comp.name)) {
      errors.push({
        path: `components[${i}].name`,
        message: `Duplicate component name: ${comp.name}`
      });
    }
    componentNames.add(comp.name);

    if (!VALID_COMPONENT_TYPES.includes(comp.type as any)) {
      errors.push({
        path: `components[${i}].type`,
        message: `Unknown component type: ${comp.type}`
      });
    }
  });

  // 2. Unique traffic names
  config.traffics.forEach((traffic, i) => {
    if (trafficNames.has(traffic.name)) {
      errors.push({
        path: `traffics[${i}].name`,
        message: `Duplicate traffic name: ${traffic.name}`
      });
    }
    trafficNames.add(traffic.name);

    // 3. Every traffic ID has one target and it exists
    if (!componentNames.has(traffic.target_component_name)) {
      errors.push({
        path: `traffics[${i}].target_component_name`,
        message: `Traffic "${traffic.name}" targets non-existent component: "${traffic.target_component_name}"`
      });
    }
  });

  // 4. Internal traffics always have an associated traffic route
  const internalTraffics = config.traffics.filter((t) => t.type === 'internal').map((t) => t.name);
  const allOutgoingTrafficNames = new Set<string>();

  config.components.forEach((comp, i) => {
    comp.traffic_routes.forEach((route, j) => {
      route.outgoing_traffics.forEach((outgoing, k) => {
        allOutgoingTrafficNames.add(outgoing.name);

        // Ensure the outgoing traffic exists in the global traffics list
        const trafficDef = config.traffics.find((t) => t.name === outgoing.name);
        if (!trafficNames.has(outgoing.name)) {
          errors.push({
            path: `components[${i}].traffic_routes[${j}].outgoing_traffics[${k}]`,
            message: `Component "${comp.name}" route "${route.name}" references non-existent traffic: "${outgoing.name}"`
          });
        }

        // Queue-specific validations
        if (comp.type === 'queue') {
          if (outgoing.multiplier !== 1) {
            errors.push({
              path: `components[${i}].traffic_routes[${j}].outgoing_traffics[${k}].multiplier`,
              message: `Queue multipliers MUST be 1. Component "${comp.name}" route "${route.name}" has multiplier ${outgoing.multiplier}`
            });
          }

          if (trafficDef && trafficDef.target_component_name) {
            const targetComp = config.components.find(
              (c) => c.name === trafficDef.target_component_name
            );
            if (targetComp && targetComp.type !== 'compute' && targetComp.type !== 'storage') {
              errors.push({
                path: `components[${i}].traffic_routes[${j}].outgoing_traffics[${k}]`,
                message: `Queue "${comp.name}" targets invalid consumer "${targetComp.name}" of type "${targetComp.type}". Queues can only target compute or storage components.`
              });
            }
          }
        }
      });
    });
  });

  internalTraffics.forEach((name) => {
    // Check if emitted by a component route
    let isEmitted = allOutgoingTrafficNames.has(name);

    // Also check if emitted by a scheduled job
    if (!isEmitted && config.scheduledJobs) {
      isEmitted = config.scheduledJobs.some((job) =>
        job.emittedTraffic.some((et) => et.name === name)
      );
    }

    if (!isEmitted) {
      errors.push({
        path: 'traffics',
        message: `Internal traffic "${name}" is never emitted by any component route or scheduled job.`
      });
    }
  });

  // 5. Check if components have routes for traffic targeting them
  config.traffics.forEach((traffic) => {
    const targetComp = config.components.find((c) => c.name === traffic.target_component_name);
    if (targetComp) {
      const hasRoute = targetComp.traffic_routes.some((r) => r.name === traffic.name);
      if (!hasRoute) {
        errors.push({
          path: `components.find(name === "${targetComp.name}").traffic_routes`,
          message: `Component "${targetComp.name}" receives traffic "${traffic.name}" but has no route defined for it.`
        });
      }
    }
  });

  // 6. Validate Scheduled Jobs
  if (config.scheduledJobs) {
    config.scheduledJobs.forEach((job, i) => {
      const targetComp = config.components.find(
        (c) => c.name === job.targetName || c.id === job.targetName
      );
      if (!targetComp) {
        errors.push({
          path: `scheduledJobs[${i}].targetName`,
          message: `Scheduled job "${job.name}" targets non-existent component: "${job.targetName}"`
        });
      } else {
        job.affectedAttributes.forEach((attr, j) => {
          if (!targetComp.attributes[attr.name]) {
            errors.push({
              path: `scheduledJobs[${i}].affectedAttributes[${j}]`,
              message: `Scheduled job "${job.name}" targets non-existent attribute "${attr.name}" on component "${targetComp.name}"`
            });
          }
        });
      }
    });
  }

  // 7. Validate Alerts
  config.components.forEach((comp, i) => {
    if (comp.alerts) {
      const alertNames = new Set<string>();
      comp.alerts.forEach((alert, j) => {
        if (alertNames.has(alert.name)) {
          errors.push({
            path: `components[${i}].alerts[${j}].name`,
            message: `Component "${comp.name}" has duplicate alert name: "${alert.name}"`
          });
        }
        alertNames.add(alert.name);

        // Ensure metric/attribute exists
        const exists = comp.metrics[alert.metric] || comp.attributes[alert.metric];
        if (!exists) {
          errors.push({
            path: `components[${i}].alerts[${j}].metric`,
            message: `Component "${comp.name}" alert "${alert.name}" references non-existent metric or attribute: "${alert.metric}"`
          });
        }
      });
    }
  });

  // 8. Validate Status Effects
  config.statusEffects.forEach((effect, i) => {
    if (effect.type === 'component') {
      if (!componentIds.has(effect.component_affected)) {
        errors.push({
          path: `statusEffects[${i}].component_affected`,
          message: `Status effect "${effect.name}" targets non-existent component: "${effect.component_affected}"`
        });
      }
    } else if (effect.type === 'traffic') {
      if (!trafficNames.has(effect.traffic_affected)) {
        errors.push({
          path: `statusEffects[${i}].traffic_affected`,
          message: `Status effect "${effect.name}" targets non-existent traffic: "${effect.traffic_affected}"`
        });
      }
    }
  });

  // 9. Cycle Detection (Traffic Dependency Graph)
  // Build a map of component name -> set of component names it calls
  const adjacency: Record<string, Set<string>> = {};
  for (const comp of config.components) {
    const targets = new Set<string>();
    for (const route of comp.traffic_routes) {
      for (const outgoing of route.outgoing_traffics) {
        const trafficDef = config.traffics.find((t) => t.name === outgoing.name);
        if (trafficDef && trafficDef.target_component_name) {
          targets.add(trafficDef.target_component_name);
        }
      }
    }
    adjacency[comp.name] = targets;
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(name: string, path: string[]): boolean {
    visited.add(name);
    recStack.add(name);

    const neighbors = adjacency[name] || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor, [...path, neighbor])) return true;
      } else if (recStack.has(neighbor)) {
        errors.push({
          path: 'components',
          message: `Circular traffic dependency detected: ${[...path, neighbor].join(' -> ')}`
        });
        return true;
      }
    }

    recStack.delete(name);
    return false;
  }

  for (const comp of config.components) {
    if (!visited.has(comp.name)) {
      hasCycle(comp.name, [comp.name]);
    }
  }

  return errors;
}

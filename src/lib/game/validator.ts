import type { LevelConfig, ComponentConfig, TrafficConfig } from './schema';

export interface ValidationError {
  path: string;
  message: string;
}

export function validateLevel(config: LevelConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const componentIds = new Set<string>();
  const componentNames = new Set<string>();
  const trafficNames = new Set<string>();

  // 1. Unique component IDs and names
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
        if (!trafficNames.has(outgoing.name)) {
          errors.push({
            path: `components[${i}].traffic_routes[${j}].outgoing_traffics[${k}]`,
            message: `Component "${comp.name}" route "${route.name}" references non-existent traffic: "${outgoing.name}"`
          });
        }
      });
    });
  });

  internalTraffics.forEach((name) => {
    if (!allOutgoingTrafficNames.has(name)) {
      errors.push({
        path: 'traffics',
        message: `Internal traffic "${name}" is never emitted by any component route.`
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

  return errors;
}

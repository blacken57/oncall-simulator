export type ModifierOperation = 'add' | 'multiply' | 'multiply_percent';

export interface Modifier {
  target: 'attribute' | 'metric' | 'traffic';
  componentId?: string; // Optional: if omitted, applies to the component it's attached to or global if target is traffic
  id?: string; // attribute or metric id
  operation: ModifierOperation;
  value: number;
}

export interface TriggerCondition {
  type: 'metric' | 'attribute';
  componentId: string;
  id: string;
  operator: '>' | '<' | '>=';
  value: number;
  useUtilization?: boolean; // If true, value is compared to attribute's utilization percentage (0-100)
}

export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  type: 'external' | 'internal';
  modifiers: Modifier[];
  duration: number | 'permanent'; // ticks
  remainingTicks?: number;
  triggerCondition?: TriggerCondition;
  chance?: number; // 0-1 for external effects
}

export function applyModifier(baseValue: number, operation: ModifierOperation, value: number): number {
  switch (operation) {
    case 'add':
      return baseValue + value;
    case 'multiply':
      return baseValue * value;
    case 'multiply_percent':
      return baseValue * (1 + value / 100);
    default:
      return baseValue;
  }
}

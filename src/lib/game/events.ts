export interface GameEvent {
  id: string;
  timestamp: number; // tick count
  type: 'system' | 'action' | 'incident';
  message: string;
  severity: 'info' | 'warning' | 'error';
  metadata?: Record<string, any>;
}

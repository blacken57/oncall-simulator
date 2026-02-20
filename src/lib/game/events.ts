/**
 * Represents a single chronological entry in the simulation's event stream.
 * Events are used to populate the Audit Log and provide historical context to the player.
 */
export interface GameEvent {
  /** Unique identifier for the event */
  id: string;
  /** The tick count (timestamp) when the event occurred */
  timestamp: number; // tick count
  /** 
   * The category of the event:
   * - 'system': Automated background processes (e.g., "Baseline traffic increased")
   * - 'action': User-initiated changes (e.g., "RAM limit increased to 16GB")
   * - 'incident': Critical system failures or status effect triggers
   */
  type: 'system' | 'action' | 'incident';
  /** Human-readable message describing what happened */
  message: string;
  /** Visual/Logical severity level of the event */
  severity: 'info' | 'warning' | 'error';
  /** Optional structured data for additional context or analytics */
  metadata?: Record<string, any>;
}

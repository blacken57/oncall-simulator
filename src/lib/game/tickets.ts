/**
 * Represents an active on-call alert or incident ticket in the simulator.
 * These are the primary interface for players to track and resolve system issues.
 */
export interface Ticket {
  /** Unique identifier for the ticket instance */
  id: string;
  /** Human-readable title of the alert */
  title: string;
  /** Detailed description of the issue or impact */
  description: string;
  /** Criticality of the issue, affecting player score and prioritization */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Current state of the ticket lifecycle */
  status: 'open' | 'in_progress' | 'resolved';
  /** The tick count (timestamp) when the ticket was created */
  createdAt: number; // tick count
  /** The tick count (timestamp) when the ticket was marked as resolved */
  resolvedAt?: number;
  /** The specific component ID related to the issue, if any */
  componentId?: string;
  
  /** The source of the ticket, such as a triggered status effect or an out-of-bounds metric */
  sourceId?: string; // status effect id or metric id
  
  /** References to specific document IDs that provide guidance on how to fix this issue */
  docIds: string[];
}

/**
 * A blueprint for creating specific types of tickets based on system events.
 */
export interface TicketTemplate {
  /** Template identifier */
  id: string;
  /** The title template for generated tickets */
  title: string;
  /** The descriptive text template for generated tickets */
  description: string;
  /** Default severity level for this type of ticket */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Optional condition that, when met, triggers the creation of a ticket */
  triggerCondition?: {
    /** Whether to monitor a performance metric or a specific status effect */
    type: 'metric' | 'status_effect';
    /** The ID of the metric or status effect to monitor */
    id: string; // metric name or status effect id
    /** Comparison operator for the trigger threshold */
    operator?: '>' | '<' | '>=';
    /** The threshold value for the comparison */
    value?: number;
  };
  /** Pre-defined documentation links for this ticket type */
  docIds: string[];
}

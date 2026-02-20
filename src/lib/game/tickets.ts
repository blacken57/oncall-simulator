export interface Ticket {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: number; // tick count
  resolvedAt?: number;
  componentId?: string;
  
  // What triggered this ticket
  sourceId?: string; // status effect id or metric id
  
  // Hint/Link to documentation
  docIds: string[];
}

export interface TicketTemplate {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggerCondition?: {
    type: 'metric' | 'status_effect';
    id: string; // metric name or status effect id
    operator?: '>' | '<' | '>=';
    value?: number;
  };
  docIds: string[];
}

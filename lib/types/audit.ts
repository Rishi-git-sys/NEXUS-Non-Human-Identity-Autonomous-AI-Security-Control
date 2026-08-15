import { ActionDecision } from '@/types/nexus';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorId: string;
  action: string;
  resource: string;
  environment: string;
  decision: ActionDecision;
  riskScore: number;
  ipAddress?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

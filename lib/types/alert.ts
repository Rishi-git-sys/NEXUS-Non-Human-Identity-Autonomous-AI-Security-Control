import { ActionDecision } from '@/types/nexus';

export interface Alert {
  id: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  riskScore: number | null;
  timestamp: string;
  decision: ActionDecision;
  reason: string;
  agentId?: string;
  identityId?: string;
  status: 'Open' | 'Acknowledged' | 'Investigating' | 'Resolved' | 'Dismissed';
  resource: string;
  actor: string;
  recommendation?: string;
  provider?: string;
  awsType?: string;
  arn?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
}

import { ActionDecision } from '@/types/nexus';

export interface AgentCapability {
  id: string;
  capability: string;
  resource: string;
  accessLevel: 'Read' | 'Write' | 'Admin';
  decision: ActionDecision;
  reason: string;
}

export interface RiskBreakdown {
  permissionRisk: number;
  behaviorRisk: number;
  credentialRisk: number;
  exposureRisk: number;
}

export interface Agent {
  id: string;
  name: string;
  purpose: string;
  model: string;
  environment: string;
  riskScore: number;
  status: 'Active' | 'Idle' | 'Suspended';
  owner: string;
  lastActive: string;
  connectedSystems: string[];
  permissionsCount: number;
  capabilities: AgentCapability[];
  riskBreakdown: RiskBreakdown;
}

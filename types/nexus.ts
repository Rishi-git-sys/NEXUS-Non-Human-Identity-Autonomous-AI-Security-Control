export type RiskLevel = 'Healthy' | 'Medium' | 'High' | 'Critical';

export type ActionDecision = 'ALLOWED' | 'BLOCKED' | 'REVIEW' | 'ALERT';

export type IdentityType = 'API Key' | 'Service Account' | 'IAM Role' | 'OAuth Client' | 'Machine Identity';

export type ProviderType = 'AWS' | 'GitHub' | 'Kubernetes' | 'Azure' | 'Internal';

export type AgentStatus = 'Active' | 'Idle' | 'Suspended';

export interface Identity {
  id: string;
  name: string;
  type: IdentityType;
  provider: ProviderType;
  environment: string;
  riskScore: number;
  lastActive: string;
  owner: string;
  createdAt: string;
}

export interface Permission {
  id: string;
  permission: string;
  resource: string;
  accessLevel: 'Read' | 'Write' | 'Admin';
  riskScore: number;
}

export interface RiskBreakdown {
  permissionRisk: number;
  behaviorRisk: number;
  credentialRisk: number;
  exposureRisk: number;
}

export interface AgentCapability {
  id: string;
  capability: string;
  resource: string;
  accessLevel: string;
  decision: ActionDecision;
  reason: string;
}

export interface Agent {
  id: string;
  name: string;
  model: string;
  environment: string;
  riskScore: number;
  status: AgentStatus;
  capabilities: AgentCapability[];
  riskBreakdown: RiskBreakdown;
}

export interface PolicyCondition {
  field: string;
  operator: string;
  value: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  conditions: PolicyCondition[];
  decision: ActionDecision;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface Alert {
  id: string;
  title: string;
  riskScore: number;
  timestamp: string;
  decision: ActionDecision;
  reason: string;
  agentId?: string;
  identityId?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorId: string;
  action: string;
  resource: string;
  decision: ActionDecision;
  riskScore: number;
  reason?: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorId?: string;
  action: string;
  resource: string;
  decision: ActionDecision;
  riskScore: number;
  reason?: string;
}

import { Agent, Identity, Policy, Alert, AuditEvent, ActivityEvent } from '../types/nexus';

export const DEVOPS_AGENT_SCENARIO_ID = 'evt_devops_delete_001';

export const mockAgents: Agent[] = [
  {
    id: 'agent_devops_001',
    name: 'DevOps-Agent',
    model: 'GPT-4-Turbo',
    environment: 'Production',
    riskScore: 98,
    status: 'Active',
    riskBreakdown: {
      permissionRisk: 85,
      behaviorRisk: 98,
      credentialRisk: 40,
      exposureRisk: 90,
    },
    capabilities: [
      { id: 'cap_1', capability: 'GitHub Automation', resource: 'nexus-repo', accessLevel: 'Write', decision: 'ALLOWED', reason: 'Standard CI/CD automation' },
      { id: 'cap_2', capability: 'CI/CD Pipeline', resource: 'github-actions', accessLevel: 'Admin', decision: 'ALLOWED', reason: 'Required for deployments' },
      { id: 'cap_3', capability: 'AWS Production Access', resource: 'aws-prod-cluster', accessLevel: 'Read', decision: 'REVIEW', reason: 'High privilege environment' },
      { id: 'cap_4', capability: 'Production DB Delete', resource: 'production_database', accessLevel: 'Admin', decision: 'BLOCKED', reason: 'Violates production data protection policy' },
    ]
  },
  {
    id: 'agent_finance_001',
    name: 'Finance-Agent',
    model: 'Claude-3-Opus',
    environment: 'Internal',
    riskScore: 45,
    status: 'Active',
    riskBreakdown: { permissionRisk: 40, behaviorRisk: 30, credentialRisk: 20, exposureRisk: 10 },
    capabilities: [
      { id: 'cap_5', capability: 'Read Financial Reports', resource: 's3-finance-bucket', accessLevel: 'Read', decision: 'ALLOWED', reason: 'Required for analysis' }
    ]
  },
  {
    id: 'agent_support_001',
    name: 'Customer-Support-Agent',
    model: 'GPT-4o',
    environment: 'Customer-Facing',
    riskScore: 65,
    status: 'Active',
    riskBreakdown: { permissionRisk: 60, behaviorRisk: 55, credentialRisk: 30, exposureRisk: 70 },
    capabilities: []
  },
  {
    id: 'agent_code_001',
    name: 'Code-Review-Agent',
    model: 'GPT-4-Turbo',
    environment: 'Development',
    riskScore: 25,
    status: 'Idle',
    riskBreakdown: { permissionRisk: 20, behaviorRisk: 10, credentialRisk: 15, exposureRisk: 5 },
    capabilities: []
  },
  {
    id: 'agent_db_001',
    name: 'Database-Agent',
    model: 'Claude-3-Sonnet',
    environment: 'Staging',
    riskScore: 75,
    status: 'Suspended',
    riskBreakdown: { permissionRisk: 80, behaviorRisk: 70, credentialRisk: 60, exposureRisk: 50 },
    capabilities: []
  },
  {
    id: 'agent_sec_001',
    name: 'Security-Agent',
    model: 'Custom-LLM',
    environment: 'All',
    riskScore: 15,
    status: 'Active',
    riskBreakdown: { permissionRisk: 90, behaviorRisk: 5, credentialRisk: 10, exposureRisk: 5 },
    capabilities: []
  }
];

export const mockIdentities: Identity[] = [
  { id: 'identity_aws_001', name: 'GitHub Actions Prod Deploy', type: 'IAM Role', provider: 'AWS', environment: 'Production', riskScore: 72, lastActive: '2026-08-08T10:15:00Z', owner: 'DevOps Team', createdAt: '2025-01-10T00:00:00Z' },
  { id: 'identity_k8s_001', name: 'payments-service-sa', type: 'Service Account', provider: 'Kubernetes', environment: 'Production', riskScore: 35, lastActive: '2026-08-08T12:00:00Z', owner: 'Backend Team', createdAt: '2025-03-15T00:00:00Z' },
  { id: 'identity_api_001', name: 'Stripe Integration Key', type: 'API Key', provider: 'Internal', environment: 'Production', riskScore: 88, lastActive: '2026-08-08T11:45:00Z', owner: 'Finance Team', createdAt: '2024-11-20T00:00:00Z' },
  { id: 'identity_api_002', name: 'SendGrid Mailer', type: 'API Key', provider: 'Internal', environment: 'Staging', riskScore: 12, lastActive: '2026-08-07T09:30:00Z', owner: 'Marketing', createdAt: '2025-06-01T00:00:00Z' },
  { id: 'identity_oauth_001', name: 'Slack Bot Integration', type: 'OAuth Client', provider: 'Internal', environment: 'Corporate', riskScore: 45, lastActive: '2026-08-08T08:00:00Z', owner: 'IT Helpdesk', createdAt: '2025-02-14T00:00:00Z' }
];

export const mockPolicies: Policy[] = [
  {
    id: 'policy_prod_delete_001',
    name: 'Prevent Production Database Deletion',
    description: 'Blocks any non-human identity or agent from deleting production databases.',
    conditions: [
      { field: 'Environment', operator: 'Equals', value: 'Production' },
      { field: 'Action', operator: 'Equals', value: 'DELETE' },
      { field: 'Resource', operator: 'Matches', value: '*_database' }
    ],
    decision: 'BLOCKED',
    status: 'Active',
    createdAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'policy_iam_001',
    name: 'Review IAM Role Escalation',
    description: 'Flags for review any attempt to modify IAM roles in production.',
    conditions: [
      { field: 'Environment', operator: 'Equals', value: 'Production' },
      { field: 'Action', operator: 'Equals', value: 'iam:PutRolePolicy' }
    ],
    decision: 'REVIEW',
    status: 'Active',
    createdAt: '2025-02-15T00:00:00Z'
  }
];

export const mockAlerts: Alert[] = [
  {
    id: 'alert_001',
    title: 'DevOps-Agent attempted DELETE production_database',
    riskScore: 98,
    timestamp: '2026-08-08T12:30:00Z',
    decision: 'BLOCKED',
    reason: 'Production database deletion is outside the permitted capability scope for this agent and violates the configured production data protection policy.',
    agentId: 'agent_devops_001'
  },
  {
    id: 'alert_002',
    title: 'High-risk API Key exposed in public repository',
    riskScore: 88,
    timestamp: '2026-08-08T10:15:00Z',
    decision: 'ALERT',
    reason: 'Stripe Integration Key was detected in a recent commit to a public GitHub repository.',
    identityId: 'identity_api_001'
  }
];

export const mockAuditEvents: AuditEvent[] = [
  {
    id: DEVOPS_AGENT_SCENARIO_ID,
    timestamp: '2026-08-08T12:30:00Z',
    actor: 'DevOps-Agent',
    actorId: 'agent_devops_001',
    action: 'DELETE',
    resource: 'production_database',
    decision: 'BLOCKED',
    riskScore: 98,
    reason: 'Production database deletion is outside the permitted capability scope for this agent and violates the configured production data protection policy.'
  },
  {
    id: 'audit_evt_002',
    timestamp: '2026-08-08T12:25:00Z',
    actor: 'Finance-Agent',
    actorId: 'agent_finance_001',
    action: 'READ',
    resource: 's3-finance-bucket/Q3-report.pdf',
    decision: 'ALLOWED',
    riskScore: 15
  },
  {
    id: 'audit_evt_003',
    timestamp: '2026-08-08T11:50:00Z',
    actor: 'GitHub Actions Prod Deploy',
    actorId: 'identity_aws_001',
    action: 'UpdateService',
    resource: 'ecs-cluster-prod',
    decision: 'ALLOWED',
    riskScore: 30
  }
];

export const mockActivity: ActivityEvent[] = mockAuditEvents.map(audit => ({
  id: audit.id,
  timestamp: audit.timestamp,
  actor: audit.actor,
  actorId: audit.actorId,
  action: audit.action,
  resource: audit.resource,
  decision: audit.decision,
  riskScore: audit.riskScore,
  reason: audit.reason
}));

// Accessors
export const getAgents = () => mockAgents;
export const getIdentities = () => mockIdentities;
export const getPolicies = () => mockPolicies;
export const getAlerts = () => mockAlerts;
export const getAuditEvents = () => mockAuditEvents;
export const getActivityEvents = () => mockActivity;

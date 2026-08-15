import { Policy } from '../types/policy';

export const mockPolicies: Policy[] = [
  {
    id: 'policy_prod_delete_001',
    name: 'Prevent Production Database Deletion',
    description: 'Blocks any non-human identity or agent from executing DELETE actions on critical production databases.',
    scope: 'Production Databases',
    severity: 'Critical',
    status: 'Active',
    lastUpdated: '2026-08-01T12:00:00Z',
    violations: 1,
    decision: 'BLOCKED',
    conditions: [
      { field: 'Environment', operator: 'Equals', value: 'Production' },
      { field: 'Action', operator: 'Equals', value: 'DELETE' },
      { field: 'Resource', operator: 'Matches', value: '*_database' }
    ]
  },
  {
    id: 'policy_iam_escalation_001',
    name: 'Review IAM Role Escalation',
    description: 'Flags for manual review any attempt to modify or attach permission policies (e.g. PutRolePolicy) to active AWS roles.',
    scope: 'AWS IAM Roles',
    severity: 'High',
    status: 'Active',
    lastUpdated: '2026-08-03T14:30:00Z',
    violations: 4,
    decision: 'REVIEW',
    conditions: [
      { field: 'Environment', operator: 'Equals', value: 'Production' },
      { field: 'Action', operator: 'Equals', value: 'iam:PutRolePolicy' }
    ]
  },
  {
    id: 'policy_unknown_agent_001',
    name: 'Prevent Unknown AI Agent Access',
    description: 'Blocks API access requests from AI agents not pre-registered in the enterprise security catalog.',
    scope: 'Enterprise Core APIs',
    severity: 'Critical',
    status: 'Active',
    lastUpdated: '2026-08-05T09:00:00Z',
    violations: 0,
    decision: 'BLOCKED',
    conditions: [
      { field: 'AgentRegistration', operator: 'Equals', value: 'NotRegistered' }
    ]
  },
  {
    id: 'policy_credential_rotation_001',
    name: 'Require Credential Rotation',
    description: 'Alerts if a non-human identity credential exceeds the permitted rotation threshold (90 days).',
    scope: 'API Keys & Secrets',
    severity: 'Medium',
    status: 'Active',
    lastUpdated: '2026-07-28T16:15:00Z',
    violations: 3,
    decision: 'ALERT',
    conditions: [
      { field: 'CredentialAgeDays', operator: 'GreaterThan', value: '90' }
    ]
  },
  {
    id: 'policy_restrict_high_risk_001',
    name: 'Restrict High-Risk API Access',
    description: 'Intercepts access requests to sensitive third-party APIs (Stripe, Twilio) if the identity risk score exceeds 80.',
    scope: 'Sensitive APIs',
    severity: 'High',
    status: 'Active',
    lastUpdated: '2026-08-07T10:00:00Z',
    violations: 1,
    decision: 'BLOCKED',
    conditions: [
      { field: 'ActorRiskScore', operator: 'GreaterThan', value: '80' },
      { field: 'ResourceCategory', operator: 'Equals', value: 'PaymentGateway' }
    ]
  }
];

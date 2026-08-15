import { Alert } from '../types/alert';

export const mockAlerts: Alert[] = [
  {
    id: 'alert_001',
    title: 'Critical Database Deletion Request Denied',
    severity: 'Critical',
    riskScore: 98,
    timestamp: '2026-08-09T14:42:32Z',
    decision: 'BLOCKED',
    reason: 'DevOps-Agent requested a DELETE action on production_database. Access was blocked automatically because database deletion violates the "Prevent Production Database Deletion" governance policy.',
    agentId: 'agent_devops_001',
    status: 'Open',
    resource: 'production_database',
    actor: 'DevOps-Agent'
  },
  {
    id: 'alert_002',
    title: 'High-Risk Stripe API Key Leak Detected in Git History',
    severity: 'High',
    riskScore: 88,
    timestamp: '2026-08-09T10:15:00Z',
    decision: 'ALERT',
    reason: 'Stripe Integration Key credentials signature pattern was detected in a public repository commit log history. Secret exposure could allow unauthorized billing transactions.',
    identityId: 'identity_api_001',
    status: 'Investigating',
    resource: 'Stripe Integration Key',
    actor: 'Stripe Integration Key'
  },
  {
    id: 'alert_003',
    title: 'IAM Policy Mutation Attempt in Production Environment',
    severity: 'High',
    riskScore: 78,
    timestamp: '2026-08-09T09:12:00Z',
    decision: 'REVIEW',
    reason: 'GitHub Actions Prod Deploy identity requested aws:PutRolePolicy to escalate SQS read privileges. Flagged for review according to policy "Review IAM Role Escalation".',
    identityId: 'identity_aws_001',
    status: 'Open',
    resource: 'aws-prod-cluster/role-policy',
    actor: 'GitHub Actions Prod Deploy'
  },
  {
    id: 'alert_004',
    title: 'Anomalous Token Extraction from Customer-Support-Agent',
    severity: 'Medium',
    riskScore: 65,
    timestamp: '2026-08-09T13:10:00Z',
    decision: 'ALERT',
    reason: 'Customer-Support-Agent requested credentials metadata from internal OAuth endpoint. The action is flagged because it deviates from regular query telemetry.',
    agentId: 'agent_support_001',
    status: 'Open',
    resource: 'oauth-metadata-endpoint',
    actor: 'Customer-Support-Agent'
  },
  {
    id: 'alert_005',
    title: 'Staging Database Migrations Pending Approval',
    severity: 'Medium',
    riskScore: 55,
    timestamp: '2026-08-08T09:15:00Z',
    decision: 'REVIEW',
    reason: 'Database-Agent requested to execute DDL migrations on staging databases. Action is pending explicit Platform Engineer authorization.',
    agentId: 'agent_db_001',
    status: 'Resolved',
    resource: 'staging-database-schema',
    actor: 'Database-Agent'
  }
];

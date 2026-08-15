import { AuditEvent } from '../types/audit';

export const mockAuditEvents: AuditEvent[] = [
  {
    id: 'evt_devops_delete_001',
    timestamp: '2026-08-09T14:42:32Z',
    actor: 'DevOps-Agent',
    actorId: 'agent_devops_001',
    action: 'DELETE',
    resource: 'production_database',
    environment: 'Production',
    decision: 'BLOCKED',
    riskScore: 98,
    ipAddress: '10.240.4.15',
    reason: 'Production database deletion is outside the permitted capability scope for this agent and violates the configured production data protection policy.'
  },
  {
    id: 'audit_evt_002',
    timestamp: '2026-08-09T12:25:00Z',
    actor: 'Finance-Agent',
    actorId: 'agent_finance_001',
    action: 'READ',
    resource: 's3-finance-bucket/Q3-report.pdf',
    environment: 'Internal',
    decision: 'ALLOWED',
    riskScore: 15,
    ipAddress: '192.168.12.82',
    reason: 'Read operation authorized; within capabilities scope for finance reports.'
  },
  {
    id: 'audit_evt_003',
    timestamp: '2026-08-09T11:50:00Z',
    actor: 'GitHub Actions Prod Deploy',
    actorId: 'identity_aws_001',
    action: 'UpdateService',
    resource: 'ecs-cluster-prod',
    environment: 'Production',
    decision: 'ALLOWED',
    riskScore: 30,
    ipAddress: '140.82.115.4',
    reason: 'ECS deploy role authorization check passed.'
  },
  {
    id: 'audit_evt_004',
    timestamp: '2026-08-09T10:15:00Z',
    actor: 'Stripe Integration Key',
    actorId: 'identity_api_001',
    action: 'ChargeCustomer',
    resource: 'stripe-api-gateway',
    environment: 'Production',
    decision: 'ALLOWED',
    riskScore: 88,
    ipAddress: '198.51.100.43',
    reason: 'Transaction allowed, though credential exposure warning has been logged and sent to alert dispatcher.'
  },
  {
    id: 'audit_evt_005',
    timestamp: '2026-08-09T08:00:00Z',
    actor: 'Slack Bot Integration',
    actorId: 'identity_oauth_001',
    action: 'ReadHistory',
    resource: 'slack-channels/public-announcements',
    environment: 'Corporate',
    decision: 'ALLOWED',
    riskScore: 22,
    ipAddress: '54.208.10.155',
    reason: 'Standard channel polling operation.'
  },
  {
    id: 'audit_evt_006',
    timestamp: '2026-08-09T14:10:00Z',
    actor: 'Kubernetes Cluster Provisioner',
    actorId: 'identity_workload_002',
    action: 'CreateClusterRoleBinding',
    resource: 'k8s-api/admin-role-binding',
    environment: 'Production',
    decision: 'ALLOWED',
    riskScore: 92,
    ipAddress: '10.240.1.5',
    reason: 'Authorized admin orchestration context verified.'
  },
  {
    id: 'audit_evt_007',
    timestamp: '2026-08-09T13:10:00Z',
    actor: 'Customer-Support-Agent',
    actorId: 'agent_support_001',
    action: 'ReadMetadata',
    resource: 'oauth-metadata-endpoint',
    environment: 'Customer-Facing',
    decision: 'ALERT',
    riskScore: 65,
    ipAddress: '10.240.8.22',
    reason: 'Anomalous oauth token access metadata check detected.'
  }
];

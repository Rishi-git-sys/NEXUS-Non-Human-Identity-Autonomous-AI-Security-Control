import { Identity } from '../types/identity';

export const mockIdentities: Identity[] = [
  {
    id: 'identity_aws_001',
    name: 'GitHub Actions Prod Deploy',
    type: 'Workload',
    provider: 'AWS',
    environment: 'Production',
    riskScore: 72,
    lastActive: '2026-08-09T10:15:00Z',
    owner: 'DevOps Team',
    createdAt: '2025-01-10T00:00:00Z',
    status: 'Active',
    credentialsCount: 2,
    credentialAgeDays: 145,
    accessBreadth: 'High',
    riskFactors: [
      'Credential age is over 90 days',
      'Wildcard permissions on critical AWS resources',
      'Accessed from dynamic/unknown IP addresses'
    ]
  },
  {
    id: 'identity_k8s_001',
    name: 'payments-service-sa',
    type: 'Service Account',
    provider: 'Kubernetes',
    environment: 'Production',
    riskScore: 35,
    lastActive: '2026-08-09T12:00:00Z',
    owner: 'Backend Team',
    createdAt: '2025-03-15T00:00:00Z',
    status: 'Active',
    credentialsCount: 1,
    credentialAgeDays: 45,
    accessBreadth: 'Medium',
    riskFactors: [
      'Has access to payment processing environment'
    ]
  },
  {
    id: 'identity_api_001',
    name: 'Stripe Integration Key',
    type: 'API Key',
    provider: 'Internal',
    environment: 'Production',
    riskScore: 88,
    lastActive: '2026-08-09T11:45:00Z',
    owner: 'Finance Team',
    createdAt: '2024-11-20T00:00:00Z',
    status: 'Active',
    credentialsCount: 1,
    credentialAgeDays: 262,
    accessBreadth: 'High',
    riskFactors: [
      'Exposed key signature pattern detected in public VCS log history',
      'High number of write operations on customer records',
      'No credential rotation in 6+ months'
    ]
  },
  {
    id: 'identity_api_002',
    name: 'SendGrid Mailer',
    type: 'API Key',
    provider: 'Internal',
    environment: 'Staging',
    riskScore: 12,
    lastActive: '2026-08-08T09:30:00Z',
    owner: 'Marketing',
    createdAt: '2025-06-01T00:00:00Z',
    status: 'Active',
    credentialsCount: 1,
    credentialAgeDays: 69,
    accessBreadth: 'Low',
    riskFactors: []
  },
  {
    id: 'identity_oauth_001',
    name: 'Slack Bot Integration',
    type: 'Bot',
    provider: 'Internal',
    environment: 'Corporate',
    riskScore: 45,
    lastActive: '2026-08-09T08:00:00Z',
    owner: 'IT Helpdesk',
    createdAt: '2025-02-14T00:00:00Z',
    status: 'Active',
    credentialsCount: 1,
    credentialAgeDays: 176,
    accessBreadth: 'Medium',
    riskFactors: [
      'Wide scope permissions to read public channels',
      'Credential has not been rotated'
    ]
  },
  {
    id: 'identity_workload_002',
    name: 'Kubernetes Cluster Provisioner',
    type: 'Machine Identity',
    provider: 'Kubernetes',
    environment: 'Production',
    riskScore: 92,
    lastActive: '2026-08-09T14:10:00Z',
    owner: 'Platform Team',
    createdAt: '2025-01-05T00:00:00Z',
    status: 'Active',
    credentialsCount: 3,
    credentialAgeDays: 216,
    accessBreadth: 'High',
    riskFactors: [
      'Administrator role bounds assigned',
      'No recent credential rotations',
      'Elevated privilege escalation capability detected'
    ]
  }
];

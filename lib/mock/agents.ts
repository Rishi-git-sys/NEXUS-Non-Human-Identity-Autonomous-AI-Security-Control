import { Agent } from '../types/agent';

export const mockAgents: Agent[] = [
  {
    id: 'agent_devops_001',
    name: 'DevOps-Agent',
    purpose: 'Automate CI/CD deployments and cloud resource provisioning.',
    model: 'GPT-4-Turbo',
    environment: 'Production',
    riskScore: 98,
    status: 'Active',
    owner: 'Platform Team',
    lastActive: '2026-08-09T14:42:32Z',
    connectedSystems: ['AWS Elastic Container Service', 'GitHub Actions', 'Production PostgreSQL Database'],
    permissionsCount: 8,
    riskBreakdown: {
      permissionRisk: 85,
      behaviorRisk: 98,
      credentialRisk: 40,
      exposureRisk: 90
    },
    capabilities: [
      { id: 'cap_1', capability: 'GitHub Automation', resource: 'nexus-repo', accessLevel: 'Write', decision: 'ALLOWED', reason: 'Standard CI/CD automation' },
      { id: 'cap_2', capability: 'CI/CD Pipeline', resource: 'github-actions', accessLevel: 'Admin', decision: 'ALLOWED', reason: 'Required for deployments' },
      { id: 'cap_3', capability: 'AWS Production Access', resource: 'aws-prod-cluster', accessLevel: 'Read', decision: 'REVIEW', reason: 'High privilege environment access request' },
      { id: 'cap_4', capability: 'Production DB Delete', resource: 'production_database', accessLevel: 'Admin', decision: 'BLOCKED', reason: 'Violates production data protection policy: Block Production Database Deletion' }
    ]
  },
  {
    id: 'agent_finance_001',
    name: 'Finance-Agent',
    purpose: 'Read ledger database entries and process financial analytics summaries.',
    model: 'Claude-3-Opus',
    environment: 'Internal',
    riskScore: 45,
    status: 'Active',
    owner: 'Finance Analytics',
    lastActive: '2026-08-09T12:25:00Z',
    connectedSystems: ['AWS S3 Finance Bucket', 'Internal Ledger Service'],
    permissionsCount: 2,
    riskBreakdown: {
      permissionRisk: 40,
      behaviorRisk: 30,
      credentialRisk: 20,
      exposureRisk: 10
    },
    capabilities: [
      { id: 'cap_5', capability: 'Read Financial Reports', resource: 's3-finance-bucket', accessLevel: 'Read', decision: 'ALLOWED', reason: 'Required for analytics' }
    ]
  },
  {
    id: 'agent_support_001',
    name: 'Customer-Support-Agent',
    purpose: 'Draft responses to user support queries and fetch account statuses.',
    model: 'GPT-4o',
    environment: 'Customer-Facing',
    riskScore: 65,
    status: 'Active',
    owner: 'Customer Success',
    lastActive: '2026-08-09T13:10:00Z',
    connectedSystems: ['Zendesk API', 'Customer Database Staging'],
    permissionsCount: 4,
    riskBreakdown: {
      permissionRisk: 60,
      behaviorRisk: 55,
      credentialRisk: 30,
      exposureRisk: 70
    },
    capabilities: [
      { id: 'cap_6', capability: 'Zendesk Read/Write', resource: 'zendesk-tickets', accessLevel: 'Write', decision: 'ALLOWED', reason: 'Update ticket resolution comments' },
      { id: 'cap_7', capability: 'Customer Detail Read', resource: 'customer-db-staging', accessLevel: 'Read', decision: 'ALLOWED', reason: 'Query subscriber information' }
    ]
  },
  {
    id: 'agent_code_001',
    name: 'Code-Review-Agent',
    purpose: 'Analyze git pull requests for architectural lints and bug patterns.',
    model: 'GPT-4-Turbo',
    environment: 'Development',
    riskScore: 25,
    status: 'Idle',
    owner: 'Engineering Architecture',
    lastActive: '2026-08-09T11:20:00Z',
    connectedSystems: ['GitHub Enterprise API'],
    permissionsCount: 3,
    riskBreakdown: {
      permissionRisk: 20,
      behaviorRisk: 10,
      credentialRisk: 15,
      exposureRisk: 5
    },
    capabilities: [
      { id: 'cap_8', capability: 'Read PR Codebase', resource: 'github-enterprise-repos', accessLevel: 'Read', decision: 'ALLOWED', reason: 'Review pull requests' }
    ]
  },
  {
    id: 'agent_db_001',
    name: 'Database-Agent',
    purpose: 'Execute migrations and schema updates on staging databases.',
    model: 'Claude-3-Sonnet',
    environment: 'Staging',
    riskScore: 75,
    status: 'Suspended',
    owner: 'Platform Team',
    lastActive: '2026-08-08T09:15:00Z',
    connectedSystems: ['Staging PostgreSQL Server'],
    permissionsCount: 5,
    riskBreakdown: {
      permissionRisk: 80,
      behaviorRisk: 70,
      credentialRisk: 60,
      exposureRisk: 50
    },
    capabilities: [
      { id: 'cap_9', capability: 'Execute DDL scripts', resource: 'staging-database', accessLevel: 'Admin', decision: 'REVIEW', reason: 'Schema changes require platform team approval' }
    ]
  },
  {
    id: 'agent_sec_001',
    name: 'Security-Agent',
    purpose: 'Monitor audit systems and auto-isolate compromised workload nodes.',
    model: 'Custom-LLM',
    environment: 'All',
    riskScore: 15,
    status: 'Active',
    owner: 'Security Operations',
    lastActive: '2026-08-09T14:48:00Z',
    connectedSystems: ['AWS IAM Controller', 'NEXUS API', 'Slack Alerts Channel'],
    permissionsCount: 12,
    riskBreakdown: {
      permissionRisk: 90,
      behaviorRisk: 5,
      credentialRisk: 10,
      exposureRisk: 5
    },
    capabilities: [
      { id: 'cap_10', capability: 'Audit Logs Read', resource: 'nexus-audit-logs', accessLevel: 'Read', decision: 'ALLOWED', reason: 'Perform threat intelligence analysis' }
    ]
  }
];

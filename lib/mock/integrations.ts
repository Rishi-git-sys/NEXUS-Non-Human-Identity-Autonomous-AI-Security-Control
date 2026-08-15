import { Integration } from '../types/integration';

export const mockIntegrations: Integration[] = [
  {
    id: 'int_aws',
    name: 'Amazon Web Services (AWS)',
    description: 'Discover IAM roles, access keys, and federated service profiles to track privilege usage.',
    type: 'AWS IAM & STS',
    status: 'Connected',
    category: 'Cloud'
  },
  {
    id: 'int_github',
    name: 'GitHub Enterprise',
    description: 'Scan CI/CD repositories for leaked workflow tokens, service connections, and active secrets.',
    type: 'GitHub App Connection',
    status: 'Connected',
    category: 'VCS'
  },
  {
    id: 'int_k8s',
    name: 'Kubernetes Cluster Provisioner',
    description: 'Govern service account secrets, pod security contexts, and workload token exposures.',
    type: 'Kubernetes Agent',
    status: 'Connected',
    category: 'Orchestration'
  },
  {
    id: 'int_openclaw',
    name: 'OpenClaw Agent Governance',
    description: 'Monitor, intercept, and govern capabilities requested by OpenClaw autonomous AI agents.',
    type: 'OpenClaw NHI Gateway',
    status: 'Available',
    category: 'Agent Framework'
  },
  {
    id: 'int_okta',
    name: 'Okta Identity Cloud',
    description: 'Audit directory API tokens, OAuth client grants, and administrative credentials behavior.',
    type: 'Okta REST API Integration',
    status: 'Available',
    category: 'Identity'
  },
  {
    id: 'int_azure',
    name: 'Microsoft Azure Active Directory',
    description: 'Govern managed identities, app registrations, and resource group access privileges.',
    type: 'Azure Graph API App',
    status: 'Coming Soon',
    category: 'Cloud'
  },
  {
    id: 'int_gcp',
    name: 'Google Cloud Platform (GCP)',
    description: 'Observe service account key usages, IAM policies, and cloud function execution permissions.',
    type: 'GCP Service Account IAM',
    status: 'Coming Soon',
    category: 'Cloud'
  }
];

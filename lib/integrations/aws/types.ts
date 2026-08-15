export interface AWSIdentity {
  external_id: string; // ARN or ID
  provider: 'aws' | 'AWS';
  identity_type: 'service_account' | 'workload_identity' | 'bot'; // Mapped to NEXUS valid types
  name: string;
  status: 'active' | 'inactive'; // Mapped to NEXUS valid statuses
  metadata: {
    arn: string;
    createDate?: string;
    lastUsedDate?: string;
    path?: string;
    type: 'User' | 'Role' | 'IAM User' | 'IAM Role';
  };
}

export interface AWSIntegrationStatus {
  success: boolean;
  provider: 'aws' | 'AWS';
  connected: boolean;
  error?: string;
}

export interface AWSIAMDiscoveryResult {
  success: boolean;
  provider: 'aws' | 'AWS';
  users: AWSIdentity[];
  roles: AWSIdentity[];
  summary: {
    users: number;
    roles: number;
  };
  error?: string;
}

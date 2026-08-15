export type ResourceType = 'Database' | 'API' | 'Cloud Role' | 'Application' | 'Storage' | 'Service' | 'Other';
export type ResourceSensitivity = 'Public' | 'Internal' | 'Confidential' | 'Restricted';
export type ResourceStatus = 'Active' | 'Inactive' | 'Deprecated' | 'Restricted';

export interface ResourceItem {
  id: string;
  organizationId: string;
  name: string;
  resourceType: ResourceType;
  sensitivity: ResourceSensitivity;
  status: ResourceStatus;
  owner: string;
  environment: string;
  riskScore: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

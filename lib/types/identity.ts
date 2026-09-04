export type IdentityType = 'API Key' | 'Service Account' | 'IAM Role' | 'OAuth Client' | 'Machine Identity' | 'Workload' | 'Bot';

export interface RiskFactor {
  code: string;
  severity: string;
  title: string;
  description: string;
  recommendation?: string;
}

export interface NexusRisk {
  score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  credentialRisk?: number;
  permissionRisk?: number;
  calculatedAt: string;
  riskFactors: RiskFactor[];
}

export interface Identity {
  id: string;
  name: string;
  type: IdentityType;
  provider: string;
  environment: string;
  riskScore: number;
  lastActive: string | null;
  owner: string;
  createdAt: string;
  status: 'Active' | 'Inactive' | 'Disabled';
  credentialsCount: number;
  credentialAgeDays: number;
  accessBreadth: 'Low' | 'Medium' | 'High';
  riskFactors: (string | RiskFactor)[];
  arn?: string;
  awsType?: string;
  awsPath?: string;
  awsSecurity?: AWSSecurityIntelligence;
}

export interface AWSAccessKey {
  accessKeyId: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  ageDays: number;
}

export interface AWSPolicy {
  name: string;
  arn?: string; // arn is present for managed policies, missing/optional for inline
  source: 'managed' | 'inline' | 'group';
  actions: string[];
  resources: string[];
  administrator: boolean;
}

export interface AWSSecurityIntelligence {
  accessKeys: AWSAccessKey[];
  policies: AWSPolicy[];
  groups?: string[];
  privilegeSummary: {
    administrator: boolean;
    wildcardActions: boolean;
    wildcardResources: boolean;
  };
  errors?: {
    operation: string;
    errorName?: string;
    errorCode?: string;
    message?: string;
    httpStatusCode?: number;
    requestId?: string;
  }[];
}

export const VALID_DB_IDENTITY_TYPES = [
  'service_account',
  'api_key',
  'workload_identity',
  'machine_identity',
  'bot',
  'other',
] as const;

export type DBIdentityType = (typeof VALID_DB_IDENTITY_TYPES)[number];

export const VALID_DB_IDENTITY_STATUSES = [
  'active',
  'inactive',
  'suspended',
  'unknown',
] as const;

export type DBIdentityStatus = (typeof VALID_DB_IDENTITY_STATUSES)[number];

/**
 * Converts a UI-facing identity type label into the exact PostgreSQL database check constraint value.
 */
export function mapUITypeToDB(typeLabel: string): DBIdentityType {
  const normalized = (typeLabel || '').toLowerCase().trim();
  if (normalized === 'service_account' || normalized === 'service account') return 'service_account';
  if (normalized === 'api_key' || normalized === 'api key') return 'api_key';
  if (normalized === 'workload_identity' || normalized === 'workload identity' || normalized === 'workload' || normalized === 'iam role') return 'workload_identity';
  if (normalized === 'machine_identity' || normalized === 'machine identity') return 'machine_identity';
  if (normalized === 'bot' || normalized === 'ai agent' || normalized === 'oauth client') return 'bot';
  if (normalized === 'other') return 'other';

  // Inclusion fallbacks
  if (normalized.includes('service') || normalized.includes('account')) return 'service_account';
  if (normalized.includes('api') || normalized.includes('key')) return 'api_key';
  if (normalized.includes('workload') || normalized.includes('role') || normalized.includes('iam')) return 'workload_identity';
  if (normalized.includes('machine')) return 'machine_identity';
  if (normalized.includes('bot') || normalized.includes('agent')) return 'bot';

  return 'other';
}

/**
 * Converts a database check constraint value into a human-readable UI label.
 */
export function mapDBTypeToUI(dbType: string): IdentityType {
  const normalized = (dbType || '').toLowerCase().trim();
  switch (normalized) {
    case 'service_account':
      return 'Service Account';
    case 'api_key':
      return 'API Key';
    case 'workload_identity':
      return 'IAM Role';
    case 'machine_identity':
      return 'Machine Identity';
    case 'bot':
      return 'Bot';
    case 'other':
      return 'Machine Identity';
    default:
      return (dbType as IdentityType) || 'Service Account';
  }
}

/**
 * Converts a UI status label to the exact PostgreSQL database check constraint value.
 */
export function mapUIStatusToDB(statusLabel: string): DBIdentityStatus {
  const normalized = (statusLabel || '').toLowerCase().trim();
  if (normalized === 'active' || normalized === 'allowed') return 'active';
  if (normalized === 'inactive') return 'inactive';
  if (normalized === 'suspended' || normalized === 'disabled' || normalized === 'blocked') return 'suspended';
  if (normalized === 'unknown') return 'unknown';
  return 'active';
}

/**
 * Converts a database status value back to a human-readable title-case UI label.
 */
export function mapDBStatusToUI(dbStatus: string): Identity['status'] {
  const normalized = (dbStatus || '').toLowerCase().trim();
  switch (normalized) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'suspended':
      return 'Disabled';
    case 'unknown':
      return 'Inactive';
    default:
      return 'Active';
  }
}

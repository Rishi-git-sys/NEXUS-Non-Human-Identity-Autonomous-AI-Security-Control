export type SecurityFindingSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type SecurityFindingCategory =
  | 'CREDENTIAL'
  | 'PERMISSION'
  | 'IDENTITY'
  | 'AI_AGENT'
  | 'AWS'
  | 'RESOURCE';

export interface SecurityFinding {
  id: string;
  organizationId: string;

  subjectId: string;
  subjectType: 'identity' | 'ai_agent' | 'resource';

  code: string;
  category: SecurityFindingCategory;
  severity: SecurityFindingSeverity;

  title: string;
  description: string;
  recommendation: string;

  riskContribution: number;
  riskScore?: number;

  evidence: Record<string, unknown>;

  provider?: string;
  resourceId?: string;

  detectedAt: string;

  fingerprint: string;
}

export interface SecurityFindingsFilterOptions {
  severity?: string;
  category?: string;
  subjectType?: string;
  subjectId?: string;
  page?: number;
  limit?: number;
}

export interface SecurityFindingsPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SecurityFindingsResponse {
  data: SecurityFinding[];
  pagination: SecurityFindingsPagination;
}

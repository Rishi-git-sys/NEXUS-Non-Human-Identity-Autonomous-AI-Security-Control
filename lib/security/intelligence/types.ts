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

export interface RiskSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface RiskCategoryBreakdown {
  count: number;
  riskContribution: number;
  criticalCount: number;
  highCount: number;
}

export interface RiskSubjectBreakdown {
  total: number;
  atRisk: number;
  averageRiskScore: number;
  findingsCount: number;
}

export interface RiskTopContributor {
  findingId: string;
  code: string;
  category: SecurityFindingCategory;
  severity: SecurityFindingSeverity;
  subjectId: string;
  subjectType: 'identity' | 'ai_agent' | 'resource';
  subjectName?: string;
  title: string;
  riskContribution: number;
  recommendation: string;
}

export interface OrganizationRiskPosture {
  overallScore: number;
  severity: SecurityFindingSeverity;
  status: 'Healthy' | 'Medium Risk' | 'High Risk' | 'Critical';
  assessedAt: string;

  totalFindings: number;

  severityCounts: RiskSeverityCounts;

  categoryBreakdown: Record<
    SecurityFindingCategory,
    RiskCategoryBreakdown
  >;

  subjectBreakdown: {
    identities: RiskSubjectBreakdown;
    aiAgents: RiskSubjectBreakdown;
  };

  topRiskContributors: RiskTopContributor[];
}

export type SecurityPatternSeverity =
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type SecurityPatternType =
  | 'CREDENTIAL_EXPOSURE'
  | 'PRIVILEGE_ESCALATION'
  | 'UNBOUNDED_EXECUTION'
  | 'ATTACK_SURFACE';

export interface SecurityPattern {
  id: string;
  organizationId: string;
  patternCode: string;
  patternType: SecurityPatternType;
  severity: SecurityPatternSeverity;

  title: string;
  description: string;
  recommendation: string;

  subjectId: string;
  subjectType: 'identity' | 'ai_agent' | 'resource';
  subjectName?: string;

  correlatedFindingIds: string[];
  correlatedFindingCodes: string[];

  evidence: Record<string, unknown>;

  detectedAt: string;
  fingerprint: string;
}

export interface SecurityPatternsSummary {
  totalPatterns: number;
  criticalPatterns: number;
  highPatterns: number;
  mediumPatterns: number;
  affectedSubjects: number;
}

export interface SecurityPatternsResponse {
  data: SecurityPattern[];
  summary: SecurityPatternsSummary;
  pagination: SecurityFindingsPagination;
}

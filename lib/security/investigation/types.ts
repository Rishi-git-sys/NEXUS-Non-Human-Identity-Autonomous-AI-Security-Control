import type {
  OrganizationRiskPosture,
  RiskTopContributor,
  SecurityFindingCategory,
  SecurityFindingSeverity,
  SecurityPatternSeverity,
  SecurityPatternType,
} from '@/lib/security/intelligence/types';

export type InvestigationTargetType =
  | 'finding'
  | 'pattern'
  | 'subject'
  | 'posture';

export type InvestigationSubjectType =
  | 'identity'
  | 'ai_agent'
  | 'resource';

export type InvestigationEvidenceValue =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | readonly number[]
  | readonly boolean[];

export interface InvestigationRequest {
  readonly targetType: InvestigationTargetType;
  readonly findingIds?: readonly string[];
  readonly patternIds?: readonly string[];
  readonly subjectType?: InvestigationSubjectType;
  readonly subjectId?: string;
  readonly includeRiskPosture?: boolean;
  readonly analystQuestion?: string;
}

export interface InvestigationSubjectSummary {
  readonly subjectId: string;
  readonly subjectType: InvestigationSubjectType;
  readonly subjectName?: string;
  readonly provider?: string;
  readonly environment?: string;
  readonly status?: string;
  readonly riskScore?: number;
}

export interface InvestigationFindingContext {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectType: InvestigationSubjectType;
  readonly code: string;
  readonly category: SecurityFindingCategory;
  readonly severity: SecurityFindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly riskContribution: number;
  readonly riskScore?: number;
  readonly detectedAt: string;
  readonly fingerprint: string;
  readonly provider?: string;
  readonly resourceId?: string;
  readonly sanitizedEvidence: Readonly<Record<string, InvestigationEvidenceValue>>;
}

export interface InvestigationPatternContext {
  readonly id: string;
  readonly patternCode: string;
  readonly patternType: SecurityPatternType;
  readonly severity: SecurityPatternSeverity;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly subjectId: string;
  readonly subjectType: InvestigationSubjectType;
  readonly subjectName?: string;
  readonly correlatedFindingIds: readonly string[];
  readonly correlatedFindingCodes: readonly string[];
  readonly detectedAt: string;
  readonly fingerprint: string;
  readonly sanitizedEvidence: Readonly<Record<string, InvestigationEvidenceValue>>;
}

export interface InvestigationRiskPostureContext {
  readonly overallScore: OrganizationRiskPosture['overallScore'];
  readonly severity: OrganizationRiskPosture['severity'];
  readonly status: OrganizationRiskPosture['status'];
  readonly assessedAt: OrganizationRiskPosture['assessedAt'];
  readonly totalFindings: OrganizationRiskPosture['totalFindings'];
  readonly severityCounts: OrganizationRiskPosture['severityCounts'];
  readonly categoryBreakdown: OrganizationRiskPosture['categoryBreakdown'];
  readonly subjectBreakdown: OrganizationRiskPosture['subjectBreakdown'];
}

export interface InvestigationContext {
  readonly targetType: InvestigationTargetType;
  readonly generatedAt: string;
  readonly analystQuestion?: string;
  readonly sourceFindingIds: readonly string[];
  readonly sourcePatternIds: readonly string[];

  // Deterministic NEXUS findings and patterns are authoritative. No raw
  // database rows, credentials, secrets, or unsanitized metadata may cross this boundary.
  readonly verifiedFacts: {
    readonly subject?: InvestigationSubjectSummary;
    readonly findings: readonly InvestigationFindingContext[];
    readonly patterns: readonly InvestigationPatternContext[];
    readonly riskPosture?: InvestigationRiskPostureContext;
    readonly topContributors: readonly RiskTopContributor[];
  };
}

export interface InvestigationResult {
  readonly summary: string;
  readonly verifiedFacts: readonly string[];
  readonly impact: string;
  readonly priorityRationale: string;
  readonly recommendedActions: readonly string[];
  readonly evidenceGaps: readonly string[];
  readonly uncertainty: readonly string[];

  // AI output is advisory only. These IDs must be subsets of the deterministic
  // findings and patterns supplied in InvestigationContext.
  readonly sourceFindingIds: readonly string[];
  readonly sourcePatternIds: readonly string[];

  readonly model: string;
  readonly generatedAt: string;
}

export type InvestigationOutput = InvestigationResult;

export interface InvestigationProviderRequest {
  readonly context: InvestigationContext;
  readonly analystQuestion?: string;
}

export interface InvestigationProvider {
  readonly name: string;

  // Provider implementations must not create unsupported findings, alter
  // deterministic risk scores/severities, or return mutation commands.
  generateInvestigation(
    request: InvestigationProviderRequest
  ): Promise<InvestigationResult>;
}

export const INVESTIGATION_LIMITS = {
  maxFindingsPerInvestigation: 10,
  maxPatternsPerInvestigation: 5,
  maxAnalystQuestionLength: 1_000,
  maxRecommendedActions: 8,
  maxEvidenceGaps: 8,
  maxUncertaintyItems: 6,
  maxVerifiedFactItems: 12,
} as const;

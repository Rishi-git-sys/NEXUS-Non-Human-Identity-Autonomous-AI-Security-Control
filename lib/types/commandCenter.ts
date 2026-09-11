import type {
  OrganizationRiskPosture,
  SecurityFindingCategory,
  SecurityFindingSeverity,
  SecurityPatternsSummary,
} from '@/lib/security/intelligence/types';

// ============================================================================
// COMMAND CENTER SANITIZED TYPES
// ============================================================================

/**
 * A security finding with evidence explicitly stripped at runtime.
 * This is NOT a TypeScript-only Omit<> — the API route must construct
 * these objects field-by-field to ensure evidence is never transmitted.
 */
export interface CommandCenterFinding {
  readonly id: string;
  readonly organizationId: string;
  readonly subjectId: string;
  readonly subjectType: 'identity' | 'ai_agent' | 'resource';
  readonly code: string;
  readonly category: SecurityFindingCategory;
  readonly severity: SecurityFindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly riskContribution: number;
  readonly riskScore?: number;
  readonly provider?: string;
  readonly detectedAt: string;
  readonly fingerprint: string;
  // NOTE: 'evidence' is intentionally excluded.
  // NOTE: 'resourceId' is intentionally excluded.
}

/**
 * A security pattern with evidence explicitly stripped at runtime.
 */
export interface CommandCenterPattern {
  readonly id: string;
  readonly organizationId: string;
  readonly patternCode: string;
  readonly patternType: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly subjectId: string;
  readonly subjectType: 'identity' | 'ai_agent' | 'resource';
  readonly subjectName?: string;
  readonly correlatedFindingIds: string[];
  readonly correlatedFindingCodes: string[];
  readonly detectedAt: string;
  readonly fingerprint: string;
  // NOTE: 'evidence' is intentionally excluded.
}

/**
 * Aggregated Command Center intelligence response.
 * All data is deterministic and authoritative.
 * NVIDIA advisory data is NOT included — it is loaded separately.
 */
export interface CommandCenterIntelligence {
  readonly riskPosture: OrganizationRiskPosture;
  readonly findings: readonly CommandCenterFinding[];
  readonly patterns: readonly CommandCenterPattern[];
  readonly patternsSummary: SecurityPatternsSummary;
  readonly assessedAt: string;
}

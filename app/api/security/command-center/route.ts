import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { findingService } from '@/lib/security/intelligence/findingService';
import { riskIntelligenceService } from '@/lib/security/intelligence/riskIntelligenceService';
import { correlationService } from '@/lib/security/intelligence/correlationService';
import type { SecurityFinding, SecurityPattern } from '@/lib/security/intelligence/types';
import type {
  CommandCenterFinding,
  CommandCenterPattern,
  CommandCenterIntelligence,
} from '@/lib/types/commandCenter';

// ============================================================================
// RUNTIME SANITIZATION
// ============================================================================

/**
 * Explicitly construct a sanitized finding object field-by-field.
 * Evidence, resourceId, and any other sensitive fields are never copied.
 * This is a runtime guarantee — not a TypeScript-only Omit<>.
 */
function sanitizeFinding(finding: SecurityFinding): CommandCenterFinding {
  return {
    id: finding.id,
    organizationId: finding.organizationId,
    subjectId: finding.subjectId,
    subjectType: finding.subjectType,
    code: finding.code,
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    riskContribution: finding.riskContribution,
    riskScore: finding.riskScore,
    provider: finding.provider,
    detectedAt: finding.detectedAt,
    fingerprint: finding.fingerprint,
  };
}

/**
 * Explicitly construct a sanitized pattern object field-by-field.
 * Evidence is never copied.
 */
function sanitizePattern(pattern: SecurityPattern): CommandCenterPattern {
  return {
    id: pattern.id,
    organizationId: pattern.organizationId,
    patternCode: pattern.patternCode,
    patternType: pattern.patternType,
    severity: pattern.severity,
    title: pattern.title,
    description: pattern.description,
    recommendation: pattern.recommendation,
    subjectId: pattern.subjectId,
    subjectType: pattern.subjectType,
    subjectName: pattern.subjectName,
    correlatedFindingIds: [...pattern.correlatedFindingIds],
    correlatedFindingCodes: [...pattern.correlatedFindingCodes],
    detectedAt: pattern.detectedAt,
    fingerprint: pattern.fingerprint,
  };
}

// ============================================================================
// SEVERITY ORDERING FOR SORTING
// ============================================================================

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/** Maximum number of findings returned to the Command Center */
const MAX_FINDINGS = 20;

// ============================================================================
// GET /api/security/command-center
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce server-side authentication and derive authoritative organizationId
    const { user, organizationId } = await requireAuth();

    // 2. Enforce READ rate limiting
    const rl = await enforceRateLimit(req, 'READ', { userId: user.id, organizationId });
    if (!rl.success && rl.response) {
      return rl.response;
    }

    // 3. Fetch deterministic intelligence from authoritative services
    const [findingsResult, riskPosture, patternsResult] = await Promise.all([
      findingService.getAllFindings(organizationId),
      riskIntelligenceService.getOrganizationRiskPosture(organizationId),
      correlationService.getCorrelatedPatterns(organizationId),
    ]);

    // 4. Sort findings by severity desc, then riskContribution desc, limit to top N
    const sortedFindings = [...findingsResult.data]
      .sort((a, b) => {
        const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
        if (sevDiff !== 0) return sevDiff;
        return b.riskContribution - a.riskContribution;
      })
      .slice(0, MAX_FINDINGS);

    // 5. Explicitly sanitize findings and patterns (runtime evidence stripping)
    const sanitizedFindings: CommandCenterFinding[] = sortedFindings.map(sanitizeFinding);
    const sanitizedPatterns: CommandCenterPattern[] = patternsResult.data.map(sanitizePattern);

    // 6. Construct response
    const intelligence: CommandCenterIntelligence = {
      riskPosture,
      findings: sanitizedFindings,
      patterns: sanitizedPatterns,
      patternsSummary: patternsResult.summary,
      assessedAt: new Date().toISOString(),
    };

    return apiSuccess(intelligence);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch command center intelligence.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

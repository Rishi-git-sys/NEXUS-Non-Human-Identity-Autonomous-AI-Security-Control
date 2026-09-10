import { correlationService } from '@/lib/security/intelligence/correlationService';
import { sanitizeEvidence } from '@/lib/security/intelligence/evidence';
import { findingService } from '@/lib/security/intelligence/findingService';
import { riskIntelligenceService } from '@/lib/security/intelligence/riskIntelligenceService';
import type {
  OrganizationRiskPosture,
  SecurityFinding,
  SecurityFindingsFilterOptions,
  SecurityFindingsResponse,
  SecurityPattern,
  SecurityPatternsResponse,
} from '@/lib/security/intelligence/types';
import type {
  InvestigationContext,
  InvestigationEvidenceValue,
  InvestigationFindingContext,
  InvestigationPatternContext,
  InvestigationRequest,
  InvestigationRiskPostureContext,
  InvestigationSubjectSummary,
  InvestigationSubjectType,
  InvestigationTargetType,
} from './types';
import { INVESTIGATION_LIMITS } from './types';

const VALID_TARGET_TYPES: ReadonlySet<InvestigationTargetType> = new Set([
  'finding',
  'pattern',
  'subject',
  'posture',
]);

const VALID_SUBJECT_TYPES: ReadonlySet<InvestigationSubjectType> = new Set([
  'identity',
  'ai_agent',
  'resource',
]);

const ALLOWED_EVIDENCE_KEYS = new Set([
  'identityType',
  'provider',
  'isServiceLinkedRole',
  'credentialType',
  'hasActiveAccessKeys',
  'activeKeyCount',
  'totalKeyCount',
  'maxKeyAgeDays',
  'policyCount',
  'policyNames',
  'wildcardActions',
  'wildcardResources',
  'isAdministrator',
  'operation',
  'errorCode',
  'status',
  'adminCapabilityCount',
  'wildcardCapabilityCount',
  'totalCapabilities',
  'permissionsCount',
  'unrestrictedResources',
  'keyAgeDays',
  'actionPolicyNames',
  'resourcePolicyNames',
]);

const SECRET_VALUE_PATTERNS = [
  /AKIA[0-9A-Z]{16}/i,
  /ASIA[0-9A-Z]{16}/i,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /Bearer\s+[A-Za-z0-9._~+/-]+/i,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i,
  /supabase(?:[._-])?(?:service|anon|publishable)?(?:[._-])?key/i,
];

export interface InvestigationContextSources {
  readonly getAllFindings: (
    organizationId: string,
    options?: SecurityFindingsFilterOptions
  ) => Promise<SecurityFindingsResponse>;
  readonly getCorrelatedPatterns: (
    organizationId: string,
    options?: {
      severity?: string;
      subjectType?: string;
      page?: number;
      limit?: number;
    }
  ) => Promise<SecurityPatternsResponse>;
  readonly getOrganizationRiskPosture: (
    organizationId: string
  ) => Promise<OrganizationRiskPosture>;
}

export class InvestigationContextBuilderError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'InvestigationContextBuilderError';
    this.status = status;
  }
}

const defaultSources: InvestigationContextSources = {
  getAllFindings: findingService.getAllFindings.bind(findingService),
  getCorrelatedPatterns: correlationService.getCorrelatedPatterns.bind(correlationService),
  getOrganizationRiskPosture:
    riskIntelligenceService.getOrganizationRiskPosture.bind(riskIntelligenceService),
};

export async function buildInvestigationContext(
  organizationId: string,
  request: InvestigationRequest,
  sources: InvestigationContextSources = defaultSources
): Promise<InvestigationContext> {
  const normalizedOrganizationId = organizationId.trim();
  if (!normalizedOrganizationId) {
    throw new InvestigationContextBuilderError(
      'Organization context is required to build an investigation context.',
      403
    );
  }

  if (!VALID_TARGET_TYPES.has(request.targetType)) {
    throw new InvestigationContextBuilderError('Unsupported investigation target type.');
  }

  const analystQuestion = normalizeAnalystQuestion(request.analystQuestion);
  const requestedFindingIds = normalizeIds(request.findingIds);
  const requestedPatternIds = normalizeIds(request.patternIds);

  if (requestedFindingIds.length > INVESTIGATION_LIMITS.maxFindingsPerInvestigation) {
    throw new InvestigationContextBuilderError(
      `At most ${INVESTIGATION_LIMITS.maxFindingsPerInvestigation} findings may be investigated at once.`
    );
  }

  if (requestedPatternIds.length > INVESTIGATION_LIMITS.maxPatternsPerInvestigation) {
    throw new InvestigationContextBuilderError(
      `At most ${INVESTIGATION_LIMITS.maxPatternsPerInvestigation} patterns may be investigated at once.`
    );
  }

  let selectedFindings: readonly SecurityFinding[] = [];
  let selectedPatterns: readonly SecurityPattern[] = [];
  let riskPosture: OrganizationRiskPosture | undefined;

  if (request.targetType === 'finding') {
    if (requestedFindingIds.length === 0) {
      throw new InvestigationContextBuilderError(
        'At least one finding id is required for a finding investigation.'
      );
    }

    const allFindings = await loadAllFindings(normalizedOrganizationId, sources);
    selectedFindings = selectByIds(allFindings, requestedFindingIds, 'finding');
  }

  if (request.targetType === 'pattern') {
    if (requestedPatternIds.length === 0) {
      throw new InvestigationContextBuilderError(
        'At least one pattern id is required for a pattern investigation.'
      );
    }

    const allPatterns = await loadAllPatterns(normalizedOrganizationId, sources);
    selectedPatterns = selectByIds(allPatterns, requestedPatternIds, 'pattern');

    const correlatedFindingIds = new Set(
      selectedPatterns.flatMap((pattern) => pattern.correlatedFindingIds)
    );
    if (correlatedFindingIds.size > 0) {
      const allFindings = await loadAllFindings(normalizedOrganizationId, sources);
      selectedFindings = allFindings.filter((finding) =>
        correlatedFindingIds.has(finding.id)
      );
    }
  }

  if (request.targetType === 'subject') {
    if (!request.subjectType || !VALID_SUBJECT_TYPES.has(request.subjectType)) {
      throw new InvestigationContextBuilderError(
        'A supported subjectType is required for a subject investigation.'
      );
    }

    const subjectId = request.subjectId?.trim();
    if (!subjectId) {
      throw new InvestigationContextBuilderError(
        'A subjectId is required for a subject investigation.'
      );
    }

    const [allFindings, allPatterns] = await Promise.all([
      loadAllFindings(normalizedOrganizationId, sources),
      loadAllPatterns(normalizedOrganizationId, sources),
    ]);

    selectedFindings = allFindings.filter(
      (finding) =>
        finding.subjectType === request.subjectType &&
        finding.subjectId === subjectId
    );
    selectedPatterns = allPatterns.filter(
      (pattern) =>
        pattern.subjectType === request.subjectType &&
        pattern.subjectId === subjectId
    );

    enforceSelectedCountLimits(selectedFindings, selectedPatterns);
  }

  if (request.targetType === 'posture') {
    riskPosture = await sources.getOrganizationRiskPosture(normalizedOrganizationId);
  } else if (request.includeRiskPosture) {
    riskPosture = await sources.getOrganizationRiskPosture(normalizedOrganizationId);
  }

  const orgScopedFindings = selectedFindings.filter(
    (finding) => finding.organizationId === normalizedOrganizationId
  );
  const orgScopedPatterns = selectedPatterns.filter(
    (pattern) => pattern.organizationId === normalizedOrganizationId
  );

  if (
    request.targetType !== 'posture' &&
    orgScopedFindings.length === 0 &&
    orgScopedPatterns.length === 0
  ) {
    throw new InvestigationContextBuilderError(
      'No authoritative investigation context matched the requested target.',
      404
    );
  }

  const findingContexts = orgScopedFindings
    .map(toFindingContext)
    .sort(compareFindingContexts);
  const patternContexts = orgScopedPatterns
    .map(toPatternContext)
    .sort(comparePatternContexts);
  const postureContext = riskPosture ? toRiskPostureContext(riskPosture) : undefined;
  const topContributors = riskPosture
    ? [...riskPosture.topRiskContributors].sort(compareTopContributors)
    : [];
  const subject = buildSubjectSummary(request, findingContexts, patternContexts);
  const generatedAt = deriveContextTimestamp(
    findingContexts,
    patternContexts,
    postureContext
  );

  return {
    targetType: request.targetType,
    generatedAt,
    ...(analystQuestion ? { analystQuestion } : {}),
    sourceFindingIds: findingContexts.map((finding) => finding.id),
    sourcePatternIds: patternContexts.map((pattern) => pattern.id),
    verifiedFacts: {
      ...(subject ? { subject } : {}),
      findings: findingContexts,
      patterns: patternContexts,
      ...(postureContext ? { riskPosture: postureContext } : {}),
      topContributors,
    },
  };
}

function normalizeIds(ids: readonly string[] | undefined): readonly string[] {
  if (!ids) return [];
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

function normalizeAnalystQuestion(question: string | undefined): string | undefined {
  if (question === undefined) return undefined;
  const trimmed = question.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > INVESTIGATION_LIMITS.maxAnalystQuestionLength) {
    throw new InvestigationContextBuilderError(
      `Analyst question must be ${INVESTIGATION_LIMITS.maxAnalystQuestionLength} characters or fewer.`
    );
  }
  return trimmed;
}

async function loadAllFindings(
  organizationId: string,
  sources: InvestigationContextSources
): Promise<readonly SecurityFinding[]> {
  const firstPage = await sources.getAllFindings(organizationId, {
    page: 1,
    limit: 100,
  });
  const findings = [...firstPage.data];

  for (let page = 2; page <= firstPage.pagination.totalPages; page++) {
    const nextPage = await sources.getAllFindings(organizationId, {
      page,
      limit: 100,
    });
    findings.push(...nextPage.data);
  }

  return findings
    .filter((finding) => finding.organizationId === organizationId)
    .sort(compareSecurityFindings);
}

async function loadAllPatterns(
  organizationId: string,
  sources: InvestigationContextSources
): Promise<readonly SecurityPattern[]> {
  const firstPage = await sources.getCorrelatedPatterns(organizationId, {
    page: 1,
    limit: 100,
  });
  const patterns = [...firstPage.data];

  for (let page = 2; page <= firstPage.pagination.totalPages; page++) {
    const nextPage = await sources.getCorrelatedPatterns(organizationId, {
      page,
      limit: 100,
    });
    patterns.push(...nextPage.data);
  }

  return patterns
    .filter((pattern) => pattern.organizationId === organizationId)
    .sort(compareSecurityPatterns);
}

function selectByIds<T extends { readonly id: string }>(
  values: readonly T[],
  selectedIds: readonly string[],
  label: 'finding' | 'pattern'
): readonly T[] {
  const selectedIdSet = new Set(selectedIds);
  const selected = values.filter((value) => selectedIdSet.has(value.id));
  if (selected.length !== selectedIdSet.size) {
    throw new InvestigationContextBuilderError(
      `One or more requested ${label} ids were not found in the authoritative organization-scoped data.`,
      404
    );
  }
  return selected;
}

function enforceSelectedCountLimits(
  findings: readonly SecurityFinding[],
  patterns: readonly SecurityPattern[]
): void {
  if (findings.length > INVESTIGATION_LIMITS.maxFindingsPerInvestigation) {
    throw new InvestigationContextBuilderError(
      `Subject investigation matched more than ${INVESTIGATION_LIMITS.maxFindingsPerInvestigation} findings.`
    );
  }
  if (patterns.length > INVESTIGATION_LIMITS.maxPatternsPerInvestigation) {
    throw new InvestigationContextBuilderError(
      `Subject investigation matched more than ${INVESTIGATION_LIMITS.maxPatternsPerInvestigation} patterns.`
    );
  }
}

function toFindingContext(finding: SecurityFinding): InvestigationFindingContext {
  return {
    id: finding.id,
    subjectId: finding.subjectId,
    subjectType: finding.subjectType,
    code: finding.code,
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    riskContribution: finding.riskContribution,
    ...(finding.riskScore !== undefined ? { riskScore: finding.riskScore } : {}),
    detectedAt: finding.detectedAt,
    fingerprint: finding.fingerprint,
    ...(finding.provider ? { provider: finding.provider } : {}),
    ...(finding.resourceId ? { resourceId: finding.resourceId } : {}),
    sanitizedEvidence: allowlistEvidence(finding.evidence),
  };
}

function toPatternContext(pattern: SecurityPattern): InvestigationPatternContext {
  return {
    id: pattern.id,
    patternCode: pattern.patternCode,
    patternType: pattern.patternType,
    severity: pattern.severity,
    title: pattern.title,
    description: pattern.description,
    recommendation: pattern.recommendation,
    subjectId: pattern.subjectId,
    subjectType: pattern.subjectType,
    ...(pattern.subjectName ? { subjectName: pattern.subjectName } : {}),
    correlatedFindingIds: [...pattern.correlatedFindingIds].sort(),
    correlatedFindingCodes: [...pattern.correlatedFindingCodes].sort(),
    detectedAt: pattern.detectedAt,
    fingerprint: pattern.fingerprint,
    sanitizedEvidence: allowlistEvidence(pattern.evidence),
  };
}

function toRiskPostureContext(
  posture: OrganizationRiskPosture
): InvestigationRiskPostureContext {
  return {
    overallScore: posture.overallScore,
    severity: posture.severity,
    status: posture.status,
    assessedAt: posture.assessedAt,
    totalFindings: posture.totalFindings,
    severityCounts: posture.severityCounts,
    categoryBreakdown: posture.categoryBreakdown,
    subjectBreakdown: posture.subjectBreakdown,
  };
}

export function allowlistEvidence(
  evidence: Record<string, unknown>
): Readonly<Record<string, InvestigationEvidenceValue>> {
  const sanitized = sanitizeEvidence(evidence);
  const allowed: Record<string, InvestigationEvidenceValue> = {};

  for (const [key, value] of Object.entries(sanitized)) {
    if (!ALLOWED_EVIDENCE_KEYS.has(key)) continue;
    const safeValue = toSafeEvidenceValue(value);
    if (safeValue === undefined) continue;
    allowed[key] = safeValue;
  }

  return allowed;
}

function toSafeEvidenceValue(value: unknown): InvestigationEvidenceValue | undefined {
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    return isSecretLike(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === 'string' && !isSecretLike(item))) {
      return value;
    }
    if (value.every((item) => typeof item === 'number')) {
      return value;
    }
    if (value.every((item) => typeof item === 'boolean')) {
      return value;
    }
  }
  return undefined;
}

function isSecretLike(value: string): boolean {
  return value === '[REDACTED]' || SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function buildSubjectSummary(
  request: InvestigationRequest,
  findings: readonly InvestigationFindingContext[],
  patterns: readonly InvestigationPatternContext[]
): InvestigationSubjectSummary | undefined {
  if (request.targetType === 'subject') {
    if (!request.subjectType || !request.subjectId) return undefined;
    const matchingFinding = findings[0];
    const matchingPattern = patterns[0];
    return {
      subjectId: request.subjectId.trim(),
      subjectType: request.subjectType,
      ...(matchingPattern?.subjectName ? { subjectName: matchingPattern.subjectName } : {}),
      ...(matchingFinding?.provider ? { provider: matchingFinding.provider } : {}),
      ...(matchingFinding?.riskScore !== undefined
        ? { riskScore: matchingFinding.riskScore }
        : {}),
    };
  }

  const firstPattern = patterns[0];
  if (firstPattern) {
    return {
      subjectId: firstPattern.subjectId,
      subjectType: firstPattern.subjectType,
      ...(firstPattern.subjectName ? { subjectName: firstPattern.subjectName } : {}),
    };
  }

  const firstFinding = findings[0];
  if (!firstFinding) return undefined;
  return {
    subjectId: firstFinding.subjectId,
    subjectType: firstFinding.subjectType,
    ...(firstFinding.provider ? { provider: firstFinding.provider } : {}),
    ...(firstFinding.riskScore !== undefined ? { riskScore: firstFinding.riskScore } : {}),
  };
}

function deriveContextTimestamp(
  findings: readonly InvestigationFindingContext[],
  patterns: readonly InvestigationPatternContext[],
  posture: InvestigationRiskPostureContext | undefined
): string {
  const timestamps = [
    ...findings.map((finding) => finding.detectedAt),
    ...patterns.map((pattern) => pattern.detectedAt),
    ...(posture ? [posture.assessedAt] : []),
  ].filter(Boolean);

  return timestamps.sort().at(-1) || '1970-01-01T00:00:00.000Z';
}

function compareSecurityFindings(a: SecurityFinding, b: SecurityFinding): number {
  return (
    b.severity.localeCompare(a.severity) ||
    b.riskContribution - a.riskContribution ||
    a.code.localeCompare(b.code) ||
    a.id.localeCompare(b.id)
  );
}

function compareSecurityPatterns(a: SecurityPattern, b: SecurityPattern): number {
  return (
    b.severity.localeCompare(a.severity) ||
    a.patternCode.localeCompare(b.patternCode) ||
    a.subjectId.localeCompare(b.subjectId) ||
    a.id.localeCompare(b.id)
  );
}

function compareFindingContexts(
  a: InvestigationFindingContext,
  b: InvestigationFindingContext
): number {
  return (
    b.severity.localeCompare(a.severity) ||
    b.riskContribution - a.riskContribution ||
    a.code.localeCompare(b.code) ||
    a.id.localeCompare(b.id)
  );
}

function comparePatternContexts(
  a: InvestigationPatternContext,
  b: InvestigationPatternContext
): number {
  return (
    b.severity.localeCompare(a.severity) ||
    a.patternCode.localeCompare(b.patternCode) ||
    a.subjectId.localeCompare(b.subjectId) ||
    a.id.localeCompare(b.id)
  );
}

function compareTopContributors(a: RiskTopContributorLike, b: RiskTopContributorLike): number {
  return (
    b.severity.localeCompare(a.severity) ||
    b.riskContribution - a.riskContribution ||
    a.code.localeCompare(b.code) ||
    a.findingId.localeCompare(b.findingId)
  );
}

interface RiskTopContributorLike {
  readonly findingId: string;
  readonly code: string;
  readonly severity: string;
  readonly riskContribution: number;
}

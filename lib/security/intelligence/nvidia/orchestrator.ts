import type {
  SecurityFinding,
  SecurityPattern,
  OrganizationRiskPosture,
} from '../types';
import {
  NVIDIA_INTELLIGENCE_LIMITS,
  type NvidiaAdvisoryResponse,
  type NvidiaIntelligenceRequest,
  type NvidiaRiskSummary,
  type NvidiaSanitizedFinding,
  type NvidiaSanitizedPattern,
  NvidiaProviderConfigError,
  NvidiaProviderTimeoutError,
  NvidiaProviderUnavailableError,
  NvidiaProviderValidationError,
} from './types';
import {
  NvidiaSecurityIntelligenceProvider,
} from './provider';
import { getNvidiaProvider } from './factory';
import { findingService } from '../findingService';
import { riskIntelligenceService } from '../riskIntelligenceService';
import { correlationService } from '../correlationService';
import { sanitizeEvidence } from '../evidence';

// ============================================================================
// TYPES & CONTRACTS
// ============================================================================

export type NvidiaOrchestrationTargetType =
  | 'subject'
  | 'finding'
  | 'pattern'
  | 'posture';

export type NvidiaOrchestrationSubjectType =
  | 'identity'
  | 'ai_agent'
  | 'resource';

export interface NvidiaOrchestrationRequest {
  readonly targetType: NvidiaOrchestrationTargetType;
  readonly subjectType?: NvidiaOrchestrationSubjectType;
  readonly subjectId?: string;
  readonly findingIds?: readonly string[];
  readonly patternIds?: readonly string[];
  readonly analystQuestion?: string;
}

export type NvidiaSafeErrorCategory =
  | 'provider_unavailable'
  | 'timeout'
  | 'validation_failed'
  | 'configuration_unavailable'
  | 'provider_error';

export interface NvidiaAdvisoryBlock {
  readonly available: boolean;
  readonly advisory: NvidiaAdvisoryResponse | null;
  readonly error?: NvidiaSafeErrorCategory;
}

export interface NvidiaDeterministicIntelligence {
  readonly findings: readonly SecurityFinding[];
  readonly riskPosture: OrganizationRiskPosture;
  readonly patterns: readonly SecurityPattern[];
}

export interface NvidiaOrchestrationResult {
  readonly deterministic: NvidiaDeterministicIntelligence;
  readonly nvidia: NvidiaAdvisoryBlock;
  readonly generatedAt: string;
}

export interface SecurityIntelligenceSources {
  readonly getAllFindings: (
    organizationId: string
  ) => Promise<{ data: SecurityFinding[] }>;
  readonly getOrganizationRiskPosture: (
    organizationId: string
  ) => Promise<OrganizationRiskPosture>;
  readonly getCorrelatedPatterns: (
    organizationId: string
  ) => Promise<{ data: SecurityPattern[] }>;
}

export interface OrchestrationDependencies {
  readonly sources?: SecurityIntelligenceSources;
  readonly provider?: NvidiaSecurityIntelligenceProvider;
}

export class NvidiaOrchestrationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = 'ORCHESTRATION_ERROR') {
    super(message);
    this.name = 'NvidiaOrchestrationError';
    this.status = status;
    this.code = code;
  }
}

// ============================================================================
// DEFAULT SOURCES
// ============================================================================

const defaultSources: SecurityIntelligenceSources = {
  getAllFindings: async (orgId: string) => {
    return await findingService.getAllFindings(orgId);
  },
  getOrganizationRiskPosture: async (orgId: string) => {
    return await riskIntelligenceService.getOrganizationRiskPosture(orgId);
  },
  getCorrelatedPatterns: async (orgId: string) => {
    return await correlationService.getCorrelatedPatterns(orgId);
  },
};

// ============================================================================
// SANITIZATION & ALLOWLISTING HELPERS
// ============================================================================

const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function normalizeAnalystQuestion(rawQuestion?: string): string | undefined {
  if (!rawQuestion) return undefined;
  if (typeof rawQuestion !== 'string') {
    throw new NvidiaOrchestrationError(
      'Analyst question must be a string.',
      400,
      'INVALID_ANALYST_QUESTION'
    );
  }

  const trimmed = rawQuestion.trim();
  if (trimmed.length === 0) return undefined;

  if (trimmed.length > NVIDIA_INTELLIGENCE_LIMITS.MAX_QUERY_LENGTH) {
    throw new NvidiaOrchestrationError(
      `Analyst question exceeds maximum length of ${NVIDIA_INTELLIGENCE_LIMITS.MAX_QUERY_LENGTH} characters.`,
      400,
      'BOUNDS_VIOLATION'
    );
  }

  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    throw new NvidiaOrchestrationError(
      'Analyst question contains prohibited control characters.',
      400,
      'INVALID_ANALYST_QUESTION'
    );
  }

  return trimmed;
}

export function mapToSafeErrorCategory(err: unknown): NvidiaSafeErrorCategory {
  if (err instanceof NvidiaProviderUnavailableError) {
    return 'provider_unavailable';
  }
  if (err instanceof NvidiaProviderTimeoutError) {
    return 'timeout';
  }
  if (err instanceof NvidiaProviderValidationError) {
    return 'validation_failed';
  }
  if (err instanceof NvidiaProviderConfigError) {
    return 'configuration_unavailable';
  }
  return 'provider_error';
}

function toSanitizedFinding(finding: SecurityFinding): NvidiaSanitizedFinding {
  return {
    id: finding.id,
    code: finding.code,
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    subjectId: finding.subjectId,
    subjectType: finding.subjectType,
    detectedAt: finding.detectedAt,
    sanitizedEvidence: sanitizeEvidence(finding.evidence),
  };
}

function toSanitizedPattern(pattern: SecurityPattern): NvidiaSanitizedPattern {
  return {
    id: pattern.id,
    patternCode: pattern.patternCode,
    patternType: pattern.patternType,
    severity: pattern.severity,
    title: pattern.title,
    description: pattern.description,
    recommendation: pattern.recommendation,
    subjectId: pattern.subjectId,
    correlatedFindingIds: Object.freeze([...pattern.correlatedFindingIds]),
    sanitizedEvidence: sanitizeEvidence(pattern.evidence),
  };
}

function toRiskSummary(
  posture: OrganizationRiskPosture,
  totalFindings: number
): NvidiaRiskSummary {
  return {
    overallScore: posture.overallScore,
    severity: posture.severity,
    status: posture.status,
    totalFindings,
  };
}

// ============================================================================
// ORCHESTRATION SERVICE IMPLEMENTATION
// ============================================================================

export async function orchestrateSecurityIntelligence(
  organizationId: string,
  request: NvidiaOrchestrationRequest,
  deps?: OrchestrationDependencies
): Promise<NvidiaOrchestrationResult> {
  const normalizedOrgId = organizationId?.trim();
  if (!normalizedOrgId) {
    throw new NvidiaOrchestrationError(
      'Organization identifier is required.',
      403,
      'FORBIDDEN'
    );
  }

  const sources = deps?.sources || defaultSources;
  const validatedQuestion = normalizeAnalystQuestion(request.analystQuestion);

  // 1. Retrieve Authoritative Deterministic Security Intelligence
  const [allFindingsResponse, posture, allPatternsResponse] = await Promise.all([
    sources.getAllFindings(normalizedOrgId),
    sources.getOrganizationRiskPosture(normalizedOrgId),
    sources.getCorrelatedPatterns(normalizedOrgId),
  ]);

  const allFindings = allFindingsResponse.data || [];
  const allPatterns = allPatternsResponse.data || [];

  let selectedFindings: SecurityFinding[] = [];
  let selectedPatterns: SecurityPattern[] = [];

  switch (request.targetType) {
    case 'finding': {
      const requestedIds = new Set(request.findingIds || []);
      if (requestedIds.size === 0) {
        throw new NvidiaOrchestrationError(
          'At least one findingId is required for finding target.',
          400,
          'INVALID_TARGET'
        );
      }
      if (requestedIds.size > NVIDIA_INTELLIGENCE_LIMITS.MAX_FINDINGS) {
        throw new NvidiaOrchestrationError(
          `At most ${NVIDIA_INTELLIGENCE_LIMITS.MAX_FINDINGS} finding IDs can be requested at once.`,
          400,
          'BOUNDS_VIOLATION'
        );
      }

      selectedFindings = allFindings.filter((f) => requestedIds.has(f.id));
      if (selectedFindings.length === 0) {
        throw new NvidiaOrchestrationError(
          'Requested finding target was not found in the organization.',
          404,
          'TARGET_NOT_FOUND'
        );
      }

      // Include patterns correlated with the selected findings
      const selectedFindingIdSet = new Set(selectedFindings.map((f) => f.id));
      selectedPatterns = allPatterns.filter((p) =>
        p.correlatedFindingIds.some((id) => selectedFindingIdSet.has(id))
      );
      break;
    }

    case 'pattern': {
      const requestedIds = new Set(request.patternIds || []);
      if (requestedIds.size === 0) {
        throw new NvidiaOrchestrationError(
          'At least one patternId is required for pattern target.',
          400,
          'INVALID_TARGET'
        );
      }
      if (requestedIds.size > NVIDIA_INTELLIGENCE_LIMITS.MAX_PATTERNS) {
        throw new NvidiaOrchestrationError(
          `At most ${NVIDIA_INTELLIGENCE_LIMITS.MAX_PATTERNS} pattern IDs can be requested at once.`,
          400,
          'BOUNDS_VIOLATION'
        );
      }

      selectedPatterns = allPatterns.filter((p) => requestedIds.has(p.id));
      if (selectedPatterns.length === 0) {
        throw new NvidiaOrchestrationError(
          'Requested pattern target was not found in the organization.',
          404,
          'TARGET_NOT_FOUND'
        );
      }

      // Include findings that form these patterns
      const correlatedFindingIds = new Set(
        selectedPatterns.flatMap((p) => p.correlatedFindingIds)
      );
      selectedFindings = allFindings.filter((f) => correlatedFindingIds.has(f.id));
      break;
    }

    case 'subject': {
      if (!request.subjectId || request.subjectId.trim().length === 0) {
        throw new NvidiaOrchestrationError(
          'subjectId is required for subject target.',
          400,
          'INVALID_TARGET'
        );
      }
      const targetSubjectId = request.subjectId.trim();

      selectedFindings = allFindings.filter((f) => {
        if (f.subjectId !== targetSubjectId) return false;
        if (request.subjectType && f.subjectType !== request.subjectType) return false;
        return true;
      });

      selectedPatterns = allPatterns.filter((p) => {
        if (p.subjectId !== targetSubjectId) return false;
        if (request.subjectType && p.subjectType !== request.subjectType) return false;
        return true;
      });

      if (selectedFindings.length === 0 && selectedPatterns.length === 0) {
        throw new NvidiaOrchestrationError(
          'Requested subject target was not found in the organization.',
          404,
          'TARGET_NOT_FOUND'
        );
      }
      break;
    }

    case 'posture':
    default: {
      // For overall posture target, take top findings and patterns up to limits
      selectedFindings = [...allFindings].slice(0, NVIDIA_INTELLIGENCE_LIMITS.MAX_FINDINGS);
      selectedPatterns = [...allPatterns].slice(0, NVIDIA_INTELLIGENCE_LIMITS.MAX_PATTERNS);
      break;
    }
  }

  // Bound selected sets to limits
  const boundedFindings = selectedFindings.slice(
    0,
    NVIDIA_INTELLIGENCE_LIMITS.MAX_FINDINGS
  );
  const boundedPatterns = selectedPatterns.slice(
    0,
    NVIDIA_INTELLIGENCE_LIMITS.MAX_PATTERNS
  );

  // 2. Lock & Freeze Deterministic Intelligence Object
  // Architectural Guarantee: Deterministic data is immutable and never assigned from NVIDIA output
  const deterministicIntelligence: NvidiaDeterministicIntelligence = Object.freeze({
    findings: Object.freeze([...boundedFindings]),
    riskPosture: Object.freeze({ ...posture }),
    patterns: Object.freeze([...boundedPatterns]),
  });

  // Snapshot for immutability verification
  const deterministicSnapshot = JSON.stringify(deterministicIntelligence);

  // 3. Construct Separate Sanitized Allowlisted Context for NVIDIA
  // NEVER send raw database rows, credentials, tokens, or organization IDs to the model
  const sanitizedFindings: NvidiaSanitizedFinding[] = boundedFindings.map(toSanitizedFinding);
  const sanitizedPatterns: NvidiaSanitizedPattern[] = boundedPatterns.map(toSanitizedPattern);
  const riskPostureSummary = toRiskSummary(posture, allFindings.length);

  const nvidiaRequest: NvidiaIntelligenceRequest = {
    organizationId: normalizedOrgId,
    sanitizedFindings: Object.freeze(sanitizedFindings),
    sanitizedPatterns: Object.freeze(sanitizedPatterns),
    riskPostureSummary: Object.freeze(riskPostureSummary),
    analystQuery: validatedQuestion,
  };

  // 4. Resolve NVIDIA Provider
  const provider = deps?.provider || getNvidiaProvider();
  let advisoryResponse: NvidiaAdvisoryResponse | null = null;
  let safeError: NvidiaSafeErrorCategory | undefined;
  let isAvailable = false;

  try {
    isAvailable = provider.isAvailable();
    if (isAvailable) {
      advisoryResponse = await provider.generateAdvisory(nvidiaRequest);
    } else {
      safeError = 'provider_unavailable';
    }
  } catch (err: unknown) {
    // Invariant: NVIDIA failures must NEVER break deterministic security intelligence
    isAvailable = false;
    advisoryResponse = null;
    safeError = mapToSafeErrorCategory(err);
  }

  // 5. Verify Immutability
  // Architectural check: Assert deterministic intelligence was not modified in any way
  if (JSON.stringify(deterministicIntelligence) !== deterministicSnapshot) {
    throw new Error('FATAL: Deterministic intelligence was modified during orchestration.');
  }

  // 6. Return Authoritative Deterministic Intelligence + Optional Advisory Block
  return {
    deterministic: deterministicIntelligence,
    nvidia: {
      available: isAvailable && advisoryResponse !== null,
      advisory: advisoryResponse,
      error: safeError,
    },
    generatedAt: new Date().toISOString(),
  };
}

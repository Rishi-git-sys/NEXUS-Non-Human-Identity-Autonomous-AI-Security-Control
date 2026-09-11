import type {
  SecurityFindingCategory,
  SecurityFindingSeverity,
  SecurityPatternSeverity,
} from '../types';

// ============================================================================
// BOUNDS & LIMITS
// ============================================================================

export const NVIDIA_INTELLIGENCE_LIMITS = {
  MAX_FINDINGS: 15,
  MAX_PATTERNS: 10,
  MAX_QUERY_LENGTH: 1000,
  MAX_RATIONALE_LENGTH: 2000,
  MAX_INSIGHTS: 10,
  MIN_CONFIDENCE: 0.0,
  MAX_CONFIDENCE: 1.0,
} as const;

// ============================================================================
// SANITIZED CONTEXT INPUTS
// ============================================================================

export interface NvidiaSanitizedFinding {
  readonly id: string;
  readonly code: string;
  readonly category: SecurityFindingCategory;
  readonly severity: SecurityFindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly subjectId: string;
  readonly subjectType: string;
  readonly detectedAt: string;
  readonly sanitizedEvidence?: Record<string, unknown>;
}

export interface NvidiaSanitizedPattern {
  readonly id: string;
  readonly patternCode: string;
  readonly patternType: string;
  readonly severity: SecurityPatternSeverity;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly subjectId: string;
  readonly correlatedFindingIds: readonly string[];
  readonly sanitizedEvidence?: Record<string, unknown>;
}

export interface NvidiaRiskSummary {
  readonly overallScore: number;
  readonly severity: SecurityFindingSeverity;
  readonly status: string;
  readonly totalFindings: number;
}

export interface NvidiaIntelligenceRequest {
  readonly organizationId: string;
  readonly sanitizedFindings: readonly NvidiaSanitizedFinding[];
  readonly sanitizedPatterns?: readonly NvidiaSanitizedPattern[];
  readonly riskPostureSummary?: NvidiaRiskSummary;
  readonly analystQuery?: string;
}

// ============================================================================
// ADVISORY OUTPUT CONTRACTS
// ============================================================================

export type NvidiaAdvisoryInsightCategory =
  | 'ATTACK_SURFACE'
  | 'SUSPICIOUS_SIGNAL'
  | 'CORRELATION_OBSERVATION'
  | 'ADVISORY_RECOMMENDATION';

export type NvidiaAdvisorySeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export interface NvidiaAdvisoryInsight {
  readonly category: NvidiaAdvisoryInsightCategory;
  readonly title: string;
  readonly description: string;
  readonly severity: NvidiaAdvisorySeverity;
  readonly relatedFindingIds: readonly string[];
  readonly relatedPatternIds?: readonly string[];
}

/**
 * Structured Advisory Response returned by NVIDIA Intelligence.
 * Note: isAdvisory is strictly true. This output is NEVER authoritative and
 * cannot override deterministic NEXUS findings, patterns, or risk scores.
 */
export interface NvidiaAdvisoryResponse {
  readonly isAdvisory: true;
  readonly insights: readonly NvidiaAdvisoryInsight[];
  readonly confidence: number;
  readonly rationale: string;
  readonly sourceFindingIds: readonly string[];
  readonly sourcePatternIds: readonly string[];
  readonly model: string;
  readonly generatedAt: string;
}

// ============================================================================
// PROVIDER CONFIGURATION & CAPABILITIES
// ============================================================================

export interface NvidiaProviderCapabilities {
  readonly supportedModels: readonly string[];
  readonly maxInputFindings: number;
  readonly maxInputPatterns: number;
  readonly supportsAdvisoryInsights: boolean;
}

/**
 * Configuration for NVIDIA NIM Security Intelligence Provider.
 *
 * Model Independence:
 * The configured model is typed as a string and passed directly to the inference
 * API without hard-coded lists, validation, or model-specific branching.
 * Example models supported via NVIDIA NIM include:
 * - "meta/llama-3.3-70b-instruct" (default)
 * - "nvidia/llama-3.1-nemotron-70b-instruct" (Nemotron)
 * - "nvidia/nemotron-4-340b-instruct" (Nemotron)
 */
export interface NvidiaProviderConfig {
  readonly enabled: boolean;
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
}

export interface SafeNvidiaLogPayload {
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly success: boolean;
  readonly category?: string;
}

// ============================================================================
// TYPED ERRORS
// ============================================================================

export class NvidiaProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NvidiaProviderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NvidiaProviderConfigError extends NvidiaProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'NvidiaProviderConfigError';
  }
}

export class NvidiaProviderTimeoutError extends NvidiaProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'NvidiaProviderTimeoutError';
  }
}

export class NvidiaProviderRequestError extends NvidiaProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'NvidiaProviderRequestError';
  }
}

export class NvidiaProviderValidationError extends NvidiaProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'NvidiaProviderValidationError';
  }
}

export class NvidiaProviderUnavailableError extends NvidiaProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'NvidiaProviderUnavailableError';
  }
}

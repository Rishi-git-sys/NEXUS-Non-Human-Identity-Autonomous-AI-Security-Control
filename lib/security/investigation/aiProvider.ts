import type {
  InvestigationContext,
  InvestigationOutput,
  InvestigationProvider,
  InvestigationProviderRequest,
  InvestigationResult,
} from './types';
import { INVESTIGATION_LIMITS } from './types';
import { createOpenAIInvestigationProvider } from './providers/openaiProvider';

// Re-export core types
export type {
  InvestigationContext,
  InvestigationOutput,
  InvestigationProvider,
  InvestigationProviderRequest,
  InvestigationResult,
};

// ============================================================================
// TYPED ERRORS
// ============================================================================

export class InvestigationProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvestigationProviderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvestigationProviderConfigError extends InvestigationProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'InvestigationProviderConfigError';
  }
}

export class InvestigationProviderTimeoutError extends InvestigationProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'InvestigationProviderTimeoutError';
  }
}

export class InvestigationProviderRequestError extends InvestigationProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'InvestigationProviderRequestError';
  }
}

export class InvestigationProviderValidationError extends InvestigationProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'InvestigationProviderValidationError';
  }
}

// ============================================================================
// SAFE OPERATIONAL LOGGING
// ============================================================================

export interface SafeLogPayload {
  readonly provider: string;
  readonly model: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly errorType?: string;
  readonly correlationId?: string;
}

/**
 * Logs provider execution metrics safely.
 * NEVER logs prompts, InvestigationContext, analystQuestion, model output, or credentials.
 */
export function logSafeProviderMetrics(metrics: SafeLogPayload): void {
  const logMessage = JSON.stringify({
    level: metrics.success ? 'INFO' : 'WARN',
    type: 'AI_INVESTIGATION_PROVIDER_AUDIT',
    provider: metrics.provider,
    model: metrics.model,
    durationMs: metrics.durationMs,
    success: metrics.success,
    errorType: metrics.errorType,
    correlationId: metrics.correlationId,
  });

  if (process.env.NODE_ENV !== 'test') {
    // Structured stdout logging adhering to auditability
    console.log(logMessage);
  }
}

// ============================================================================
// SECRET DETECTION PATTERNS
// ============================================================================

const PROHIBITED_SECRET_PATTERNS: readonly RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bASIA[0-9A-Z]{16}\b/,
  /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/i,
  /bearer\s+[a-zA-Z0-9_.-]{20,}/i,
  /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
  /\bsbp_[a-zA-Z0-9_-]{20,}\b/i,
  /\b(sk-[a-zA-Z0-9_-]{20,})\b/i,
  /\bpassword\s*[:=]\s*[^\s]+/i,
  /\bauthorization\s*[:=]\s*[^\s]+/i,
  /\bclient_secret\s*[:=]\s*[^\s]+/i,
  /\baws_secret_access_key\s*[:=]\s*[^\s]+/i,
  /\bsupabase(?:[._-])?(?:service|anon|publishable)?(?:[._-])?key/i,
];

function containsSecret(text: string): boolean {
  for (const pattern of PROHIBITED_SECRET_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// STRUCTURED OUTPUT VALIDATION
// ============================================================================

const MAX_SUMMARY_LENGTH = 2_000;
const MAX_IMPACT_LENGTH = 2_000;
const MAX_PRIORITY_RATIONALE_LENGTH = 2_000;
const MAX_ITEM_STRING_LENGTH = 500;

export interface ValidationOptions {
  readonly serverTimestamp?: string;
}

/**
 * Validates untrusted AI model output against the Step 1 InvestigationResult contract.
 * Enforces string lengths, array bounds, source ID subset constraints, factual consistency,
 * secret absence, and application-controlled metadata ownership.
 */
export function validateInvestigationOutput(
  rawOutput: unknown,
  context: InvestigationContext,
  expectedModel: string,
  options?: ValidationOptions
): InvestigationResult {
  if (!rawOutput || typeof rawOutput !== 'object') {
    throw new InvestigationProviderValidationError('AI provider output must be a non-null object.');
  }

  const record = rawOutput as Record<string, unknown>;

  // 1. Required string fields
  const summary = record.summary;
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    throw new InvestigationProviderValidationError('Missing or invalid "summary" field in AI output.');
  }
  if (summary.length > MAX_SUMMARY_LENGTH) {
    throw new InvestigationProviderValidationError(`"summary" exceeds maximum allowed length (${MAX_SUMMARY_LENGTH}).`);
  }

  const impact = record.impact;
  if (typeof impact !== 'string' || impact.trim().length === 0) {
    throw new InvestigationProviderValidationError('Missing or invalid "impact" field in AI output.');
  }
  if (impact.length > MAX_IMPACT_LENGTH) {
    throw new InvestigationProviderValidationError(`"impact" exceeds maximum allowed length (${MAX_IMPACT_LENGTH}).`);
  }

  const priorityRationale = record.priorityRationale;
  if (typeof priorityRationale !== 'string' || priorityRationale.trim().length === 0) {
    throw new InvestigationProviderValidationError('Missing or invalid "priorityRationale" field in AI output.');
  }
  if (priorityRationale.length > MAX_PRIORITY_RATIONALE_LENGTH) {
    throw new InvestigationProviderValidationError(`"priorityRationale" exceeds maximum allowed length (${MAX_PRIORITY_RATIONALE_LENGTH}).`);
  }

  // 2. String array fields with bounds
  const validateStringArray = (
    field: string,
    value: unknown,
    maxItems: number
  ): readonly string[] => {
    if (!Array.isArray(value)) {
      throw new InvestigationProviderValidationError(`Field "${field}" must be an array of strings.`);
    }
    if (value.length > maxItems) {
      throw new InvestigationProviderValidationError(`Field "${field}" contains ${value.length} items, exceeding max limit of ${maxItems}.`);
    }
    const sanitizedItems: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        throw new InvestigationProviderValidationError(`Item in "${field}" must be a non-empty string.`);
      }
      if (item.length > MAX_ITEM_STRING_LENGTH) {
        throw new InvestigationProviderValidationError(`Item in "${field}" exceeds maximum length of ${MAX_ITEM_STRING_LENGTH}.`);
      }
      sanitizedItems.push(item.trim());
    }
    return Object.freeze(sanitizedItems);
  };

  const verifiedFacts = validateStringArray('verifiedFacts', record.verifiedFacts, INVESTIGATION_LIMITS.maxVerifiedFactItems);
  const recommendedActions = validateStringArray('recommendedActions', record.recommendedActions, INVESTIGATION_LIMITS.maxRecommendedActions);
  const evidenceGaps = validateStringArray('evidenceGaps', record.evidenceGaps, INVESTIGATION_LIMITS.maxEvidenceGaps);
  const uncertainty = validateStringArray('uncertainty', record.uncertainty, INVESTIGATION_LIMITS.maxUncertaintyItems);

  // 3. Factual Consistency Check: Finding codes and Pattern codes mentioned in verifiedFacts must exist in context
  const suppliedFindingCodes = new Set(
    context.verifiedFacts?.findings?.map((f) => f.code) || []
  );
  const suppliedPatternCodes = new Set(
    context.verifiedFacts?.patterns?.map((p) => p.patternCode) || []
  );

  const patternCodeRegex = /\bPATTERN_[A-Z0-9_]+\b/g;
  const findingCodeRegex = /\b(IAM|AGENT|RESOURCE|SECURITY|FINDING)_[A-Z0-9_]+\b/g;

  for (const fact of verifiedFacts) {
    // Check pattern code claims
    const patternMatches = fact.match(patternCodeRegex);
    if (patternMatches) {
      for (const patternCode of patternMatches) {
        if (!suppliedPatternCodes.has(patternCode)) {
          throw new InvestigationProviderValidationError(
            `Verified fact references unsupported pattern code "${patternCode}". Only pattern codes present in supplied context may be asserted as facts.`
          );
        }
      }
    }

    // Check finding code claims
    const findingMatches = fact.match(findingCodeRegex);
    if (findingMatches) {
      for (const findingCode of findingMatches) {
        if (!suppliedFindingCodes.has(findingCode)) {
          throw new InvestigationProviderValidationError(
            `Verified fact references unsupported finding code "${findingCode}". Only finding codes present in supplied context may be asserted as facts.`
          );
        }
      }
    }
  }

  // 4. Source Traceability: Must be exact subsets of context source IDs
  if (!Array.isArray(record.sourceFindingIds)) {
    throw new InvestigationProviderValidationError('Field "sourceFindingIds" must be an array.');
  }
  const allowedFindingIdSet = new Set(context.sourceFindingIds || []);
  const sourceFindingIds: string[] = [];
  for (const id of record.sourceFindingIds) {
    if (typeof id !== 'string') {
      throw new InvestigationProviderValidationError('All items in "sourceFindingIds" must be strings.');
    }
    if (!allowedFindingIdSet.has(id)) {
      throw new InvestigationProviderValidationError(`Unknown sourceFindingId "${id}" in model output not present in context.`);
    }
    if (!sourceFindingIds.includes(id)) {
      sourceFindingIds.push(id);
    }
  }

  if (!Array.isArray(record.sourcePatternIds)) {
    throw new InvestigationProviderValidationError('Field "sourcePatternIds" must be an array.');
  }
  const allowedPatternIdSet = new Set(context.sourcePatternIds || []);
  const sourcePatternIds: string[] = [];
  for (const id of record.sourcePatternIds) {
    if (typeof id !== 'string') {
      throw new InvestigationProviderValidationError('All items in "sourcePatternIds" must be strings.');
    }
    if (!allowedPatternIdSet.has(id)) {
      throw new InvestigationProviderValidationError(`Unknown sourcePatternId "${id}" in model output not present in context.`);
    }
    if (!sourcePatternIds.includes(id)) {
      sourcePatternIds.push(id);
    }
  }

  // 5. Secret safety: Scan all text fields
  const allTextsToCheck = [
    summary,
    impact,
    priorityRationale,
    ...verifiedFacts,
    ...recommendedActions,
    ...evidenceGaps,
    ...uncertainty,
  ];

  for (const text of allTextsToCheck) {
    if (containsSecret(text)) {
      throw new InvestigationProviderValidationError('Model output rejected: prohibited credential or secret-like material detected.');
    }
  }

  // 6. Application-Controlled Metadata: Never trust model to identify model or generated timestamp
  const finalGeneratedAt = options?.serverTimestamp || new Date().toISOString();

  return {
    summary: summary.trim(),
    verifiedFacts,
    impact: impact.trim(),
    priorityRationale: priorityRationale.trim(),
    recommendedActions,
    evidenceGaps,
    uncertainty,
    sourceFindingIds: Object.freeze(sourceFindingIds),
    sourcePatternIds: Object.freeze(sourcePatternIds),
    model: expectedModel,
    generatedAt: finalGeneratedAt,
  };
}

// ============================================================================
// FACTORY & CONFIGURATION
// ============================================================================

export interface InvestigationProviderConfig {
  readonly provider?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly apiKey?: string;
}

export function getInvestigationProvider(config?: InvestigationProviderConfig): InvestigationProvider {
  const providerName = (config?.provider || process.env.NEXUS_AI_PROVIDER || 'openai').toLowerCase().trim();

  if (providerName === 'openai') {
    return createOpenAIInvestigationProvider(config);
  }

  throw new InvestigationProviderConfigError(`Unsupported AI provider: "${providerName}". Supported providers: openai.`);
}

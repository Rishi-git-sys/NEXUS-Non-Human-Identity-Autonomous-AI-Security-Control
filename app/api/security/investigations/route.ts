import { NextRequest, NextResponse } from 'next/server';
import { requireRole, AuthContextResult } from '@/lib/auth/authorization';
import { enforceRateLimit, RateLimitCategory, RateLimitResult } from '@/lib/security/rateLimit';
import {
  buildInvestigationContext,
  InvestigationContextBuilderError,
  InvestigationContextSources,
} from '@/lib/security/investigation/contextBuilder';
import {
  getInvestigationProvider,
  InvestigationProvider,
  InvestigationProviderConfig,
  InvestigationProviderError,
} from '@/lib/security/investigation/aiProvider';
import {
  INVESTIGATION_LIMITS,
  InvestigationRequest,
  InvestigationResult,
  InvestigationSubjectType,
  InvestigationTargetType,
} from '@/lib/security/investigation/types';

// ============================================================================
// CONSTANTS & ALLOWED SCHEMAS
// ============================================================================

const VALID_TARGET_TYPES = new Set<InvestigationTargetType>([
  'finding',
  'pattern',
  'subject',
  'posture',
]);

const VALID_SUBJECT_TYPES = new Set<InvestigationSubjectType>([
  'identity',
  'ai_agent',
  'resource',
]);

/**
 * Prohibited client-provided fields that must never be accepted from request body.
 * Prevents client injection of security facts, cross-tenant organization IDs,
 * raw telemetry, credentials, or provider configuration.
 */
const PROHIBITED_CLIENT_FIELDS = [
  'organizationId',
  'organization_id',
  'findings',
  'rawFindings',
  'patterns',
  'rawPatterns',
  'evidence',
  'rawEvidence',
  'riskScore',
  'risk_score',
  'riskScores',
  'riskPosture',
  'verifiedFacts',
  'authoritativeFacts',
  'provider',
  'model',
  'generatedAt',
  'generated_at',
] as const;

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

export interface InvestigationApiErrorPayload {
  readonly code: string;
  readonly message: string;
}

export interface InvestigationApiResponse<T = InvestigationResult> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: InvestigationApiErrorPayload;
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  headers?: Record<string, string>
): NextResponse<InvestigationApiResponse> {
  return NextResponse.json<InvestigationApiResponse>(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status, headers }
  );
}

function successResponse(
  data: InvestigationResult,
  status = 200
): NextResponse<InvestigationApiResponse> {
  return NextResponse.json<InvestigationApiResponse>(
    {
      success: true,
      data,
    },
    { status }
  );
}

// ============================================================================
// SAFE OPERATIONAL LOGGING
// ============================================================================

interface SafeOperationalLogPayload {
  readonly type: 'INVESTIGATION_API_REQUEST';
  readonly targetType?: string;
  readonly organizationId?: string;
  readonly durationMs: number;
  readonly statusCode: number;
  readonly success: boolean;
  readonly category?: string;
}

function logSafeApiMetrics(payload: SafeOperationalLogPayload): void {
  if (process.env.NODE_ENV !== 'test') {
    // Only safe operational metadata: never logs prompts, analystQuestion, context, or secrets
    console.log(JSON.stringify(payload));
  }
}

// ============================================================================
// MANUAL REQUEST VALIDATION
// ============================================================================

export interface ValidationSuccess {
  readonly valid: true;
  readonly request: InvestigationRequest;
}

export interface ValidationFailure {
  readonly valid: false;
  readonly code: string;
  readonly message: string;
}

export type ValidationOutcome = ValidationSuccess | ValidationFailure;

export function validateInvestigationRequestBody(body: unknown): ValidationOutcome {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      code: 'INVALID_REQUEST',
      message: 'Request body must be a valid JSON object.',
    };
  }

  const record = body as Record<string, unknown>;

  // Check prohibited client fields
  for (const field of PROHIBITED_CLIENT_FIELDS) {
    if (field in record && record[field] !== undefined) {
      return {
        valid: false,
        code: 'INVALID_REQUEST',
        message: `Client-supplied "${field}" is strictly prohibited. Security context is authoritative and server-derived.`,
      };
    }
  }

  // Validate targetType
  const rawTargetType = record.targetType;
  if (!rawTargetType || typeof rawTargetType !== 'string') {
    return {
      valid: false,
      code: 'INVALID_TARGET',
      message: 'Field "targetType" is required and must be a string.',
    };
  }

  const targetType = rawTargetType.trim() as InvestigationTargetType;
  if (!VALID_TARGET_TYPES.has(targetType)) {
    return {
      valid: false,
      code: 'INVALID_TARGET',
      message: `Unsupported targetType: "${rawTargetType}". Allowed target types: ${Array.from(VALID_TARGET_TYPES).join(', ')}.`,
    };
  }

  // Validate optional analystQuestion
  let analystQuestion: string | undefined;
  if ('analystQuestion' in record && record.analystQuestion !== undefined) {
    if (typeof record.analystQuestion !== 'string') {
      return {
        valid: false,
        code: 'INVALID_REQUEST',
        message: 'Field "analystQuestion" must be a string if provided.',
      };
    }
    const trimmed = record.analystQuestion.trim();
    if (trimmed.length > INVESTIGATION_LIMITS.maxAnalystQuestionLength) {
      return {
        valid: false,
        code: 'BOUNDS_VIOLATION',
        message: `Field "analystQuestion" exceeds maximum allowed length of ${INVESTIGATION_LIMITS.maxAnalystQuestionLength} characters.`,
      };
    }
    if (trimmed.length > 0) {
      analystQuestion = trimmed;
    }
  }

  // Validate optional includeRiskPosture
  let includeRiskPosture: boolean | undefined;
  if ('includeRiskPosture' in record && record.includeRiskPosture !== undefined) {
    if (typeof record.includeRiskPosture !== 'boolean') {
      return {
        valid: false,
        code: 'INVALID_REQUEST',
        message: 'Field "includeRiskPosture" must be a boolean if provided.',
      };
    }
    includeRiskPosture = record.includeRiskPosture;
  }

  // Target-specific selector validation
  let findingIds: string[] | undefined;
  let patternIds: string[] | undefined;
  let subjectType: InvestigationSubjectType | undefined;
  let subjectId: string | undefined;

  // Validate findingIds array bounds and item types if provided
  if ('findingIds' in record && record.findingIds !== undefined) {
    if (!Array.isArray(record.findingIds)) {
      return {
        valid: false,
        code: 'INVALID_SELECTOR',
        message: 'Field "findingIds" must be an array of strings.',
      };
    }
    if (record.findingIds.length > INVESTIGATION_LIMITS.maxFindingsPerInvestigation) {
      return {
        valid: false,
        code: 'BOUNDS_VIOLATION',
        message: `Field "findingIds" contains ${record.findingIds.length} items, exceeding maximum allowed limit of ${INVESTIGATION_LIMITS.maxFindingsPerInvestigation}.`,
      };
    }
    const sanitizedIds: string[] = [];
    for (const item of record.findingIds) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        return {
          valid: false,
          code: 'INVALID_SELECTOR',
          message: 'All items in "findingIds" must be non-empty strings.',
        };
      }
      sanitizedIds.push(item.trim());
    }
    findingIds = sanitizedIds;
  }

  // Validate patternIds array bounds and item types if provided
  if ('patternIds' in record && record.patternIds !== undefined) {
    if (!Array.isArray(record.patternIds)) {
      return {
        valid: false,
        code: 'INVALID_SELECTOR',
        message: 'Field "patternIds" must be an array of strings.',
      };
    }
    if (record.patternIds.length > INVESTIGATION_LIMITS.maxPatternsPerInvestigation) {
      return {
        valid: false,
        code: 'BOUNDS_VIOLATION',
        message: `Field "patternIds" contains ${record.patternIds.length} items, exceeding maximum allowed limit of ${INVESTIGATION_LIMITS.maxPatternsPerInvestigation}.`,
      };
    }
    const sanitizedIds: string[] = [];
    for (const item of record.patternIds) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        return {
          valid: false,
          code: 'INVALID_SELECTOR',
          message: 'All items in "patternIds" must be non-empty strings.',
        };
      }
      sanitizedIds.push(item.trim());
    }
    patternIds = sanitizedIds;
  }

  // Target-specific requirements
  if (targetType === 'finding') {
    if (!findingIds || findingIds.length === 0) {
      return {
        valid: false,
        code: 'INVALID_SELECTOR',
        message: 'At least one finding id is required in "findingIds" for a finding investigation.',
      };
    }
  } else if (targetType === 'pattern') {
    if (!patternIds || patternIds.length === 0) {
      return {
        valid: false,
        code: 'INVALID_SELECTOR',
        message: 'At least one pattern id is required in "patternIds" for a pattern investigation.',
      };
    }
  } else if (targetType === 'subject') {
    const rawSubjectType = record.subjectType;
    if (!rawSubjectType || typeof rawSubjectType !== 'string') {
      return {
        valid: false,
        code: 'INVALID_SELECTOR',
        message: 'Field "subjectType" is required for a subject investigation.',
      };
    }
    const normalizedSubjectType = rawSubjectType.trim().toLowerCase() as InvestigationSubjectType;
    if (!VALID_SUBJECT_TYPES.has(normalizedSubjectType)) {
      return {
        valid: false,
        code: 'INVALID_SELECTOR',
        message: `Unsupported subjectType: "${rawSubjectType}". Allowed: ${Array.from(VALID_SUBJECT_TYPES).join(', ')}.`,
      };
    }
    subjectType = normalizedSubjectType;

    const rawSubjectId = record.subjectId;
    if (!rawSubjectId || typeof rawSubjectId !== 'string' || rawSubjectId.trim().length === 0) {
      return {
        valid: false,
        code: 'INVALID_SELECTOR',
        message: 'Field "subjectId" is required and must be a non-empty string for a subject investigation.',
      };
    }
    subjectId = rawSubjectId.trim();
  }

  // Check for unknown arbitrary nested objects or non-primitive fields
  const allowedKeys = new Set([
    'targetType',
    'findingIds',
    'patternIds',
    'subjectType',
    'subjectId',
    'includeRiskPosture',
    'analystQuestion',
  ]);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      return {
        valid: false,
        code: 'INVALID_REQUEST',
        message: `Unrecognized request field "${key}". Arbitrary fields are not permitted.`,
      };
    }
  }

  const validatedRequest: InvestigationRequest = {
    targetType,
    ...(findingIds ? { findingIds } : {}),
    ...(patternIds ? { patternIds } : {}),
    ...(subjectType ? { subjectType } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(includeRiskPosture !== undefined ? { includeRiskPosture } : {}),
    ...(analystQuestion ? { analystQuestion } : {}),
  };

  return {
    valid: true,
    request: validatedRequest,
  };
}

// ============================================================================
// DEPENDENCY INJECTION INTERFACE
// ============================================================================

export interface InvestigationRouteDependencies {
  readonly authHelper?: (req: NextRequest) => Promise<AuthContextResult>;
  readonly rateLimiter?: (
    req: NextRequest,
    category: RateLimitCategory,
    authContext?: { userId?: string; organizationId?: string }
  ) => Promise<RateLimitResult>;
  readonly contextSources?: InvestigationContextSources;
  readonly providerFactory?: (config?: InvestigationProviderConfig) => InvestigationProvider;
}

// ============================================================================
// CORE ROUTE HANDLER
// ============================================================================

/**
 * Handles security investigation requests with support for dependency injection in offline tests.
 */
export async function handleInvestigationRequest(
  req: NextRequest,
  deps: InvestigationRouteDependencies = {}
): Promise<NextResponse<InvestigationApiResponse>> {
  const startTime = Date.now();
  let authoritativeOrgId: string | undefined;
  let requestedTargetType: string | undefined;

  try {
    // 1. Authentication & Authorization
    // Derive organizationId strictly from authenticated server context. Never trust client.
    const authHelper = deps.authHelper || (() => requireRole(['admin', 'analyst']));
    let auth: AuthContextResult;
    try {
      auth = await authHelper(req);
    } catch (authErr: unknown) {
      const errRecord = authErr as Record<string, unknown>;
      const status = (typeof errRecord?.status === 'number' ? errRecord.status : 401);
      const message = (authErr instanceof Error && authErr.message)
        ? authErr.message
        : (status === 403 ? 'Forbidden: Insufficient role.' : 'Unauthorized session.');

      logSafeApiMetrics({
        type: 'INVESTIGATION_API_REQUEST',
        durationMs: Date.now() - startTime,
        statusCode: status,
        success: false,
        category: status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED',
      });

      return errorResponse(
        status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED',
        message,
        status
      );
    }

    const { user, organizationId } = auth;
    authoritativeOrgId = organizationId;

    // 2. Rate Limiting
    // Apply EXPENSIVE category rate limit before any AI provider execution.
    // Preserves fail-closed behavior on Redis failure.
    const rateLimiter = deps.rateLimiter || enforceRateLimit;
    const rl = await rateLimiter(req, 'EXPENSIVE', {
      userId: user.id,
      organizationId,
    });

    if (!rl.success) {
      const headers: Record<string, string> = {};
      if (rl.response) {
        rl.response.headers.forEach((val, key) => {
          headers[key] = val;
        });
      }

      logSafeApiMetrics({
        type: 'INVESTIGATION_API_REQUEST',
        organizationId: authoritativeOrgId,
        durationMs: Date.now() - startTime,
        statusCode: 429,
        success: false,
        category: 'RATE_LIMITED',
      });

      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Security investigation rate check limit exceeded. Please try again later.',
        429,
        headers
      );
    }

    // 3. Parse and Validate Request JSON manually
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      logSafeApiMetrics({
        type: 'INVESTIGATION_API_REQUEST',
        organizationId: authoritativeOrgId,
        durationMs: Date.now() - startTime,
        statusCode: 400,
        success: false,
        category: 'MALFORMED_JSON',
      });
      return errorResponse('MALFORMED_JSON', 'Request body must be valid JSON.', 400);
    }

    const validation = validateInvestigationRequestBody(rawBody);
    if (!validation.valid) {
      logSafeApiMetrics({
        type: 'INVESTIGATION_API_REQUEST',
        organizationId: authoritativeOrgId,
        durationMs: Date.now() - startTime,
        statusCode: 400,
        success: false,
        category: validation.code,
      });
      return errorResponse(validation.code, validation.message, 400);
    }

    const validatedRequest = validation.request;
    requestedTargetType = validatedRequest.targetType;

    // 4. Build Authoritative Investigation Context
    // Never accepts context from browser. The context builder is the single source of truth.
    let context;
    try {
      context = await buildInvestigationContext(
        organizationId,
        validatedRequest,
        deps.contextSources
      );
    } catch (builderErr: unknown) {
      if (builderErr instanceof InvestigationContextBuilderError) {
        const statusCode = builderErr.status;
        const code = statusCode === 404 ? 'TARGET_NOT_FOUND' : 'INVALID_REQUEST';

        logSafeApiMetrics({
          type: 'INVESTIGATION_API_REQUEST',
          organizationId: authoritativeOrgId,
          targetType: requestedTargetType,
          durationMs: Date.now() - startTime,
          statusCode,
          success: false,
          category: code,
        });

        return errorResponse(code, builderErr.message, statusCode);
      }

      throw builderErr;
    }

    // 5. Invoke AI Investigation Provider Abstraction
    // API route depends only on provider abstraction, never instantiates OpenAI directly.
    const providerFactory = deps.providerFactory || getInvestigationProvider;
    let provider: InvestigationProvider;
    try {
      provider = providerFactory();
    } catch {
      logSafeApiMetrics({
        type: 'INVESTIGATION_API_REQUEST',
        organizationId: authoritativeOrgId,
        targetType: requestedTargetType,
        durationMs: Date.now() - startTime,
        statusCode: 502,
        success: false,
        category: 'PROVIDER_CONFIG_FAILURE',
      });
      return errorResponse(
        'UPSTREAM_PROVIDER_ERROR',
        'AI investigation provider is unavailable or improperly configured.',
        502
      );
    }

    let investigationResult: InvestigationResult;
    try {
      investigationResult = await provider.generateInvestigation({
        context,
        analystQuestion: validatedRequest.analystQuestion,
      });
    } catch (providerCallErr: unknown) {
      // Upstream provider errors, timeouts, and guardrail validation errors map safely to 502
      // Internal error messages, stack traces, and keys are NEVER exposed to the client
      const durationMs = Date.now() - startTime;
      const errorCategory = providerCallErr instanceof InvestigationProviderError
        ? providerCallErr.name
        : 'ProviderRequestFailure';

      logSafeApiMetrics({
        type: 'INVESTIGATION_API_REQUEST',
        organizationId: authoritativeOrgId,
        targetType: requestedTargetType,
        durationMs,
        statusCode: 502,
        success: false,
        category: errorCategory,
      });

      return errorResponse(
        'UPSTREAM_PROVIDER_ERROR',
        'AI investigation provider request failed or produced invalid security output.',
        502
      );
    }

    // 6. Return Verified, Immutable Investigation Result (Strictly Read-Only)
    logSafeApiMetrics({
      type: 'INVESTIGATION_API_REQUEST',
      organizationId: authoritativeOrgId,
      targetType: requestedTargetType,
      durationMs: Date.now() - startTime,
      statusCode: 200,
      success: true,
    });

    return successResponse(investigationResult);
  } catch {
    // Unexpected internal errors map safely to 500 without leaking stack traces or internal DB errors
    const durationMs = Date.now() - startTime;
    logSafeApiMetrics({
      type: 'INVESTIGATION_API_REQUEST',
      organizationId: authoritativeOrgId,
      targetType: requestedTargetType,
      durationMs,
      statusCode: 500,
      success: false,
      category: 'UNEXPECTED_INTERNAL_ERROR',
    });

    return errorResponse(
      'INTERNAL_ERROR',
      'An unexpected internal error occurred during security investigation.',
      500
    );
  }
}

// ============================================================================
// NEXT.JS API ROUTE EXPORTS
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse<InvestigationApiResponse>> {
  return handleInvestigationRequest(req);
}

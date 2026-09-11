import { NextRequest, NextResponse } from 'next/server';
import { requireRole, AuthContextResult } from '@/lib/auth/authorization';
import { enforceRateLimit, RateLimitCategory, RateLimitResult } from '@/lib/security/rateLimit';
import {
  orchestrateSecurityIntelligence,
  NvidiaOrchestrationRequest,
  NvidiaOrchestrationResult,
  NvidiaOrchestrationTargetType,
  NvidiaOrchestrationSubjectType,
  NvidiaOrchestrationError,
  OrchestrationDependencies,
} from '@/lib/security/intelligence/nvidia/orchestrator';

// ============================================================================
// CONSTANTS & PROHIBITED CLIENT FIELDS
// ============================================================================

const VALID_TARGET_TYPES = new Set<NvidiaOrchestrationTargetType>([
  'subject',
  'finding',
  'pattern',
  'posture',
]);

const VALID_SUBJECT_TYPES = new Set<NvidiaOrchestrationSubjectType>([
  'identity',
  'ai_agent',
  'resource',
]);

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
// RESPONSE INTERFACES
// ============================================================================

export interface IntelligenceApiResponse<T = NvidiaOrchestrationResult> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  headers?: Record<string, string>
): NextResponse<IntelligenceApiResponse> {
  return NextResponse.json<IntelligenceApiResponse>(
    {
      success: false,
      error: { code, message },
    },
    { status, headers }
  );
}

function successResponse(
  data: NvidiaOrchestrationResult,
  status = 200
): NextResponse<IntelligenceApiResponse> {
  return NextResponse.json<IntelligenceApiResponse>(
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
  readonly type: 'NVIDIA_INTELLIGENCE_API_REQUEST';
  readonly targetType?: string;
  readonly organizationId?: string;
  readonly durationMs: number;
  readonly statusCode: number;
  readonly success: boolean;
  readonly category?: string;
}

function logSafeApiMetrics(payload: SafeOperationalLogPayload): void {
  if (process.env.NODE_ENV !== 'test') {
    console.log(JSON.stringify(payload));
  }
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

export interface ValidationSuccess {
  readonly valid: true;
  readonly request: NvidiaOrchestrationRequest;
}

export interface ValidationFailure {
  readonly valid: false;
  readonly code: string;
  readonly message: string;
}

export type ValidationOutcome = ValidationSuccess | ValidationFailure;

export function validateIntelligenceRequestBody(body: unknown): ValidationOutcome {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      code: 'INVALID_REQUEST',
      message: 'Request body must be a valid JSON object.',
    };
  }

  const record = body as Record<string, unknown>;

  // Check prohibited prototype pollution keys
  if (
    Object.prototype.hasOwnProperty.call(record, '__proto__') ||
    Object.prototype.hasOwnProperty.call(record, 'constructor') ||
    Object.prototype.hasOwnProperty.call(record, 'prototype')
  ) {
    return {
      valid: false,
      code: 'INVALID_REQUEST',
      message: 'Request payload contains prohibited prototype keys.',
    };
  }

  // Check prohibited client fields
  for (const field of PROHIBITED_CLIENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field) && record[field] !== undefined) {
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

  const targetType = rawTargetType.toLowerCase().trim() as NvidiaOrchestrationTargetType;
  if (!VALID_TARGET_TYPES.has(targetType)) {
    return {
      valid: false,
      code: 'INVALID_TARGET',
      message: `Invalid targetType: "${rawTargetType}". Allowed values: subject, finding, pattern, posture.`,
    };
  }

  // Validate subjectType if provided
  let subjectType: NvidiaOrchestrationSubjectType | undefined;
  if (record.subjectType !== undefined && record.subjectType !== null) {
    if (typeof record.subjectType !== 'string') {
      return {
        valid: false,
        code: 'INVALID_TARGET',
        message: 'Field "subjectType" must be a string.',
      };
    }
    const normalizedSubjectType = record.subjectType.toLowerCase().trim() as NvidiaOrchestrationSubjectType;
    if (!VALID_SUBJECT_TYPES.has(normalizedSubjectType)) {
      return {
        valid: false,
        code: 'INVALID_TARGET',
        message: `Invalid subjectType: "${record.subjectType}". Allowed values: identity, ai_agent, resource.`,
      };
    }
    subjectType = normalizedSubjectType;
  }

  // Validate subjectId if provided
  let subjectId: string | undefined;
  if (record.subjectId !== undefined && record.subjectId !== null) {
    if (typeof record.subjectId !== 'string') {
      return {
        valid: false,
        code: 'INVALID_TARGET',
        message: 'Field "subjectId" must be a string.',
      };
    }
    subjectId = record.subjectId.trim();
  }

  // Validate findingIds if provided
  let findingIds: string[] | undefined;
  if (record.findingIds !== undefined && record.findingIds !== null) {
    if (!Array.isArray(record.findingIds)) {
      return {
        valid: false,
        code: 'INVALID_TARGET',
        message: 'Field "findingIds" must be an array of strings.',
      };
    }
    if (record.findingIds.length > 25) {
      return {
        valid: false,
        code: 'BOUNDS_VIOLATION',
        message: 'Too many findingIds requested. Maximum allowed is 25.',
      };
    }
    for (const item of record.findingIds) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        return {
          valid: false,
          code: 'INVALID_TARGET',
          message: 'Every findingId must be a non-empty string.',
        };
      }
    }
    findingIds = record.findingIds.map((id: string) => id.trim());
  }

  // Validate patternIds if provided
  let patternIds: string[] | undefined;
  if (record.patternIds !== undefined && record.patternIds !== null) {
    if (!Array.isArray(record.patternIds)) {
      return {
        valid: false,
        code: 'INVALID_TARGET',
        message: 'Field "patternIds" must be an array of strings.',
      };
    }
    if (record.patternIds.length > 25) {
      return {
        valid: false,
        code: 'BOUNDS_VIOLATION',
        message: 'Too many patternIds requested. Maximum allowed is 25.',
      };
    }
    for (const item of record.patternIds) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        return {
          valid: false,
          code: 'INVALID_TARGET',
          message: 'Every patternId must be a non-empty string.',
        };
      }
    }
    patternIds = record.patternIds.map((id: string) => id.trim());
  }

  // Validate analystQuestion if provided
  let analystQuestion: string | undefined;
  if (record.analystQuestion !== undefined && record.analystQuestion !== null) {
    if (typeof record.analystQuestion !== 'string') {
      return {
        valid: false,
        code: 'INVALID_ANALYST_QUESTION',
        message: 'Field "analystQuestion" must be a string.',
      };
    }
    if (record.analystQuestion.length > 1000) {
      return {
        valid: false,
        code: 'BOUNDS_VIOLATION',
        message: 'analystQuestion exceeds maximum limit of 1000 characters.',
      };
    }
    analystQuestion = record.analystQuestion;
  }

  return {
    valid: true,
    request: {
      targetType,
      subjectType,
      subjectId,
      findingIds,
      patternIds,
      analystQuestion,
    },
  };
}

// ============================================================================
// HANDLER & DEPENDENCY INJECTION
// ============================================================================

export interface RouteDependencies {
  readonly authHelper?: () => Promise<AuthContextResult>;
  readonly rateLimiter?: (
    req: NextRequest,
    category: RateLimitCategory,
    opts: { userId?: string; organizationId?: string }
  ) => Promise<RateLimitResult>;
  readonly orchestrationDeps?: OrchestrationDependencies;
}

export async function handleIntelligencePost(
  req: NextRequest,
  deps: RouteDependencies = {}
): Promise<NextResponse<IntelligenceApiResponse>> {
  const startTime = Date.now();
  let organizationId: string | undefined;
  let targetType: string | undefined;

  try {
    // 1. Authenticate & Authorize Role (admin, analyst)
    const authHelper = deps.authHelper || (() => requireRole(['admin', 'analyst']));
    let auth: AuthContextResult;
    try {
      auth = await authHelper();
    } catch (authErr: unknown) {
      const status = (authErr as Record<string, unknown>)?.status as number || 401;
      const message = (authErr as Error)?.message || 'Authentication required.';
      const code = status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED';

      logSafeApiMetrics({
        type: 'NVIDIA_INTELLIGENCE_API_REQUEST',
        durationMs: Date.now() - startTime,
        statusCode: status,
        success: false,
        category: code,
      });

      return errorResponse(code, message, status);
    }

    organizationId = auth.organizationId;

    // 2. Enforce EXPENSIVE Rate Limiting
    const rateLimiter = deps.rateLimiter || enforceRateLimit;
    const rl = await rateLimiter(req, 'EXPENSIVE', {
      userId: auth.user.id,
      organizationId,
    });

    if (!rl.success) {
      const headers: Record<string, string> = {};
      if (rl.reset) {
        headers['Retry-After'] = String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)));
      }

      logSafeApiMetrics({
        type: 'NVIDIA_INTELLIGENCE_API_REQUEST',
        organizationId,
        durationMs: Date.now() - startTime,
        statusCode: 429,
        success: false,
        category: 'RATE_LIMITED',
      });

      return errorResponse('RATE_LIMITED', 'Rate limit exceeded for intelligence requests.', 429, headers);
    }

    // 3. Parse JSON Body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      logSafeApiMetrics({
        type: 'NVIDIA_INTELLIGENCE_API_REQUEST',
        organizationId,
        durationMs: Date.now() - startTime,
        statusCode: 400,
        success: false,
        category: 'MALFORMED_JSON',
      });
      return errorResponse('MALFORMED_JSON', 'Malformed JSON in request body.', 400);
    }

    // 4. Validate Request Schema
    const validation = validateIntelligenceRequestBody(rawBody);
    if (!validation.valid) {
      logSafeApiMetrics({
        type: 'NVIDIA_INTELLIGENCE_API_REQUEST',
        organizationId,
        durationMs: Date.now() - startTime,
        statusCode: 400,
        success: false,
        category: validation.code,
      });
      return errorResponse(validation.code, validation.message, 400);
    }

    targetType = validation.request.targetType;

    // 5. Execute Security Intelligence Orchestration
    const result = await orchestrateSecurityIntelligence(
      organizationId,
      validation.request,
      deps.orchestrationDeps
    );

    logSafeApiMetrics({
      type: 'NVIDIA_INTELLIGENCE_API_REQUEST',
      targetType,
      organizationId,
      durationMs: Date.now() - startTime,
      statusCode: 200,
      success: true,
    });

    return successResponse(result, 200);
  } catch (err: unknown) {
    if (err instanceof NvidiaOrchestrationError) {
      logSafeApiMetrics({
        type: 'NVIDIA_INTELLIGENCE_API_REQUEST',
        targetType,
        organizationId,
        durationMs: Date.now() - startTime,
        statusCode: err.status,
        success: false,
        category: err.code,
      });
      return errorResponse(err.code, err.message, err.status);
    }

    const message = err instanceof Error ? err.message : 'Internal intelligence processing error.';
    logSafeApiMetrics({
      type: 'NVIDIA_INTELLIGENCE_API_REQUEST',
      targetType,
      organizationId,
      durationMs: Date.now() - startTime,
      statusCode: 500,
      success: false,
      category: 'INTERNAL_ERROR',
    });

    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<IntelligenceApiResponse>> {
  return handleIntelligencePost(req);
}

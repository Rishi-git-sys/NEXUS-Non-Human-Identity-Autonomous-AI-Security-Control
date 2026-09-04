import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { correlationService } from '@/lib/security/intelligence/correlationService';

const VALID_PATTERN_SEVERITIES = new Set(['MEDIUM', 'HIGH', 'CRITICAL']);
const VALID_PATTERN_SUBJECT_TYPES = new Set(['identity', 'ai_agent']);

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce server-side authentication and derive authoritative organizationId
    const { user, organizationId } = await requireAuth();

    // 2. Enforce READ rate limiting
    const rl = await enforceRateLimit(req, 'READ', { userId: user.id, organizationId });
    if (!rl.success && rl.response) {
      return rl.response;
    }

    // 3. Parse and validate query parameters
    const url = new URL(req.url);

    const rawSeverity = url.searchParams.get('severity');
    let severity: string | undefined;
    if (rawSeverity) {
      const upper = rawSeverity.toUpperCase().trim();
      if (!VALID_PATTERN_SEVERITIES.has(upper)) {
        return apiError(
          `Invalid severity parameter. Allowed values: ${Array.from(VALID_PATTERN_SEVERITIES).join(', ')}`,
          400
        );
      }
      severity = upper;
    }

    const rawSubjectType = url.searchParams.get('subjectType');
    let subjectType: string | undefined;
    if (rawSubjectType) {
      const lower = rawSubjectType.toLowerCase().trim();
      if (!VALID_PATTERN_SUBJECT_TYPES.has(lower)) {
        return apiError(
          `Invalid subjectType parameter. Allowed values: ${Array.from(VALID_PATTERN_SUBJECT_TYPES).join(', ')}`,
          400
        );
      }
      subjectType = lower;
    }

    const rawPage = url.searchParams.get('page');
    const page = rawPage ? parseInt(rawPage, 10) : 1;
    if (isNaN(page) || page < 1) {
      return apiError('Page parameter must be an integer >= 1.', 400);
    }

    const rawLimit = url.searchParams.get('limit');
    const limit = rawLimit ? parseInt(rawLimit, 10) : 50;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return apiError('Limit parameter must be an integer between 1 and 100.', 400);
    }

    // 4. Retrieve correlated patterns scoped strictly to the authenticated organization
    const patternsResult = await correlationService.getCorrelatedPatterns(organizationId, {
      severity,
      subjectType,
      page,
      limit,
    });

    return apiSuccess(patternsResult);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch correlated security patterns.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

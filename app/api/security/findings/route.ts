import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { findingService } from '@/lib/security/intelligence/findingService';

const VALID_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const VALID_CATEGORIES = new Set([
  'CREDENTIAL',
  'PERMISSION',
  'IDENTITY',
  'AI_AGENT',
  'AWS',
  'RESOURCE',
]);
const VALID_SUBJECT_TYPES = new Set(['identity', 'ai_agent', 'resource']);

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
      if (!VALID_SEVERITIES.has(upper)) {
        return apiError(
          `Invalid severity parameter. Allowed values: ${Array.from(VALID_SEVERITIES).join(', ')}`,
          400
        );
      }
      severity = upper;
    }

    const rawCategory = url.searchParams.get('category');
    let category: string | undefined;
    if (rawCategory) {
      const upper = rawCategory.toUpperCase().trim();
      if (!VALID_CATEGORIES.has(upper)) {
        return apiError(
          `Invalid category parameter. Allowed values: ${Array.from(VALID_CATEGORIES).join(', ')}`,
          400
        );
      }
      category = upper;
    }

    const rawSubjectType = url.searchParams.get('subjectType');
    let subjectType: string | undefined;
    if (rawSubjectType) {
      const lower = rawSubjectType.toLowerCase().trim();
      if (!VALID_SUBJECT_TYPES.has(lower)) {
        return apiError(
          `Invalid subjectType parameter. Allowed values: ${Array.from(VALID_SUBJECT_TYPES).join(', ')}`,
          400
        );
      }
      subjectType = lower;
    }

    const subjectId = url.searchParams.get('subjectId')?.trim() || undefined;

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

    // 4. Retrieve findings scoped strictly to the authenticated organization
    const findingsResult = await findingService.getAllFindings(organizationId, {
      severity,
      category,
      subjectType,
      subjectId,
      page,
      limit,
    });

    return apiSuccess(findingsResult);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch security findings.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

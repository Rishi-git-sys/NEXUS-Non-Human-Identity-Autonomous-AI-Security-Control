import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { riskIntelligenceService } from '@/lib/security/intelligence/riskIntelligenceService';

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce server-side authentication and derive authoritative organizationId
    const { user, organizationId } = await requireAuth();

    // 2. Enforce READ rate limiting
    const rl = await enforceRateLimit(req, 'READ', { userId: user.id, organizationId });
    if (!rl.success && rl.response) {
      return rl.response;
    }

    // 3. Compute deterministic organization-level security risk posture
    const posture = await riskIntelligenceService.getOrganizationRiskPosture(organizationId);

    return apiSuccess(posture);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch security risk posture.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

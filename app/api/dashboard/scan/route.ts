import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { dashboardService } from '@/lib/services/dashboardService';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const { user, profile, organizationId } = await requireAuth();
    const rl = await enforceRateLimit(req, 'EXPENSIVE', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const actorName = profile.full_name || (user.user_metadata?.full_name as string) || user.email || 'Security Operator';

    await dashboardService.logScanAudit(organizationId, user.id, actorName);

    return apiSuccess({
      message: 'On-demand compliance boundary scan initiated.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to trigger scan audit.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

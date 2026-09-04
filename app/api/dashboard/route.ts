import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { dashboardService } from '@/lib/services/dashboardService';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const { user, organizationId } = await requireAuth();
    console.log('[API /api/dashboard] Request authorized for user:', user.id, 'org:', organizationId);

    const rl = await enforceRateLimit(req, 'READ', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const url = new URL(req.url);
    const timeframe = (url.searchParams.get('timeframe') || '7d') as '7d' | '30d' | '90d';

    const data = await dashboardService.getDashboardData(organizationId, timeframe);
    console.log('[API /api/dashboard] Successfully retrieved telemetry for org:', organizationId);
    return apiSuccess(data);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch dashboard data.';

    console.error('[API /api/dashboard] Failure in dashboard telemetry route:', {
      status,
      message,
    });

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { dashboardService } from '@/lib/services/dashboardService';

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireAuth();

    const url = new URL(req.url);
    const timeframe = (url.searchParams.get('timeframe') || '7d') as '7d' | '30d' | '90d';

    const data = await dashboardService.getDashboardData(organizationId, timeframe);
    return apiSuccess(data);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch dashboard data.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

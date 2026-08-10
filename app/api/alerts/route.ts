import { requireAuth } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { alertService } from '@/lib/services/alertService';

export async function GET() {
  try {
    const { organizationId } = await requireAuth();

    const alerts = await alertService.getAlerts(organizationId);
    return apiSuccess(alerts);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch alerts.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

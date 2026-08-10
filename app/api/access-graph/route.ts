import { requireAuth } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { accessGraphService } from '@/lib/services/accessGraphService';

export async function GET() {
  try {
    const { organizationId } = await requireAuth();

    const graphData = await accessGraphService.getAccessGraph(organizationId);
    return apiSuccess(graphData);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch access graph topology.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

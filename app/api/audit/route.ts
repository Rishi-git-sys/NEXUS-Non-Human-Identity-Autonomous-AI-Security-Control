import { requireAuth } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { auditService } from '@/lib/services/auditService';

export async function GET() {
  try {
    const { organizationId } = await requireAuth();

    const auditLogs = await auditService.getAuditEvents(organizationId);
    return apiSuccess(auditLogs);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch audit logs.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

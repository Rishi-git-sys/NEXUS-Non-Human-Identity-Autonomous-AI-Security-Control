import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { alertService } from '@/lib/services/alertService';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, organizationId } = await requireAuth();
    const rl = await enforceRateLimit(req, 'READ', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const alert = await alertService.getAlertById(organizationId, id);
    if (!alert) {
      return apiNotFound('Alert not found.');
    }

    return apiSuccess(alert);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch alert.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, organizationId } = await requireRole(['admin', 'analyst']);
    const rl = await enforceRateLimit(req, 'MUTATION', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const body = await req.json();

    if (!body.status) {
      return apiError('Alert status is required.', 400);
    }

    const validStatuses = ['Open', 'Acknowledged', 'Investigating', 'Resolved', 'Dismissed'];
    if (!validStatuses.includes(body.status)) {
      return apiError(`Invalid alert status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const res = await alertService.updateAlertStatus(
      organizationId,
      user.id,
      id,
      body.status
    );

    if (!res.success || !res.alert) {
      return apiError(res.message, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: `alert.${body.status.toLowerCase()}`,
      entityType: 'alert',
      entityId: res.alert.id,
      metadata: { title: res.alert.title, status: res.alert.status },
    });

    return apiSuccess(res.alert);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to update alert.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { policyService } from '@/lib/services/policyService';
import { writeAuditLog } from '@/lib/audit/auditLogger';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { organizationId } = await requireAuth();

    const policy = await policyService.getPolicyById(organizationId, id);
    if (!policy) {
      return apiNotFound('Policy not found.');
    }

    return apiSuccess(policy);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch policy.';

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
    const body = await req.json();

    if (body.organization_id && body.organization_id !== organizationId) {
      return apiForbidden('Modifying organization ownership is strictly prohibited.');
    }

    let res;
    if (body.status && Object.keys(body).length === 1) {
      res = await policyService.updatePolicyStatus(organizationId, id, body.status);
    } else {
      res = await policyService.updatePolicy(organizationId, id, body);
    }

    if (!res.success || !res.policy) {
      return apiError(res.message, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'policy.updated',
      entityType: 'policy',
      entityId: res.policy.id,
      metadata: { name: res.policy.name, status: res.policy.status },
    });

    return apiSuccess(res.policy);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to update policy.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

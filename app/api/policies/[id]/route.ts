import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { policyService } from '@/lib/services/policyService';
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
    const rl = await enforceRateLimit(req, 'MUTATION', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const body = await req.json();

    if (body.organization_id && body.organization_id !== organizationId) {
      return apiForbidden('Modifying organization ownership is strictly prohibited.');
    }

    const existing = await policyService.getPolicyById(organizationId, id);
    if (!existing) {
      return apiNotFound('Policy not found.');
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, organizationId } = await requireRole(['admin', 'analyst']);
    const rl = await enforceRateLimit(req, 'DELETE', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    // Check if policy exists and belongs to this organization
    const existing = await policyService.getPolicyById(organizationId, id);
    if (!existing) {
      return apiNotFound('Policy not found.');
    }

    const res = await policyService.deletePolicy(organizationId, id);
    if (!res.success) {
      return apiError(res.message, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'policy.deleted',
      entityType: 'policy',
      entityId: id,
      metadata: { name: existing.name, severity: existing.severity },
    });

    return apiSuccess({ message: 'Policy deleted successfully.' });
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to delete policy.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

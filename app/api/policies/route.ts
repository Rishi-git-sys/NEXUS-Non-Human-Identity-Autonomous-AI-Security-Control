import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { policyService } from '@/lib/services/policyService';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const { user, organizationId } = await requireAuth();
    const rl = await enforceRateLimit(req, 'READ', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const policies = await policyService.getPolicies(organizationId);
    return apiSuccess(policies);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch policies.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, organizationId } = await requireRole(['admin', 'analyst']);
    const rl = await enforceRateLimit(req, 'MUTATION', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const body = await req.json();

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return apiError('Policy name is required.', 400);
    }
    if (!body.description || typeof body.description !== 'string' || !body.description.trim()) {
      return apiError('Policy description is required.', 400);
    }

    const res = await policyService.createPolicy(organizationId, user.id, {
      name: body.name,
      description: body.description,
      scope: body.scope,
      severity: body.severity,
      decision: body.decision,
      status: body.status,
      conditions: body.conditions,
    });

    if (!res.success || !res.policy) {
      return apiError(res.message, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'policy.created',
      entityType: 'policy',
      entityId: res.policy.id,
      metadata: { name: res.policy.name, severity: res.policy.severity },
    });

    return apiSuccess(res.policy, 201);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to create policy.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

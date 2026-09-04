import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { identityService, mapUITypeToDB, mapUIStatusToDB } from '@/lib/services/identityService';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const { user, organizationId } = await requireAuth();
    const rl = await enforceRateLimit(req, 'READ', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const data = await identityService.getIdentities(organizationId);

    return apiSuccess(data || []);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch identities.';

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
      return apiError('Identity name is required.', 400);
    }

    const identityType = mapUITypeToDB(body.identity_type || body.identityType || 'service_account');
    const status = mapUIStatusToDB(body.status || 'active');
    const riskScore = typeof body.risk_score === 'number' ? Math.max(0, Math.min(100, body.risk_score)) : 0;

    const supabase = await createClient();

    const record = {
      organization_id: organizationId,
      name: body.name.trim(),
      identity_type: identityType,
      status: status,
      risk_score: riskScore,
      owner_id: user.id,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    };

    const { data, error } = await supabase
      .from('identities')
      .insert(record)
      .select()
      .single();

    if (error) {
      return apiError(`Failed to create identity: ${error.message}`, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'identity.created',
      entityType: 'identity',
      entityId: data.id,
      metadata: { name: data.name, identity_type: data.identity_type },
    });

    const created = await identityService.getIdentityById(organizationId, data.id);
    return apiSuccess(created || data, 201);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to create identity.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

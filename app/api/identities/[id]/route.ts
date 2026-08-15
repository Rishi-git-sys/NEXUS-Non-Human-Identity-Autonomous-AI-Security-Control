import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { identityService, mapUITypeToDB, mapUIStatusToDB } from '@/lib/services/identityService';
import { Database } from '@/types/supabase';
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

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('identities')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return apiError(`Failed to fetch identity: ${error.message}`, 500);
    }

    if (!data) {
      return apiNotFound('Identity not found.');
    }

    return apiSuccess(data);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch identity.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

const ALLOWED_IDENTITY_ACTIONS = ['disable', 'enable', 'rotate', 'rotate_credential', 'revoke', 'revoke_access'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, profile, organizationId } = await requireRole(['admin', 'analyst']);
    const rl = await enforceRateLimit(req, 'MUTATION', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const body = await req.json();

    if (body.organization_id && body.organization_id !== organizationId) {
      return apiForbidden('Modifying organization ownership is strictly prohibited.');
    }

    // Verify identity exists and belongs to this organization
    const existing = await identityService.getIdentityById(organizationId, id);
    if (!existing) {
      return apiNotFound('Identity not found.');
    }

    // Handle explicit action-based mutations
    if (body.action !== undefined) {
      if (typeof body.action !== 'string' || !ALLOWED_IDENTITY_ACTIONS.includes(body.action.toLowerCase() as typeof ALLOWED_IDENTITY_ACTIONS[number])) {
        return apiError(`Invalid action: "${body.action}". Allowed actions: disable, enable, rotate, revoke.`, 400);
      }

      const normalizedAction = body.action.toLowerCase();
      let res;
      let auditAction = 'identity.updated';

      if (normalizedAction === 'disable') {
        res = await identityService.disableIdentity(organizationId, id);
        auditAction = 'identity.disabled';
      } else if (normalizedAction === 'enable') {
        res = await identityService.enableIdentity(organizationId, id);
        auditAction = 'identity.enabled';
      } else if (normalizedAction === 'rotate' || normalizedAction === 'rotate_credential') {
        res = await identityService.rotateCredential(organizationId, id);
        auditAction = 'identity.rotated';
      } else if (normalizedAction === 'revoke' || normalizedAction === 'revoke_access') {
        res = await identityService.revokeAccess(organizationId, id);
        auditAction = 'identity.revoked';
      }

      if (!res || !res.success || !res.identity) {
        return apiError(res?.message || 'Failed to execute identity action.', 400);
      }

      await writeAuditLog({
        organizationId,
        actorId: user.id,
        action: auditAction,
        entityType: 'identity',
        entityId: id,
        metadata: {
          action: normalizedAction,
          actor: profile?.full_name || user.email || 'Security Controller',
          identityName: existing.name,
          previousStatus: existing.status,
          newStatus: res.identity.status,
        },
      });

      return apiSuccess(res.identity);
    }

    // Otherwise handle property updates
    const updates: Database['public']['Tables']['identities']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (body.name && typeof body.name === 'string') updates.name = body.name.trim();
    if (body.identity_type || body.identityType) {
      updates.identity_type = mapUITypeToDB(body.identity_type || body.identityType);
    }
    if (body.status) updates.status = mapUIStatusToDB(body.status);
    if (typeof body.risk_score === 'number') {
      updates.risk_score = Math.max(0, Math.min(100, body.risk_score));
    }
    if (body.metadata && typeof body.metadata === 'object') {
      updates.metadata = body.metadata as Database['public']['Tables']['identities']['Update']['metadata'];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('identities')
      .update(updates)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return apiError(`Failed to update identity: ${error.message}`, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'identity.updated',
      entityType: 'identity',
      entityId: data.id,
      metadata: updates as Record<string, unknown>,
    });

    return apiSuccess(data);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to update identity.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

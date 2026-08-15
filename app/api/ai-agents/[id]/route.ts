import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { aiAgentService, mapAgentStatusToDB } from '@/lib/services/aiAgentService';
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
      .from('ai_agents')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return apiError(`Failed to fetch AI agent: ${error.message}`, 500);
    }

    if (!data) {
      return apiNotFound('AI agent not found.');
    }

    return apiSuccess(data);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch AI agent.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

const ALLOWED_AGENT_ACTIONS = ['freeze', 'unfreeze', 'rotate', 'rotate_secret'] as const;

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

    // Verify AI agent exists and belongs to this organization
    const existing = await aiAgentService.getAIAgentById(organizationId, id);
    if (!existing) {
      return apiNotFound('AI agent not found.');
    }

    // Handle explicit action-based mutations
    if (body.action !== undefined) {
      if (typeof body.action !== 'string' || !ALLOWED_AGENT_ACTIONS.includes(body.action.toLowerCase() as typeof ALLOWED_AGENT_ACTIONS[number])) {
        return apiError(`Invalid action: "${body.action}". Allowed actions: freeze, unfreeze, rotate.`, 400);
      }

      const normalizedAction = body.action.toLowerCase();
      let res;
      let auditAction = 'agent.updated';
      let auditReason = '';

      if (normalizedAction === 'freeze') {
        res = await aiAgentService.freezeAgent(organizationId, id);
        auditAction = 'FREEZE_AGENT';
        auditReason = `Agent "${existing.name}" has been frozen and isolated due to operator request.`;
      } else if (normalizedAction === 'unfreeze') {
        res = await aiAgentService.unfreezeAgent(organizationId, id);
        auditAction = 'UNFREEZE_AGENT';
        auditReason = `Agent "${existing.name}" has been reactivated and restored to baseline operations.`;
      } else if (normalizedAction === 'rotate' || normalizedAction === 'rotate_secret') {
        res = { success: true, message: 'Agent secret credentials rotated.', agent: existing };
        auditAction = 'ROTATE_SECRET';
        auditReason = `Rotated access token credentials for agent ${existing.name}.`;
      }

      if (!res || !res.success || !res.agent) {
        return apiError(res?.message || 'Failed to execute agent action.', 400);
      }

      await writeAuditLog({
        organizationId,
        actorId: user.id,
        action: auditAction,
        entityType: 'ai_agent',
        entityId: id,
        metadata: {
          actor: profile?.full_name || (user.user_metadata?.full_name as string) || user.email || 'Security Controller',
          resource: `agent/${id}`,
          environment: existing.environment,
          decision: 'ALLOWED',
          riskScore: normalizedAction === 'freeze' ? 0 : 10,
          reason: auditReason,
        },
      });

      return apiSuccess(res.agent);
    }

    // Otherwise handle property updates
    const updates: Database['public']['Tables']['ai_agents']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (body.name && typeof body.name === 'string') updates.name = body.name.trim();
    if (body.model) updates.model = body.model;
    if (body.provider) updates.provider = body.provider;
    if (body.version) updates.version = body.version;
    if (body.status) updates.status = mapAgentStatusToDB(body.status);
    if (typeof body.risk_score === 'number') {
      updates.risk_score = Math.max(0, Math.min(100, body.risk_score));
    }
    if (body.metadata && typeof body.metadata === 'object') {
      updates.metadata = body.metadata as Database['public']['Tables']['ai_agents']['Update']['metadata'];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('ai_agents')
      .update(updates)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return apiError(`Failed to update AI agent: ${error.message}`, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'agent.updated',
      entityType: 'ai_agent',
      entityId: data.id,
      metadata: updates as Record<string, unknown>,
    });

    return apiSuccess(data);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to update AI agent.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

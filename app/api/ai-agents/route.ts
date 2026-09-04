import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { aiAgentService } from '@/lib/services/aiAgentService';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const { user, organizationId } = await requireAuth();
    const rl = await enforceRateLimit(req, 'READ', { userId: user.id, organizationId });
    if (!rl.success && rl.response) return rl.response;

    const agents = await aiAgentService.getAIAgents(organizationId);

    return apiSuccess(agents);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch AI agents.';

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
      return apiError('AI agent name is required.', 400);
    }

    const res = await aiAgentService.createAIAgent(organizationId, {
      name: body.name.trim(),
      model: body.model,
      provider: body.provider,
      purpose: body.purpose,
      environment: body.environment,
      owner: body.owner,
      identityId: body.identityId || body.identity_id || null,
      riskScore: body.riskScore ?? body.risk_score ?? 20,
      status: body.status || 'Active',
    });

    if (!res.success || !res.agent) {
      return apiError(res.message || 'Failed to create AI agent.', 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'agent.created',
      entityType: 'ai_agent',
      entityId: res.agent.id,
      metadata: { name: res.agent.name, model: res.agent.model },
    });

    return apiSuccess(res.agent, 201);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to create AI agent.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

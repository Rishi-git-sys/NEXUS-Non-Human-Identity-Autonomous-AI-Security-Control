import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { mapAgentStatusToDB } from '@/lib/services/aiAgentService';

export async function GET() {
  try {
    const { organizationId } = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      return apiError(`Failed to fetch AI agents: ${error.message}`, 500);
    }

    return apiSuccess(data || []);
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
    const body = await req.json();

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return apiError('AI agent name is required.', 400);
    }

    const status = mapAgentStatusToDB(body.status || 'Active');
    const riskScore = typeof body.risk_score === 'number' ? Math.max(0, Math.min(100, body.risk_score)) : 0;

    const supabase = await createClient();

    const record = {
      organization_id: organizationId,
      name: body.name.trim(),
      model: body.model || 'gpt-4o',
      provider: body.provider || 'OpenAI',
      version: body.version || 'v1.0',
      status: status,
      risk_score: riskScore,
      owner_id: user.id,
      identity_id: body.identity_id || null,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    };

    const { data, error } = await supabase
      .from('ai_agents')
      .insert(record)
      .select()
      .single();

    if (error) {
      return apiError(`Failed to create AI agent: ${error.message}`, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'agent.created',
      entityType: 'ai_agent',
      entityId: data.id,
      metadata: { name: data.name, model: data.model },
    });

    return apiSuccess(data, 201);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to create AI agent.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

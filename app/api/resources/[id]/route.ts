import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { mapUIResourceTypeToDB } from '@/lib/services/resourceService';
import { Database } from '@/types/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { organizationId } = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return apiError(`Failed to fetch resource: ${error.message}`, 500);
    }

    if (!data) {
      return apiNotFound('Resource not found.');
    }

    return apiSuccess(data);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch resource.';

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

    const updates: Database['public']['Tables']['resources']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (body.name && typeof body.name === 'string') updates.name = body.name.trim();
    if (body.resource_type || body.type) {
      updates.resource_type = mapUIResourceTypeToDB(body.resource_type || body.type);
    }
    if (body.sensitivity || body.sensitivity_level) {
      updates.sensitivity = (body.sensitivity || body.sensitivity_level).toLowerCase();
    }
    if (body.metadata && typeof body.metadata === 'object') {
      updates.metadata = body.metadata as Database['public']['Tables']['resources']['Update']['metadata'];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('resources')
      .update(updates)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return apiError(`Failed to update resource: ${error.message}`, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'resource.updated',
      entityType: 'resource',
      entityId: data.id,
      metadata: updates as Record<string, unknown>,
    });

    return apiSuccess(data);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to update resource.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

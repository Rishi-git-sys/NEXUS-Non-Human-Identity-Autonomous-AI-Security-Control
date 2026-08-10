import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/auditLogger';
import { mapUIResourceTypeToDB } from '@/lib/services/resourceService';
import { Database } from '@/types/supabase';

export async function GET() {
  try {
    const { organizationId } = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      return apiError(`Failed to fetch resources: ${error.message}`, 500);
    }

    return apiSuccess(data || []);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch resources.';

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
      return apiError('Resource name is required.', 400);
    }

    const resourceType = mapUIResourceTypeToDB(body.resource_type || body.type || 'database');
    const sensitivity = (body.sensitivity || body.sensitivity_level || 'confidential').toLowerCase();

    const supabase = await createClient();

    const record: Database['public']['Tables']['resources']['Insert'] = {
      organization_id: organizationId,
      name: body.name.trim(),
      resource_type: resourceType,
      sensitivity: sensitivity,
      metadata: (body.metadata && typeof body.metadata === 'object' ? body.metadata : {}) as Database['public']['Tables']['resources']['Insert']['metadata'],
    };

    const { data, error } = await supabase
      .from('resources')
      .insert(record)
      .select()
      .single();

    if (error) {
      return apiError(`Failed to create resource: ${error.message}`, 400);
    }

    await writeAuditLog({
      organizationId,
      actorId: user.id,
      action: 'resource.created',
      entityType: 'resource',
      entityId: data.id,
      metadata: { name: data.name, resource_type: data.resource_type },
    });

    return apiSuccess(data, 201);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to create resource.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

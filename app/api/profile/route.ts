import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';

/**
 * GET /api/profile
 * Returns the authenticated user's resolved profile including organization_id.
 * This eliminates the need for browser-side direct queries to `profiles` and `organizations`.
 */
export async function GET() {
  try {
    const { user, profile, organizationId } = await requireAuth();

    return apiSuccess({
      id: user.id,
      email: user.email ?? '',
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      organization_id: organizationId,
    });
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to load profile.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

/**
 * PATCH /api/profile
 * Updates mutable profile fields (full_name, avatar_url) for the authenticated user.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { user, organizationId } = await requireAuth();

    const body = await req.json();

    const updates: Database['public']['Tables']['profiles']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.full_name === 'string') updates.full_name = body.full_name.trim();
    if (typeof body.avatar_url === 'string' || body.avatar_url === null)
      updates.avatar_url = body.avatar_url;

    if (Object.keys(updates).length === 1) {
      // Only updated_at — nothing meaningful to update
      return apiError('No valid fields provided for update.', 400);
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, full_name, avatar_url, role, organization_id')
      .single();

    if (error) {
      return apiError('Failed to update profile.', 500);
    }

    return apiSuccess({
      id: user.id,
      email: user.email ?? '',
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      role: data.role,
      organization_id: organizationId,
    });
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to update profile.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

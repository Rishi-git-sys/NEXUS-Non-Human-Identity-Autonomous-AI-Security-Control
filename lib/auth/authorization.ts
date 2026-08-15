import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { User } from '@supabase/supabase-js';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface AuthContextResult {
  user: User;
  profile: ProfileRow;
  organizationId: string;
  role: string;
}

/**
 * Validates the authenticated Supabase session and retrieves user profile from PostgreSQL.
 * Throws errors with HTTP status codes for unauthorized / unauthenticated access.
 */
export async function requireAuth(): Promise<AuthContextResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    const err = new Error('Unauthorized session.');
    (err as unknown as Record<string, unknown>).status = 401;
    throw err;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    const err = new Error('User profile not found.');
    (err as unknown as Record<string, unknown>).status = 401;
    throw err;
  }

  if (!profile.organization_id) {
    const err = new Error('User does not belong to a valid organization.');
    (err as unknown as Record<string, unknown>).status = 403;
    throw err;
  }

  return {
    user,
    profile,
    organizationId: profile.organization_id,
    role: profile.role || 'viewer',
  };
}

/**
 * Ensures that the authenticated user possesses one of the allowed roles.
 */
export async function requireRole(allowedRoles: string[]): Promise<AuthContextResult> {
  const authContext = await requireAuth();

  const userRole = (authContext.role || '').toLowerCase().trim();
  const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().trim());

  if (!normalizedAllowed.includes(userRole)) {
    const err = new Error(`Forbidden: Role '${authContext.role}' cannot perform this action.`);
    (err as unknown as Record<string, unknown>).status = 403;
    throw err;
  }

  return authContext;
}

/**
 * Enforces Administrator role for administrative actions.
 */
export async function requireAdmin(): Promise<AuthContextResult> {
  return requireRole(['admin']);
}

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
 * Automatically provisions missing profiles and assigns primary organization if unassigned.
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

  const { data: initialProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  let profile = initialProfile;

  // If user profile is missing (e.g. initial OAuth login), initialize it with default organization
  if (profileError || !profile) {
    try {
      const admin = createAdminClient();
      const { data: defaultOrg } = await admin
        .from('organizations')
        .select('id')
        .limit(1)
        .maybeSingle();

      const defaultOrgId = defaultOrg?.id || null;
      const userMeta = (user.user_metadata || {}) as Record<string, unknown>;
      const fullName = (userMeta.full_name as string) || (userMeta.name as string) || user.email?.split('@')[0] || 'Security Operator';
      const avatarUrl = (userMeta.avatar_url as string) || (userMeta.picture as string) || null;

      const { data: newProfile, error: createError } = await admin
        .from('profiles')
        .insert({
          id: user.id,
          full_name: fullName,
          avatar_url: avatarUrl,
          organization_id: defaultOrgId,
          role: 'viewer',
        })
        .select('*')
        .single();

      if (createError) {
        console.error('[requireAuth] Failed to initialize user profile:', createError.message);
      } else if (newProfile) {
        profile = newProfile;
      }
    } catch (e) {
      console.error('[requireAuth] Error during profile auto-initialization:', e);
    }
  }

  if (!profile) {
    const err = new Error('User profile not found.');
    (err as unknown as Record<string, unknown>).status = 401;
    throw err;
  }

  let organizationId = profile.organization_id;
  if (!organizationId) {
    try {
      const admin = createAdminClient();
      // Check if user is the creator of an organization
      const { data: createdOrg } = await admin
        .from('organizations')
        .select('id')
        .eq('created_by', user.id)
        .maybeSingle();

      if (createdOrg) {
        organizationId = createdOrg.id;
      } else {
        // Fall back to primary organization in control plane
        const { data: defaultOrg } = await admin
          .from('organizations')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (defaultOrg) {
          organizationId = defaultOrg.id;
        }
      }

      // Persist organization_id to user profile
      if (organizationId) {
        await admin.from('profiles').delete().eq('id', user.id);
        const { data: reinserted } = await admin
          .from('profiles')
          .insert({
            id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            organization_id: organizationId,
            role: profile.role || 'viewer',
            created_at: profile.created_at,
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (reinserted) {
          profile = reinserted;
        }
      }
    } catch (e) {
      console.error('[requireAuth] Error resolving/persisting organization_id:', e);
    }
  }

  if (!organizationId) {
    const err = new Error('User does not belong to a valid organization.');
    (err as unknown as Record<string, unknown>).status = 403;
    throw err;
  }

  return {
    user,
    profile: {
      ...profile,
      organization_id: organizationId,
    },
    organizationId,
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

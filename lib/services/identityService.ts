import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import {
  Identity,
  VALID_DB_IDENTITY_TYPES,
  DBIdentityType,
  VALID_DB_IDENTITY_STATUSES,
  DBIdentityStatus,
  mapUITypeToDB,
  mapDBTypeToUI,
  mapUIStatusToDB,
  mapDBStatusToUI,
} from '../types/identity';

export {
  VALID_DB_IDENTITY_TYPES,
  type DBIdentityType,
  VALID_DB_IDENTITY_STATUSES,
  type DBIdentityStatus,
  mapUITypeToDB,
  mapDBTypeToUI,
  mapUIStatusToDB,
  mapDBStatusToUI,
};

type IdentityRow = Database['public']['Tables']['identities']['Row'];

function mapRowToIdentity(row: IdentityRow): Identity {
  const meta = (typeof row.metadata === 'object' && row.metadata !== null) ? row.metadata as Record<string, unknown> : {};
  const nexusRisk = (meta.nexusRisk as Record<string, unknown>) || null;
  const riskFactorsRaw = nexusRisk && Array.isArray(nexusRisk.riskFactors) ? nexusRisk.riskFactors : meta.riskFactors;
  const mappedRiskFactors = Array.isArray(riskFactorsRaw) ? riskFactorsRaw : [];

  return {
    id: row.id,
    name: row.name,
    type: mapDBTypeToUI(row.identity_type),
    provider: (meta.provider as string) || 'AWS',
    environment: (meta.environment as string) || 'Production',
    riskScore: typeof row.risk_score === 'number' ? row.risk_score : 0,
    lastActive: row.last_seen_at || row.created_at,
    owner: (meta.owner as string) || row.owner_id || 'SecOps Team',
    createdAt: row.created_at,
    status: mapDBStatusToUI(row.status),
    credentialsCount: typeof meta.credentialsCount === 'number' ? meta.credentialsCount : 1,
    credentialAgeDays: typeof meta.credentialAgeDays === 'number' ? meta.credentialAgeDays : 0,
    accessBreadth: (meta.accessBreadth as Identity['accessBreadth']) || 'Medium',
    riskFactors: mappedRiskFactors,
    arn: meta.arn as string | undefined,
    awsType: (meta.awsType as string) || (meta.aws_type as string) || undefined,
    awsPath: (meta.path as string) || (meta.aws_path as string) || undefined,
    awsSecurity: meta.awsSecurity as Identity['awsSecurity'],
  };
}

export const identityService = {
  /**
   * Retrieves identities for the given organization_id from Supabase.
   */
  async getIdentities(organizationId: string): Promise<Identity[]> {
    if (!organizationId) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('identities')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching identities from Supabase:', error.message);
      throw error;
    }

    return (data || []).map(mapRowToIdentity);
  },

  /**
   * Retrieves a single identity by ID for the given organization_id.
   */
  async getIdentityById(organizationId: string, id: string): Promise<Identity | null> {
    if (!organizationId || !id) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('identities')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching identity by ID from Supabase:', error.message);
      throw error;
    }

    return data ? mapRowToIdentity(data) : null;
  },

  /**
   * Creates a new identity in Supabase PostgreSQL for the user's organization.
   * Maps UI identity types and statuses to valid database enum check constraint values.
   */
  async createIdentity(
    organizationId: string,
    payload: {
      name: string;
      type: string;
      status?: string;
      riskScore?: number;
      provider?: string;
      environment?: string;
      owner?: string;
    }
  ): Promise<{ success: boolean; message: string; identity?: Identity }> {
    if (!organizationId) {
      return { success: false, message: 'Organization context is required.' };
    }

    if (!payload.name.trim()) {
      return { success: false, message: 'Identity name is required.' };
    }

    const dbIdentityType = mapUITypeToDB(payload.type);
    if (!VALID_DB_IDENTITY_TYPES.includes(dbIdentityType)) {
      return { success: false, message: `Unsupported identity type: "${payload.type}".` };
    }

    const dbStatus = mapUIStatusToDB(payload.status || 'Active');
    if (!VALID_DB_IDENTITY_STATUSES.includes(dbStatus)) {
      return { success: false, message: `Unsupported identity status: "${payload.status}".` };
    }

    const newRecord = {
      organization_id: organizationId,
      name: payload.name.trim(),
      identity_type: dbIdentityType,
      status: dbStatus,
      risk_score: payload.riskScore ?? 25,
      last_seen_at: new Date().toISOString(),
      metadata: {
        provider: payload.provider || 'AWS',
        environment: payload.environment || 'Production',
        owner: payload.owner || 'SecOps Team',
        credentialsCount: 1,
        credentialAgeDays: 1,
        accessBreadth: 'Medium',
        riskFactors: ['Newly provisioned identity credential'],
      },
    };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('identities')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating identity in Supabase:', error.message);
      return { success: false, message: `Failed to create identity: ${error.message}` };
    }

    return {
      success: true,
      message: 'Identity created successfully.',
      identity: mapRowToIdentity(data),
    };
  },

  /**
   * Disables an identity in Supabase by setting status to 'suspended'.
   */
  async disableIdentity(organizationId: string, id: string): Promise<{ success: boolean; message: string; identity?: Identity }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid identity target.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('identities')
      .update({
        status: 'suspended',
        risk_score: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error disabling identity in Supabase:', error.message);
      return { success: false, message: `Failed to disable identity: ${error.message}` };
    }

    return {
      success: true,
      message: 'Identity disabled successfully.',
      identity: mapRowToIdentity(data),
    };
  },

  /**
   * Re-enables a disabled identity in Supabase by setting status to 'active'.
   */
  async enableIdentity(organizationId: string, id: string): Promise<{ success: boolean; message: string; identity?: Identity }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid identity target.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('identities')
      .update({
        status: 'active',
        risk_score: 25,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error enabling identity in Supabase:', error.message);
      return { success: false, message: `Failed to re-enable identity: ${error.message}` };
    }

    return {
      success: true,
      message: 'Identity re-enabled successfully.',
      identity: mapRowToIdentity(data),
    };
  },

  /**
   * Rotates credentials for an identity in Supabase by resetting credentialAgeDays in metadata.
   */
  async rotateCredential(organizationId: string, id: string): Promise<{ success: boolean; message: string; identity?: Identity }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid identity target.' };
    }

    const existing = await this.getIdentityById(organizationId, id);
    if (!existing) {
      return { success: false, message: 'Identity not found.' };
    }

    const updatedMetadata = {
      provider: existing.provider,
      environment: existing.environment,
      owner: existing.owner,
      credentialsCount: existing.credentialsCount,
      credentialAgeDays: 0,
      accessBreadth: existing.accessBreadth,
      riskFactors: existing.riskFactors.filter(
        f => {
          const str = typeof f === 'string' ? f : f.title;
          return !str.toLowerCase().includes('credential age') && !str.toLowerCase().includes('rotation');
        }
      ),
    };

    const newRisk = Math.max(10, Math.floor(existing.riskScore * 0.7));

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('identities')
      .update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: updatedMetadata as any,
        risk_score: newRisk,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error rotating identity credentials in Supabase:', error.message);
      return { success: false, message: `Failed to rotate credentials: ${error.message}` };
    }

    return {
      success: true,
      message: 'Credentials rotated successfully.',
      identity: mapRowToIdentity(data),
    };
  },

  /**
   * Revokes access permissions for an identity in Supabase by setting status to 'inactive'.
   */
  async revokeAccess(organizationId: string, id: string): Promise<{ success: boolean; message: string; identity?: Identity }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid identity target.' };
    }

    const existing = await this.getIdentityById(organizationId, id);
    if (!existing) {
      return { success: false, message: 'Identity not found.' };
    }

    const updatedMetadata = {
      provider: existing.provider,
      environment: existing.environment,
      owner: existing.owner,
      credentialsCount: existing.credentialsCount,
      credentialAgeDays: existing.credentialAgeDays,
      accessBreadth: 'Low',
      riskFactors: [],
    };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('identities')
      .update({
        status: 'inactive',
        risk_score: 10,
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error revoking access in Supabase:', error.message);
      return { success: false, message: `Failed to revoke access: ${error.message}` };
    }

    return {
      success: true,
      message: 'Access permissions revoked successfully.',
      identity: mapRowToIdentity(data),
    };
  },
};

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { Policy, PolicyCondition } from '../types/policy';
import { ActionDecision } from '@/types/nexus';

type PolicyRow = Database['public']['Tables']['policies']['Row'];

export const ALLOWED_DB_STATUSES = ['active', 'draft', 'disabled'] as const;
export type AllowedDBStatus = typeof ALLOWED_DB_STATUSES[number];

export function mapUIStatusToDB(statusLabel: string): AllowedDBStatus {
  const normalized = (statusLabel || '').toLowerCase().trim();
  if (normalized === 'active' || normalized === 'enabled') return 'active';
  if (normalized === 'draft') return 'draft';
  if (normalized === 'disabled' || normalized === 'inactive') return 'disabled';
  return 'active';
}

export function mapDBStatusToUI(dbStatus: string): Policy['status'] {
  const normalized = (dbStatus || '').toLowerCase().trim();
  switch (normalized) {
    case 'active':
      return 'Active';
    case 'draft':
      return 'Draft';
    case 'disabled':
    case 'inactive':
      return 'Inactive';
    default:
      return 'Active';
  }
}

export function mapUISeverityToDB(severityLabel: string): string {
  const normalized = (severityLabel || '').toLowerCase().trim();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return 'medium';
}

export function mapDBSeverityToUI(dbSeverity: string): Policy['severity'] {
  const normalized = (dbSeverity || '').toLowerCase().trim();
  switch (normalized) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return 'Medium';
  }
}

function mapRowToPolicy(row: PolicyRow, violationCount = 0): Policy {
  const rules = (typeof row.rules === 'object' && row.rules !== null) ? row.rules as Record<string, unknown> : {};

  return {
    id: row.id,
    name: row.name,
    description: row.description || 'No description provided.',
    scope: (rules.scope as string) || 'All Scopes',
    severity: mapDBSeverityToUI(row.severity),
    status: mapDBStatusToUI(row.status),
    lastUpdated: row.updated_at || row.created_at,
    violations: violationCount,
    conditions: Array.isArray(rules.conditions) ? (rules.conditions as PolicyCondition[]) : [],
    decision: (rules.decision as ActionDecision) || 'BLOCKED',
  };
}

export const policyService = {
  /**
   * Retrieves policies and their active violation counts for the user's organization from Supabase PostgreSQL.
   */
  async getPolicies(organizationId: string): Promise<Policy[]> {
    if (!organizationId) return [];

    // Fetch policies and policy_violations in parallel scoped to organization_id
    const supabase = await createClient();
    const [policiesRes, violationsRes] = await Promise.all([
      supabase
        .from('policies')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('policy_violations')
        .select('policy_id')
        .eq('organization_id', organizationId),
    ]);

    if (policiesRes.error) {
      console.error('Error fetching policies from Supabase:', policiesRes.error.message);
      throw policiesRes.error;
    }

    // Build violation count dictionary by policy_id
    const violationCounts: Record<string, number> = {};
    (violationsRes.data || []).forEach((v) => {
      if (v.policy_id) {
        violationCounts[v.policy_id] = (violationCounts[v.policy_id] || 0) + 1;
      }
    });

    return (policiesRes.data || []).map((p) => mapRowToPolicy(p, violationCounts[p.id] || 0));
  },

  /**
   * Retrieves a single policy by ID for the user's organization.
   */
  async getPolicyById(organizationId: string, id: string): Promise<Policy | null> {
    if (!organizationId || !id) return null;

    const supabase = await createClient();
    const [policyRes, violationsRes] = await Promise.all([
      supabase
        .from('policies')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('policy_violations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('policy_id', id),
    ]);

    if (policyRes.error) {
      console.error('Error fetching policy by ID from Supabase:', policyRes.error.message);
      throw policyRes.error;
    }

    if (!policyRes.data) return null;
    return mapRowToPolicy(policyRes.data, violationsRes.count || 0);
  },

  /**
   * Updates the status of a policy in Supabase after strict database constraint validation.
   */
  async updatePolicyStatus(
    organizationId: string,
    id: string,
    status: Policy['status'] | string
  ): Promise<{ success: boolean; message: string; policy?: Policy }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid target policy.' };
    }

    const dbStatus = mapUIStatusToDB(status);

    if (!ALLOWED_DB_STATUSES.includes(dbStatus)) {
      return { success: false, message: `Invalid policy status: '${status}'. Allowed values are 'active', 'draft', or 'disabled'.` };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('policies')
      .update({
        status: dbStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating policy status in Supabase:', error.message);
      return { success: false, message: `Failed to update policy status: ${error.message}` };
    }

    return {
      success: true,
      message: `Policy status updated to ${mapDBStatusToUI(data.status)}.`,
      policy: mapRowToPolicy(data),
    };
  },

  /**
   * Creates a new policy in Supabase PostgreSQL scoped to the user's organization.
   */
  async createPolicy(
    organizationId: string,
    userId: string | null,
    payload: {
      name: string;
      description: string;
      scope?: string;
      severity?: 'Low' | 'Medium' | 'High' | 'Critical';
      decision?: ActionDecision;
      status?: 'Active' | 'Inactive' | 'Draft';
      conditions?: PolicyCondition[];
    }
  ): Promise<{ success: boolean; message: string; policy?: Policy }> {
    if (!organizationId) {
      return { success: false, message: 'Organization context is required.' };
    }

    if (!payload.name.trim() || !payload.description.trim()) {
      return { success: false, message: 'Policy name and description are required.' };
    }

    const dbStatus = mapUIStatusToDB(payload.status || 'Active');
    const dbSeverity = mapUISeverityToDB(payload.severity || 'Medium');

    const rulesJson = {
      scope: payload.scope || 'All Scopes',
      decision: payload.decision || 'BLOCKED',
      conditions: payload.conditions || [],
    };

    const newRecord = {
      organization_id: organizationId,
      created_by: userId || null,
      name: payload.name.trim(),
      description: payload.description.trim(),
      status: dbStatus,
      severity: dbSeverity,
      rules: rulesJson as unknown as Database['public']['Tables']['policies']['Insert']['rules'],
    };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('policies')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating policy in Supabase:', error.message);
      return { success: false, message: `Failed to create policy: ${error.message}` };
    }

    return {
      success: true,
      message: 'Policy created successfully.',
      policy: mapRowToPolicy(data),
    };
  },

  /**
   * Updates an existing policy configuration in Supabase.
   */
  async updatePolicy(
    organizationId: string,
    id: string,
    updates: {
      name?: string;
      description?: string;
      scope?: string;
      severity?: 'Low' | 'Medium' | 'High' | 'Critical';
      decision?: ActionDecision;
      status?: 'Active' | 'Inactive' | 'Draft';
      conditions?: PolicyCondition[];
    }
  ): Promise<{ success: boolean; message: string; policy?: Policy }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid target policy.' };
    }

    const existing = await this.getPolicyById(organizationId, id);
    if (!existing) {
      return { success: false, message: 'Policy not found.' };
    }

    const updatePayload: Database['public']['Tables']['policies']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) updatePayload.name = updates.name.trim();
    if (updates.description) updatePayload.description = updates.description.trim();
    if (updates.status) updatePayload.status = mapUIStatusToDB(updates.status);
    if (updates.severity) updatePayload.severity = mapUISeverityToDB(updates.severity);

    const updatedRules = {
      scope: updates.scope !== undefined ? updates.scope : existing.scope,
      decision: updates.decision || existing.decision,
      conditions: updates.conditions || existing.conditions,
    };

    updatePayload.rules = updatedRules as unknown as Database['public']['Tables']['policies']['Update']['rules'];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('policies')
      .update(updatePayload)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating policy in Supabase:', error.message);
      return { success: false, message: `Failed to update policy: ${error.message}` };
    }

    return {
      success: true,
      message: 'Policy updated successfully.',
      policy: mapRowToPolicy(data),
    };
  },

  /**
   * Deletes a policy from Supabase.
   */
  async deletePolicy(organizationId: string, id: string): Promise<{ success: boolean; message: string }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid target policy.' };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('policies')
      .delete()
      .eq('organization_id', organizationId)
      .eq('id', id);

    if (error) {
      console.error('Error deleting policy from Supabase:', error.message);
      return { success: false, message: `Failed to delete policy: ${error.message}` };
    }

    return {
      success: true,
      message: 'Policy deleted successfully.',
    };
  },
};

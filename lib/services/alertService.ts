import { createAdminClient } from '@/lib/supabase/admin';
import { Database } from '@/types/supabase';
import { Alert } from '../types/alert';
import { ActionDecision } from '@/types/nexus';

export function mapUIStatusToDB(statusLabel: string): string {
  const normalized = (statusLabel || '').toLowerCase().trim();
  switch (normalized) {
    case 'open':
      return 'open';
    case 'acknowledged':
      return 'acknowledged';
    case 'investigating':
      return 'investigating';
    case 'resolved':
      return 'resolved';
    case 'dismissed':
      return 'dismissed';
    default:
      return 'open';
  }
}

export function mapDBStatusToUI(dbStatus: string): Alert['status'] {
  const normalized = (dbStatus || '').toLowerCase().trim();
  switch (normalized) {
    case 'open':
    case 'new': // legacy fallback
      return 'Open';
    case 'acknowledged':
      return 'Acknowledged';
    case 'investigating':
      return 'Investigating';
    case 'resolved':
      return 'Resolved';
    case 'dismissed':
      return 'Dismissed';
    default:
      return 'Open';
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

export function mapDBSeverityToUI(dbSeverity: string): Alert['severity'] {
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

interface JoinedAlertRow {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  alert_type: string;
  severity: string;
  status: string;
  identity_id: string | null;
  ai_agent_id: string | null;
  resource_id: string | null;
  metadata: unknown;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  identities?: { id: string; name: string; risk_score: number } | null;
  ai_agents?: { id: string; name: string; risk_score: number } | null;
  resources?: { id: string; name: string } | null;
}

function mapRowToAlert(row: JoinedAlertRow): Alert {
  const metadata = (typeof row.metadata === 'object' && row.metadata !== null)
    ? (row.metadata as Record<string, unknown>)
    : {};

  const actorName =
    row.ai_agents?.name ||
    row.identities?.name ||
    (metadata.actor_name as string) ||
    'System Identity';

  const resourceName =
    row.resources?.name ||
    (metadata.resource_name as string) ||
    'System Resource';

  const riskScore =
    row.ai_agents?.risk_score ??
    row.identities?.risk_score ??
    (metadata.risk_score as number) ??
    null;

  const decision = (metadata.decision as ActionDecision) || 'BLOCKED';

  return {
    id: row.id,
    title: row.title,
    severity: mapDBSeverityToUI(row.severity),
    riskScore,
    timestamp: row.created_at,
    decision,
    reason: row.description || 'No detailed reason provided.',
    agentId: row.ai_agent_id || (row.ai_agents?.id ?? undefined),
    identityId: row.identity_id || (row.identities?.id ?? undefined),
    status: mapDBStatusToUI(row.status),
    resource: resourceName,
    actor: actorName,
    recommendation: metadata.recommendation as string | undefined,
    provider: metadata.provider as string | undefined,
    awsType: metadata.awsType as string | undefined,
    arn: metadata.arn as string | undefined,
    acknowledgedAt: row.acknowledged_at || undefined,
    resolvedAt: row.resolved_at || undefined,
    acknowledgedBy: row.acknowledged_by || undefined,
  };
}

export interface GetAlertsOptions {
  status?: string;
  severity?: string;
  identityId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedAlerts {
  data: Alert[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const alertService = {
  /**
   * Retrieves alerts for the user's organization securely via admin client.
   */
  async getAlerts(
    organizationId: string,
    options: GetAlertsOptions = {}
  ): Promise<PaginatedAlerts> {
    if (!organizationId) {
      return { data: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 0 } };
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    let query = supabase
      .from('alerts')
      .select(`
        *,
        identities:identity_id (id, name, risk_score),
        ai_agents:ai_agent_id (id, name, risk_score),
        resources:resource_id (id, name)
      `, { count: 'exact' })
      .eq('organization_id', organizationId);

    if (options.status && options.status !== 'all') {
      if (options.status === 'active') {
        query = query.in('status', ['open', 'acknowledged', 'investigating']);
      } else {
        query = query.eq('status', mapUIStatusToDB(options.status));
      }
    }

    if (options.severity && options.severity !== 'all') {
      query = query.eq('severity', mapUISeverityToDB(options.severity));
    }

    if (options.identityId) {
      query = query.eq('identity_id', options.identityId);
    }

    if (options.search) {
      query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching alerts from Supabase:', error.message);
      throw error;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: ((data || []) as unknown as JoinedAlertRow[]).map(mapRowToAlert),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      }
    };
  },

  /**
   * Retrieves a single alert by ID for the user's organization.
   */
  async getAlertById(organizationId: string, id: string): Promise<Alert | null> {
    if (!organizationId || !id) return null;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        *,
        identities:identity_id (id, name, risk_score),
        ai_agents:ai_agent_id (id, name, risk_score),
        resources:resource_id (id, name)
      `)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching alert by ID from Supabase:', error.message);
      throw error;
    }

    if (!data) return null;
    return mapRowToAlert(data as unknown as JoinedAlertRow);
  },

  /**
   * Gets the total count of active (unresolved) alerts for the user's organization.
   */
  async getActiveCount(organizationId: string): Promise<number> {
    if (!organizationId) return 0;

    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('status', ['open', 'acknowledged', 'investigating']);

    if (error) {
      console.error('Error querying active alert count from Supabase:', error.message);
      return 0;
    }

    return count || 0;
  },

  /**
   * Updates an alert's status securely enforcing a strict state machine.
   */
  async updateAlertStatus(
    organizationId: string,
    userId: string | null,
    id: string,
    status: Alert['status']
  ): Promise<{ success: boolean; message: string; alert?: Alert }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid target alert.' };
    }

    const supabase = createAdminClient();

    // 1. Fetch current alert state to enforce state machine
    const { data: currentAlert, error: fetchError } = await supabase
      .from('alerts')
      .select('status, acknowledged_at, acknowledged_by, resolved_at')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !currentAlert) {
      return { success: false, message: 'Alert not found or access denied.' };
    }

    const currentDBStatus = currentAlert.status;
    const targetDBStatus = mapUIStatusToDB(status);

    // Enforce state transitions
    const validTransitions: Record<string, string[]> = {
      'open': ['acknowledged', 'investigating', 'resolved', 'dismissed'],
      'acknowledged': ['investigating', 'resolved', 'dismissed'],
      'investigating': ['resolved', 'dismissed'],
      'resolved': [], // terminal
      'dismissed': [] // terminal
    };

    // If no state change, just return
    if (currentDBStatus === targetDBStatus) {
       const existingAlert = await this.getAlertById(organizationId, id);
       return { success: true, message: 'Alert status unchanged.', alert: existingAlert || undefined };
    }

    const allowedNext = validTransitions[currentDBStatus] || [];
    if (!allowedNext.includes(targetDBStatus)) {
      return { success: false, message: `Invalid transition from ${currentDBStatus} to ${targetDBStatus}.` };
    }

    const updatePayload: Database['public']['Tables']['alerts']['Update'] = {
      status: targetDBStatus,
    };

    const now = new Date().toISOString();

    if (targetDBStatus === 'acknowledged') {
      updatePayload.acknowledged_at = now;
      if (userId) updatePayload.acknowledged_by = userId;
    } else if (targetDBStatus === 'investigating') {
      // Preserve existing acknowledgement, do not overwrite
      updatePayload.acknowledged_at = currentAlert.acknowledged_at;
      updatePayload.acknowledged_by = currentAlert.acknowledged_by;
    } else if (targetDBStatus === 'resolved') {
      updatePayload.resolved_at = now;
    } else if (targetDBStatus === 'open') {
      updatePayload.resolved_at = null;
      updatePayload.acknowledged_at = null;
      updatePayload.acknowledged_by = null;
    } else if (targetDBStatus === 'dismissed') {
      // preserve historical timestamps
    }

    const { data, error } = await supabase
      .from('alerts')
      .update(updatePayload)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select(`
        *,
        identities:identity_id (id, name, risk_score),
        ai_agents:ai_agent_id (id, name, risk_score),
        resources:resource_id (id, name)
      `)
      .single();

    if (error) {
      console.error('Error updating alert status in Supabase:', error.message);
      return { success: false, message: `Failed to update alert status: ${error.message}` };
    }

    return {
      success: true,
      message: `Alert marked as ${status} successfully.`,
      alert: mapRowToAlert(data as unknown as JoinedAlertRow),
    };
  },
};

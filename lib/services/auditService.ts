import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { AuditEvent } from '../types/audit';
import { ActionDecision } from '@/types/nexus';

type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/**
 * Recursively redacts sensitive credential fields from metadata objects.
 */
export function sanitizeMetadata(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  if (Array.isArray(data)) return data.map(sanitizeMetadata);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('private_key')
    ) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeMetadata(value);
    }
  }
  return sanitized;
}

export function formatActionDisplay(action: string): string {
  if (!action) return 'Unknown Action';
  return action
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapRowToAuditEvent(row: AuditLogRow, profilesMap: Record<string, ProfileRow>): AuditEvent {
  const rawMetadata = (typeof row.metadata === 'object' && row.metadata !== null)
    ? (row.metadata as Record<string, unknown>)
    : {};

  const sanitizedMeta = sanitizeMetadata(rawMetadata) as Record<string, unknown>;

  const actorProfile = row.actor_id ? profilesMap[row.actor_id] : null;
  const actorName =
    actorProfile?.full_name ||
    (rawMetadata.actor_name as string) ||
    (rawMetadata.actor as string) ||
    (row.actor_id ? `User (${row.actor_id.substring(0, 8)})` : 'System');

  const resourceName =
    (rawMetadata.resource as string) ||
    (rawMetadata.resource_name as string) ||
    (row.entity_type ? `${row.entity_type}:${row.entity_id || 'global'}` : 'Global Boundary');

  const environment = (rawMetadata.environment as string) || 'Production';
  const decision = (rawMetadata.decision as ActionDecision) || 'ALLOWED';
  const riskScore = (rawMetadata.risk_score as number) ?? 15;
  const ipAddress = (rawMetadata.ip_address as string) || (rawMetadata.ip as string) || undefined;
  const reason = (rawMetadata.reason as string) || (rawMetadata.description as string) || undefined;

  return {
    id: row.id,
    timestamp: row.created_at,
    actor: actorName,
    actorId: row.actor_id || 'system',
    action: formatActionDisplay(row.action),
    resource: resourceName,
    environment,
    decision,
    riskScore,
    ipAddress,
    reason,
    metadata: sanitizedMeta,
  };
}

export const auditService = {
  /**
   * Retrieves audit logs for the authenticated organization from Supabase PostgreSQL.
   */
  async getAuditEvents(organizationId: string): Promise<AuditEvent[]> {
    if (!organizationId) return [];

    // Fetch audit logs and organization profiles in parallel without N+1 requests
    const supabase = await createClient();
    const [auditRes, profilesRes] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', organizationId),
    ]);

    if (auditRes.error) {
      console.error('Error fetching audit_logs from Supabase:', auditRes.error.message);
      throw auditRes.error;
    }

    const profilesMap: Record<string, ProfileRow> = {};
    (profilesRes.data || []).forEach((p) => {
      profilesMap[p.id] = p;
    });

    return (auditRes.data || []).map((row) => mapRowToAuditEvent(row, profilesMap));
  },

  /**
   * Retrieves a single audit log event by ID.
   */
  async getAuditEventById(organizationId: string, id: string): Promise<AuditEvent | null> {
    if (!organizationId || !id) return null;

    const supabase = await createClient();
    const [auditRes, profilesRes] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', organizationId),
    ]);

    if (auditRes.error) {
      console.error('Error fetching audit event by ID from Supabase:', auditRes.error.message);
      throw auditRes.error;
    }

    if (!auditRes.data) return null;

    const profilesMap: Record<string, ProfileRow> = {};
    (profilesRes.data || []).forEach((p) => {
      profilesMap[p.id] = p;
    });

    return mapRowToAuditEvent(auditRes.data, profilesMap);
  },
};

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';

export interface AuditLogOptions {
  organizationId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Recursively redacts sensitive keys from audit log metadata before insertion.
 */
export function sanitizeAuditMetadata(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  if (Array.isArray(data)) return data.map(sanitizeAuditMetadata);

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
      sanitized[key] = sanitizeAuditMetadata(value);
    }
  }
  return sanitized;
}

/**
 * Inserts an immutable audit record into public.audit_logs from the server.
 */
export async function writeAuditLog(options: AuditLogOptions): Promise<void> {
  try {
    const supabase = await createClient();
    const sanitizedMeta = options.metadata ? sanitizeAuditMetadata(options.metadata) : {};

    const record = {
      organization_id: options.organizationId,
      actor_id: options.actorId || null,
      action: options.action,
      entity_type: options.entityType,
      entity_id: options.entityId || null,
      metadata: sanitizedMeta as Database['public']['Tables']['audit_logs']['Insert']['metadata'],
    };

    const { error } = await supabase.from('audit_logs').insert(record);

    if (error) {
      console.error('Failed to write audit log to Supabase:', error.message);
    }
  } catch (err) {
    console.error('Unexpected error writing audit log:', err);
  }
}

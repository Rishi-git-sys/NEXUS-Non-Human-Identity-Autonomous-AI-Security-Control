import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { ResourceItem, ResourceType, ResourceSensitivity, ResourceStatus } from '../types/resource';

type ResourceRow = Database['public']['Tables']['resources']['Row'];

/**
 * Converts UI resource type labels to database values.
 */
export function mapUIResourceTypeToDB(typeLabel: string): string {
  const normalized = (typeLabel || '').toLowerCase().trim();
  if (normalized === 'database' || normalized === 'db') return 'database';
  if (normalized === 'api' || normalized === 'api gateway') return 'api';
  if (normalized === 'cloud role' || normalized === 'cloud_role' || normalized === 'iam role') return 'cloud_role';
  if (normalized === 'application' || normalized === 'app') return 'application';
  if (normalized === 'storage' || normalized === 's3 bucket' || normalized === 'bucket') return 'storage';
  if (normalized === 'service' || normalized === 'microservice') return 'service';
  return 'other';
}

/**
 * Converts database resource type values to UI labels.
 */
export function mapDBResourceTypeToUI(dbType: string): ResourceType {
  const normalized = (dbType || '').toLowerCase().trim();
  switch (normalized) {
    case 'database':
      return 'Database';
    case 'api':
      return 'API';
    case 'cloud_role':
      return 'Cloud Role';
    case 'application':
      return 'Application';
    case 'storage':
      return 'Storage';
    case 'service':
      return 'Service';
    default:
      return 'Other';
  }
}

/**
 * Converts UI sensitivity labels to database values.
 */
export function mapUISensitivityToDB(sensitivityLabel: string): string {
  const normalized = (sensitivityLabel || '').toLowerCase().trim();
  if (normalized === 'public') return 'public';
  if (normalized === 'internal') return 'internal';
  if (normalized === 'confidential') return 'confidential';
  if (normalized === 'restricted' || normalized === 'critical') return 'restricted';
  return 'internal';
}

/**
 * Converts database sensitivity values to UI labels.
 */
export function mapDBSensitivityToUI(dbSensitivity: string): ResourceSensitivity {
  const normalized = (dbSensitivity || '').toLowerCase().trim();
  switch (normalized) {
    case 'public':
      return 'Public';
    case 'internal':
      return 'Internal';
    case 'confidential':
      return 'Confidential';
    case 'restricted':
      return 'Restricted';
    default:
      return 'Internal';
  }
}

/**
 * Converts UI resource status labels to database values.
 */
export function mapUIResourceStatusToDB(statusLabel: string): string {
  const normalized = (statusLabel || '').toLowerCase().trim();
  if (normalized === 'active') return 'active';
  if (normalized === 'inactive') return 'inactive';
  if (normalized === 'deprecated') return 'deprecated';
  if (normalized === 'restricted' || normalized === 'disabled' || normalized === 'suspended') return 'restricted';
  return 'active';
}

/**
 * Converts database status values to UI labels.
 */
export function mapDBResourceStatusToUI(dbStatus: string): ResourceStatus {
  const normalized = (dbStatus || '').toLowerCase().trim();
  switch (normalized) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'deprecated':
      return 'Deprecated';
    case 'restricted':
    case 'suspended':
      return 'Restricted';
    default:
      return 'Active';
  }
}

function mapRowToResource(row: ResourceRow): ResourceItem {
  const meta = (typeof row.metadata === 'object' && row.metadata !== null) ? row.metadata as Record<string, unknown> : {};

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    resourceType: mapDBResourceTypeToUI(row.resource_type),
    sensitivity: mapDBSensitivityToUI(row.sensitivity),
    status: mapDBResourceStatusToUI(row.status),
    owner: (meta.owner as string) || 'SecOps Team',
    environment: (meta.environment as string) || 'Production',
    riskScore: typeof meta.riskScore === 'number' ? meta.riskScore : (row.sensitivity === 'restricted' ? 85 : row.sensitivity === 'confidential' ? 65 : 25),
    lastAccessedAt: (meta.lastAccessedAt as string) || row.updated_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: meta,
  };
}

export const resourceService = {
  /**
   * Retrieves all resources for the user's organization from Supabase PostgreSQL.
   */
  async getResources(organizationId: string): Promise<ResourceItem[]> {
    if (!organizationId) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching resources from Supabase:', error.message);
      throw error;
    }

    return (data || []).map(mapRowToResource);
  },

  /**
   * Retrieves a single resource by ID for the user's organization.
   */
  async getResourceById(organizationId: string, id: string): Promise<ResourceItem | null> {
    if (!organizationId || !id) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching resource by ID from Supabase:', error.message);
      throw error;
    }

    return data ? mapRowToResource(data) : null;
  },

  /**
   * Registers a new target resource in Supabase PostgreSQL scoped to user's organization.
   */
  async createResource(
    organizationId: string,
    payload: {
      name: string;
      resourceType?: string;
      sensitivity?: string;
      status?: string;
      owner?: string;
      environment?: string;
      riskScore?: number;
      description?: string;
    }
  ): Promise<{ success: boolean; message: string; resource?: ResourceItem }> {
    if (!organizationId) {
      return { success: false, message: 'Organization context is required.' };
    }

    if (!payload.name.trim()) {
      return { success: false, message: 'Resource name is required.' };
    }

    const dbResourceType = mapUIResourceTypeToDB(payload.resourceType || 'Database');
    const dbSensitivity = mapUISensitivityToDB(payload.sensitivity || 'Confidential');
    const dbStatus = mapUIResourceStatusToDB(payload.status || 'Active');

    const newRecord = {
      organization_id: organizationId,
      name: payload.name.trim(),
      resource_type: dbResourceType,
      sensitivity: dbSensitivity,
      status: dbStatus,
      metadata: {
        owner: payload.owner || 'SecOps Team',
        environment: payload.environment || 'Production',
        riskScore: payload.riskScore ?? (dbSensitivity === 'restricted' ? 90 : 35),
        description: payload.description || `${payload.name} enterprise asset`,
        lastAccessedAt: new Date().toISOString(),
      },
    };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resources')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating resource in Supabase:', error.message);
      return { success: false, message: `Failed to register resource: ${error.message}` };
    }

    return {
      success: true,
      message: 'Resource registered successfully.',
      resource: mapRowToResource(data),
    };
  },

  /**
   * Updates an existing resource in Supabase PostgreSQL scoped to user's organization.
   */
  async updateResource(
    organizationId: string,
    id: string,
    updates: {
      name?: string;
      resourceType?: string;
      sensitivity?: string;
      status?: string;
      owner?: string;
      environment?: string;
      riskScore?: number;
      description?: string;
    }
  ): Promise<{ success: boolean; message: string; resource?: ResourceItem }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid target resource.' };
    }

    const existing = await this.getResourceById(organizationId, id);
    if (!existing) {
      return { success: false, message: 'Resource not found.' };
    }

    const updatePayload: Database['public']['Tables']['resources']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) updatePayload.name = updates.name.trim();
    if (updates.resourceType) updatePayload.resource_type = mapUIResourceTypeToDB(updates.resourceType);
    if (updates.sensitivity) updatePayload.sensitivity = mapUISensitivityToDB(updates.sensitivity);
    if (updates.status) updatePayload.status = mapUIResourceStatusToDB(updates.status);

    const updatedMetadata = {
      ...existing.metadata,
      owner: updates.owner || existing.owner,
      environment: updates.environment || existing.environment,
      riskScore: typeof updates.riskScore === 'number' ? updates.riskScore : existing.riskScore,
      description: updates.description || (existing.metadata.description as string) || '',
    };

    updatePayload.metadata = updatedMetadata as unknown as Database['public']['Tables']['resources']['Update']['metadata'];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resources')
      .update(updatePayload)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating resource in Supabase:', error.message);
      return { success: false, message: `Failed to update resource: ${error.message}` };
    }

    return {
      success: true,
      message: 'Resource updated successfully.',
      resource: mapRowToResource(data),
    };
  },
};

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { Agent, AgentCapability, RiskBreakdown } from '../types/agent';

type AIAgentRow = Database['public']['Tables']['ai_agents']['Row'];

export const VALID_DB_AGENT_STATUSES = ['active', 'inactive', 'suspended', 'unknown'] as const;

export function mapAgentStatusToDB(statusLabel: string): string {
  const normalized = (statusLabel || '').toLowerCase().trim();
  if (normalized === 'active' || normalized === 'allowed') return 'active';
  if (normalized === 'inactive' || normalized === 'idle') return 'inactive';
  if (normalized === 'suspended' || normalized === 'disabled' || normalized === 'frozen') return 'suspended';
  if (normalized === 'unknown') return 'unknown';
  return 'active';
}

export function mapDBStatusToAgentUI(dbStatus: string): Agent['status'] {
  const normalized = (dbStatus || '').toLowerCase().trim();
  switch (normalized) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Idle';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Active';
  }
}

function mapRowToAgent(row: AIAgentRow): Agent {
  const meta = (typeof row.metadata === 'object' && row.metadata !== null) ? row.metadata as Record<string, unknown> : {};

  const capabilities = Array.isArray(meta.capabilities) ? meta.capabilities as AgentCapability[] : [];
  const connectedSystems = Array.isArray(meta.connectedSystems) ? meta.connectedSystems as string[] : ['AWS Cloud API', 'VectorDB Engine'];
  const riskBreakdown = (typeof meta.riskBreakdown === 'object' && meta.riskBreakdown !== null) ? meta.riskBreakdown as RiskBreakdown : {
    permissionRisk: Math.min(100, Math.round((row.risk_score || 0) * 0.9)),
    behaviorRisk: Math.min(100, Math.round((row.risk_score || 0) * 0.8)),
    credentialRisk: Math.min(100, Math.round((row.risk_score || 0) * 0.7)),
    exposureRisk: Math.min(100, Math.round((row.risk_score || 0) * 0.85)),
  };

  return {
    id: row.id,
    name: row.name,
    purpose: (meta.purpose as string) || `Autonomous AI Agent executing ${row.model || 'LLM'} workloads.`,
    model: row.model || 'GPT-4o / Claude-3.5',
    environment: (meta.environment as string) || 'Production',
    riskScore: typeof row.risk_score === 'number' ? row.risk_score : 0,
    status: mapDBStatusToAgentUI(row.status),
    owner: (meta.owner as string) || row.owner_id || 'SecOps Team',
    lastActive: row.last_seen_at || row.created_at,
    connectedSystems,
    permissionsCount: typeof meta.permissionsCount === 'number' ? meta.permissionsCount : connectedSystems.length * 3,
    capabilities,
    riskBreakdown,
  };
}

export const aiAgentService = {
  /**
   * Retrieves all AI agents for the given organization_id from Supabase PostgreSQL.
   */
  async getAIAgents(organizationId: string): Promise<Agent[]> {
    if (!organizationId) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching AI agents from Supabase:', error.message);
      throw error;
    }

    return (data || []).map(mapRowToAgent);
  },

  /**
   * Retrieves a single AI agent by ID for the given organization_id.
   */
  async getAIAgentById(organizationId: string, id: string): Promise<Agent | null> {
    if (!organizationId || !id) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching AI agent by ID from Supabase:', error.message);
      throw error;
    }

    return data ? mapRowToAgent(data) : null;
  },

  /**
   * Creates a new AI agent in Supabase PostgreSQL scoped to user's organization.
   */
  async createAIAgent(
    organizationId: string,
    payload: {
      name: string;
      model?: string;
      provider?: string;
      purpose?: string;
      environment?: string;
      owner?: string;
      identityId?: string | null;
      riskScore?: number;
      status?: string;
    }
  ): Promise<{ success: boolean; message: string; agent?: Agent }> {
    if (!organizationId) {
      return { success: false, message: 'Organization context is required.' };
    }

    if (!payload.name.trim()) {
      return { success: false, message: 'Agent name is required.' };
    }

    const dbStatus = mapAgentStatusToDB(payload.status || 'Active');

    const newRecord = {
      organization_id: organizationId,
      name: payload.name.trim(),
      model: payload.model || 'GPT-4o',
      provider: payload.provider || 'OpenAI',
      version: '1.0.0',
      status: dbStatus,
      risk_score: payload.riskScore ?? 20,
      identity_id: payload.identityId || null,
      last_seen_at: new Date().toISOString(),
      metadata: {
        purpose: payload.purpose || 'Autonomous workload execution agent',
        environment: payload.environment || 'Production',
        owner: payload.owner || 'SecOps Team',
        connectedSystems: ['AWS Cloud API', 'VectorDB Engine'],
        permissionsCount: 4,
        capabilities: [
          {
            id: 'cap_1',
            capability: 'Read S3 Bucket',
            resource: 's3-finance-bucket',
            accessLevel: 'Read',
            decision: 'ALLOWED',
            reason: 'Standard authorized document reading scope',
          },
        ],
        riskBreakdown: {
          permissionRisk: 15,
          behaviorRisk: 10,
          credentialRisk: 20,
          exposureRisk: 15,
        },
      },
    };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ai_agents')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating AI agent in Supabase:', error.message);
      return { success: false, message: `Failed to register AI agent: ${error.message}` };
    }

    return {
      success: true,
      message: 'AI Agent registered successfully.',
      agent: mapRowToAgent(data),
    };
  },

  /**
   * Freezes an AI agent by updating status to 'suspended'.
   */
  async freezeAgent(organizationId: string, id: string): Promise<{ success: boolean; message: string; agent?: Agent }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid target agent.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ai_agents')
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
      console.error('Error freezing AI agent in Supabase:', error.message);
      return { success: false, message: `Failed to freeze agent: ${error.message}` };
    }

    return {
      success: true,
      message: 'AI agent frozen successfully.',
      agent: mapRowToAgent(data),
    };
  },

  /**
   * Unfreezes / reactivates an AI agent by updating status to 'active'.
   */
  async unfreezeAgent(organizationId: string, id: string): Promise<{ success: boolean; message: string; agent?: Agent }> {
    if (!organizationId || !id) {
      return { success: false, message: 'Invalid target agent.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ai_agents')
      .update({
        status: 'active',
        risk_score: 20,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error unfreezing AI agent in Supabase:', error.message);
      return { success: false, message: `Failed to reactivate agent: ${error.message}` };
    }

    return {
      success: true,
      message: 'AI agent reactivated successfully.',
      agent: mapRowToAgent(data),
    };
  },
};

export const agentService = aiAgentService;

import { createAdminClient } from '@/lib/supabase/admin';
import { Database } from '@/types/supabase';
import { identityRiskService } from '@/lib/services/identityRiskService';
import { Agent } from '@/lib/types/agent';
import {
  SecurityFinding,
  SecurityFindingsFilterOptions,
  SecurityFindingsResponse,
} from './types';
import { normalizeIdentityRiskFactors } from './findingNormalizer';
import { detectAgentFindings } from './agentDetectors';

type IdentityRow = Database['public']['Tables']['identities']['Row'];
type AIAgentRow = Database['public']['Tables']['ai_agents']['Row'];

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const findingService = {
  /**
   * Generates normalized security findings for an individual identity row.
   * Leverages identityRiskService as the single authoritative identity risk engine.
   */
  getIdentityFindings(
    organizationId: string,
    identity: IdentityRow
  ): SecurityFinding[] {
    if (!organizationId || !identity || !identity.id) {
      return [];
    }

    const calculatedRisk = identityRiskService.calculateRisk(identity);
    return normalizeIdentityRiskFactors(organizationId, identity, calculatedRisk);
  },

  /**
   * Generates normalized security findings for an individual AI Agent.
   * Deterministically evaluates real capability data without fabricating findings.
   */
  getAgentFindings(
    organizationId: string,
    agent: AIAgentRow | Agent
  ): SecurityFinding[] {
    if (!organizationId || !agent || !agent.id) {
      return [];
    }

    return detectAgentFindings(organizationId, agent);
  },

  /**
   * Aggregates, deduplicates, filters, and paginates all security findings
   * across identities and AI agents for a strictly authorized organization.
   */
  async getAllFindings(
    organizationId: string,
    options?: SecurityFindingsFilterOptions
  ): Promise<SecurityFindingsResponse> {
    if (!organizationId) {
      return {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        },
      };
    }

    const supabase = createAdminClient();
    const shouldFetchIdentities =
      !options?.subjectType || options.subjectType.toLowerCase() === 'identity';
    const shouldFetchAgents =
      !options?.subjectType || options.subjectType.toLowerCase() === 'ai_agent';

    const identityPromise = shouldFetchIdentities
      ? (async () => {
          let query = supabase
            .from('identities')
            .select('*')
            .eq('organization_id', organizationId);

          if (options?.subjectId && options.subjectType?.toLowerCase() === 'identity') {
            query = query.eq('id', options.subjectId);
          }

          const { data, error } = await query;
          if (error) {
            console.error('[findingService] Error fetching identities:', error.message);
            return [];
          }
          return (data || []) as IdentityRow[];
        })()
      : Promise.resolve([] as IdentityRow[]);

    const agentPromise = shouldFetchAgents
      ? (async () => {
          let query = supabase
            .from('ai_agents')
            .select('*')
            .eq('organization_id', organizationId);

          if (options?.subjectId && options.subjectType?.toLowerCase() === 'ai_agent') {
            query = query.eq('id', options.subjectId);
          }

          const { data, error } = await query;
          if (error) {
            console.error('[findingService] Error fetching AI agents:', error.message);
            return [];
          }
          return (data || []) as AIAgentRow[];
        })()
      : Promise.resolve([] as AIAgentRow[]);

    const [identities, agents] = await Promise.all([identityPromise, agentPromise]);

    // 1. Generate findings
    const allFindings: SecurityFinding[] = [];

    for (const identity of identities) {
      const identityFindings = this.getIdentityFindings(organizationId, identity);
      allFindings.push(...identityFindings);
    }

    for (const agent of agents) {
      const agentFindings = this.getAgentFindings(organizationId, agent);
      allFindings.push(...agentFindings);
    }

    // 2. Deduplicate findings by fingerprint
    const deduplicatedMap = new Map<string, SecurityFinding>();
    for (const finding of allFindings) {
      if (!deduplicatedMap.has(finding.fingerprint)) {
        deduplicatedMap.set(finding.fingerprint, finding);
      }
    }

    let findings = Array.from(deduplicatedMap.values());

    // 3. Apply optional filters
    if (options?.severity) {
      const targetSeverity = options.severity.toUpperCase().trim();
      findings = findings.filter(
        (f) => f.severity.toUpperCase() === targetSeverity
      );
    }

    if (options?.category) {
      const targetCategory = options.category.toUpperCase().trim();
      findings = findings.filter(
        (f) => f.category.toUpperCase() === targetCategory
      );
    }

    if (options?.subjectType) {
      const targetType = options.subjectType.toLowerCase().trim();
      findings = findings.filter(
        (f) => f.subjectType.toLowerCase() === targetType
      );
    }

    if (options?.subjectId) {
      findings = findings.filter((f) => f.subjectId === options.subjectId);
    }

    // 4. Deterministic sorting: Highest severity first, then risk contribution desc, then code asc
    findings.sort((a, b) => {
      const weightA = SEVERITY_WEIGHT[a.severity] || 0;
      const weightB = SEVERITY_WEIGHT[b.severity] || 0;
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      if (b.riskContribution !== a.riskContribution) {
        return b.riskContribution - a.riskContribution;
      }
      return a.code.localeCompare(b.code);
    });

    // 5. Pagination
    const total = findings.length;
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 50));
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const paginatedData = findings.slice(offset, offset + limit);

    return {
      data: paginatedData,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },
};

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { mapDBTypeToUI, mapDBStatusToUI } from './identityService';
import { mapDBStatusToAgentUI } from './aiAgentService';
import { mapDBResourceTypeToUI, mapDBResourceStatusToUI } from './resourceService';

type RelationshipRow = Database['public']['Tables']['access_relationships']['Row'];
type IdentityRow = Database['public']['Tables']['identities']['Row'];
type AIAgentRow = Database['public']['Tables']['ai_agents']['Row'];
type ResourceRow = Database['public']['Tables']['resources']['Row'];

import { GraphNode, GraphEdge, AccessGraphData } from '../types/access';

export type { GraphNode, GraphEdge, AccessGraphData };

export const accessGraphService = {
  /**
   * Retrieves the access relationship topology graph for the user's organization.
   * Resolves nodes from public.identities, public.ai_agents, and public.resources,
   * and edges from public.access_relationships.
   */
  async getAccessGraph(organizationId: string): Promise<AccessGraphData> {
    if (!organizationId) {
      return { nodes: [], edges: [], totalRelationships: 0 };
    }

    // Fetch all related entities in parallel scoped to organization_id
    const supabase = await createClient();
    const [relationshipsRes, identitiesRes, agentsRes, resourcesRes] = await Promise.all([
      supabase.from('access_relationships').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('identities').select('*').eq('organization_id', organizationId),
      supabase.from('ai_agents').select('*').eq('organization_id', organizationId),
      supabase.from('resources').select('*').eq('organization_id', organizationId),
    ]);

    if (relationshipsRes.error) {
      console.error('Error fetching access relationships from Supabase:', relationshipsRes.error.message);
      throw relationshipsRes.error;
    }

    const relRows: RelationshipRow[] = relationshipsRes.data || [];
    const identityRows: IdentityRow[] = identitiesRes.data || [];
    const agentRows: AIAgentRow[] = agentsRes.data || [];
    const resourceRows: ResourceRow[] = resourcesRes.data || [];

    const nodesMap = new Map<string, GraphNode>();
    const edgesList: GraphEdge[] = [];

    // Helper map index counters for 5-column layout
    let col0Count = 0; // Identities
    let col1Count = 0; // Agents
    let col2Count = 0; // Applications / APIs
    let col3Count = 0; // Databases
    let col4Count = 0; // Storage / Resources

    // 1. Convert Identities to Column 0 Nodes
    identityRows.forEach((idRow) => {
      const meta = (typeof idRow.metadata === 'object' && idRow.metadata !== null) ? idRow.metadata as Record<string, unknown> : {};
      nodesMap.set(idRow.id, {
        id: idRow.id,
        label: idRow.name,
        type: 'Identity',
        riskScore: typeof idRow.risk_score === 'number' ? idRow.risk_score : 0,
        status: mapDBStatusToUI(idRow.status),
        description: `${mapDBTypeToUI(idRow.identity_type)} owned by ${(meta.owner as string) || idRow.owner_id || 'SecOps Team'}`,
        column: 0,
        x: 80,
        y: 80 + col0Count * 110,
        metadata: meta,
      });
      col0Count++;
    });

    // 2. Convert AI Agents to Column 1 Nodes
    agentRows.forEach((agRow) => {
      const meta = (typeof agRow.metadata === 'object' && agRow.metadata !== null) ? agRow.metadata as Record<string, unknown> : {};
      nodesMap.set(agRow.id, {
        id: agRow.id,
        label: agRow.name,
        type: 'Agent',
        riskScore: typeof agRow.risk_score === 'number' ? agRow.risk_score : 0,
        status: mapDBStatusToAgentUI(agRow.status),
        description: (meta.purpose as string) || `Autonomous ${agRow.model || 'LLM'} agent`,
        column: 1,
        x: 280,
        y: 80 + col1Count * 110,
        metadata: meta,
      });
      col1Count++;

      // If AI agent has linked identity_id, create an implicit edge
      if (agRow.identity_id && nodesMap.has(agRow.identity_id)) {
        edgesList.push({
          id: `edge_agent_identity_${agRow.id}`,
          source: agRow.identity_id,
          target: agRow.id,
          relationType: 'EXECUTION_DELEGATION',
          grantedBy: 'Control Plane Operator',
          createdAt: agRow.created_at,
          status: agRow.risk_score >= 80 ? 'critical' : agRow.risk_score >= 60 ? 'warning' : 'normal',
        });
      }
    });

    // 3. Convert Resources to Column 2/3/4 Nodes based on resource_type
    resourceRows.forEach((resRow) => {
      const meta = (typeof resRow.metadata === 'object' && resRow.metadata !== null) ? resRow.metadata as Record<string, unknown> : {};
      const uiType = mapDBResourceTypeToUI(resRow.resource_type);
      
      let col = 4;
      let nodeType: GraphNode['type'] = 'Resource';

      if (uiType === 'API' || uiType === 'Application') {
        col = 2;
        nodeType = uiType === 'API' ? 'API' : 'Application';
      } else if (uiType === 'Database') {
        col = 3;
        nodeType = 'Database';
      }

      let yPos = 120;
      if (col === 2) { yPos = 120 + col2Count * 120; col2Count++; }
      else if (col === 3) { yPos = 120 + col3Count * 120; col3Count++; }
      else { yPos = 120 + col4Count * 120; col4Count++; }

      nodesMap.set(resRow.id, {
        id: resRow.id,
        label: resRow.name,
        type: nodeType,
        riskScore: typeof meta.riskScore === 'number' ? meta.riskScore : (resRow.sensitivity === 'restricted' ? 90 : 35),
        status: mapDBResourceStatusToUI(resRow.status),
        description: `${resRow.sensitivity.toUpperCase()} asset - ${(meta.description as string) || (meta.environment as string) || 'Production asset'}`,
        column: col,
        x: col === 2 ? 480 : col === 3 ? 680 : 880,
        y: yPos,
        metadata: meta,
      });
    });

    // 4. Convert access_relationships to Edges
    relRows.forEach((rel) => {
      const sourceId = rel.identity_id || rel.ai_agent_id;
      const targetId = rel.resource_id;

      if (sourceId && targetId && nodesMap.has(sourceId) && nodesMap.has(targetId)) {
        const sourceNode = nodesMap.get(sourceId);
        const targetNode = nodesMap.get(targetId);

        const highestRisk = Math.max(sourceNode?.riskScore || 0, targetNode?.riskScore || 0);
        let edgeStatus: GraphEdge['status'] = 'normal';
        if (highestRisk >= 80) edgeStatus = 'critical';
        else if (highestRisk >= 60) edgeStatus = 'warning';

        edgesList.push({
          id: rel.id,
          source: sourceId,
          target: targetId,
          relationType: rel.relation_type || 'Unknown Relationship',
          grantedBy: rel.granted_by || 'Security Policy Engine',
          createdAt: rel.created_at,
          status: edgeStatus,
        });
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      edges: edgesList,
      totalRelationships: relRows.length,
    };
  },
};

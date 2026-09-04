import { Database } from '@/types/supabase';
import { Agent, AgentCapability } from '@/lib/types/agent';
import { SecurityFinding } from './types';
import { sanitizeEvidence } from './evidence';

type AIAgentRow = Database['public']['Tables']['ai_agents']['Row'];

/**
 * Normalizes input which can be either an AIAgentRow from Supabase or an Agent domain object.
 */
function extractAgentData(input: AIAgentRow | Agent): {
  id: string;
  name: string;
  riskScore: number;
  capabilities: AgentCapability[];
  permissionsCount: number;
  status: string;
  createdAt: string;
} {
  if ('capabilities' in input && Array.isArray(input.capabilities)) {
    // Already mapped Agent domain model
    return {
      id: input.id,
      name: input.name,
      riskScore: typeof input.riskScore === 'number' ? input.riskScore : 0,
      capabilities: input.capabilities,
      permissionsCount: typeof input.permissionsCount === 'number' ? input.permissionsCount : input.capabilities.length,
      status: input.status,
      createdAt: (input as { lastActive?: string }).lastActive || new Date().toISOString(),
    };
  }

  // Database AIAgentRow
  const row = input as AIAgentRow;
  const meta =
    typeof row.metadata === 'object' && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};

  const capabilities = Array.isArray(meta.capabilities)
    ? (meta.capabilities as AgentCapability[])
    : [];

  const permissionsCount =
    typeof meta.permissionsCount === 'number'
      ? meta.permissionsCount
      : capabilities.length;

  return {
    id: row.id,
    name: row.name,
    riskScore: typeof row.risk_score === 'number' ? row.risk_score : 0,
    capabilities,
    permissionsCount,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Deterministically evaluates AI agent capabilities to produce security findings.
 * Never fabricates findings from missing data.
 */
export function detectAgentFindings(
  organizationId: string,
  agentInput: AIAgentRow | Agent
): SecurityFinding[] {
  const agent = extractAgentData(agentInput);
  const findings: SecurityFinding[] = [];
  const detectedAt = new Date().toISOString();

  // If there are no capabilities or permissions recorded, do NOT fabricate findings
  if (agent.capabilities.length === 0 && agent.permissionsCount === 0) {
    return [];
  }

  // 1. High-risk tool access check
  // Signals: accessLevel === 'Admin' or (Write access on privileged systems)
  const adminCapabilities = agent.capabilities.filter(
    (cap) => cap.accessLevel === 'Admin'
  );

  if (adminCapabilities.length > 0) {
    const code = 'AI_AGENT_HIGH_RISK_TOOL_ACCESS';
    const severity = 'HIGH';
    const fingerprint = `${agent.id}:${code}:${severity}`;
    const findingId = `find_${Buffer.from(fingerprint).toString('base64url').slice(0, 24)}`;

    const rawEvidence = {
      adminCapabilityCount: adminCapabilities.length,
      highRiskCapabilities: adminCapabilities.slice(0, 5).map((c) => ({
        capability: c.capability,
        resource: c.resource,
        accessLevel: c.accessLevel,
        decision: c.decision,
      })),
    };

    findings.push({
      id: findingId,
      organizationId,
      subjectId: agent.id,
      subjectType: 'ai_agent',
      code,
      category: 'AI_AGENT',
      severity,
      title: 'AI Agent Possesses High-Risk Administrative Tools',
      description: `Agent '${agent.name}' is granted administrative execution access across ${adminCapabilities.length} tool(s).`,
      recommendation:
        "Reduce the agent's tool permissions from Admin to least-privilege Read/Write scopes required for its defined purpose.",
      riskContribution: 30,
      riskScore: agent.riskScore,
      evidence: sanitizeEvidence(rawEvidence),
      detectedAt,
      fingerprint,
    });
  }

  // 2. Unrestricted resource access check
  // Signals: Explicit wildcard in capability resource field
  const wildcardCapabilities = agent.capabilities.filter((cap) => {
    const res = (cap.resource || '').trim();
    return res === '*' || res === 'all' || res.endsWith('/*') || res.includes('::*');
  });

  if (wildcardCapabilities.length > 0) {
    const code = 'AI_AGENT_UNRESTRICTED_RESOURCE_ACCESS';
    const severity = 'HIGH';
    const fingerprint = `${agent.id}:${code}:${severity}`;
    const findingId = `find_${Buffer.from(fingerprint).toString('base64url').slice(0, 24)}`;

    const rawEvidence = {
      wildcardCapabilityCount: wildcardCapabilities.length,
      unrestrictedResources: wildcardCapabilities.slice(0, 5).map((c) => c.resource),
    };

    findings.push({
      id: findingId,
      organizationId,
      subjectId: agent.id,
      subjectType: 'ai_agent',
      code,
      category: 'AI_AGENT',
      severity,
      title: 'AI Agent Unrestricted Resource Scope',
      description: `Agent '${agent.name}' possesses access targeting wildcard or unrestricted resource patterns.`,
      recommendation:
        "Replace wildcard resource scopes ('*') with explicitly declared and isolated target resources.",
      riskContribution: 25,
      riskScore: agent.riskScore,
      evidence: sanitizeEvidence(rawEvidence),
      detectedAt,
      fingerprint,
    });
  }

  // 3. Excessive capabilities check
  // Signals: 5 or more distinct capabilities or 10+ granular permissions
  if (agent.capabilities.length >= 5 || agent.permissionsCount >= 10) {
    const code = 'AI_AGENT_EXCESSIVE_CAPABILITIES';
    const severity = 'MEDIUM';
    const fingerprint = `${agent.id}:${code}:${severity}`;
    const findingId = `find_${Buffer.from(fingerprint).toString('base64url').slice(0, 24)}`;

    const rawEvidence = {
      totalCapabilities: agent.capabilities.length,
      permissionsCount: agent.permissionsCount,
    };

    findings.push({
      id: findingId,
      organizationId,
      subjectId: agent.id,
      subjectType: 'ai_agent',
      code,
      category: 'AI_AGENT',
      severity,
      title: 'AI Agent Excessive Capability Breadth',
      description: `Agent '${agent.name}' is assigned an excessively broad capability surface (${agent.capabilities.length} capabilities, ${agent.permissionsCount} permissions).`,
      recommendation:
        'Decompose this monolithic agent into multiple single-purpose agents with isolated scopes.',
      riskContribution: 20,
      riskScore: agent.riskScore,
      evidence: sanitizeEvidence(rawEvidence),
      detectedAt,
      fingerprint,
    });
  }

  return findings;
}

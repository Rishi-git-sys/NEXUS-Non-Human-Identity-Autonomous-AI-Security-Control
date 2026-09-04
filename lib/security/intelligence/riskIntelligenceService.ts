import { createAdminClient } from '@/lib/supabase/admin';
import { findingService } from './findingService';
import {
  SecurityFinding,
  SecurityFindingCategory,
  SecurityFindingSeverity,
  RiskSeverityCounts,
  RiskCategoryBreakdown,
  RiskSubjectBreakdown,
  RiskTopContributor,
  OrganizationRiskPosture,
} from './types';

export const SEVERITY_ORDER: Record<SecurityFindingSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const SEVERITY_MULTIPLIERS: Record<SecurityFindingSeverity, number> = {
  CRITICAL: 1.5,
  HIGH: 1.25,
  MEDIUM: 1.0,
  LOW: 0.5,
};

export const ALL_SECURITY_CATEGORIES: SecurityFindingCategory[] = [
  'CREDENTIAL',
  'PERMISSION',
  'IDENTITY',
  'AI_AGENT',
  'AWS',
  'RESOURCE',
];

/**
 * Calculates counts of findings by severity.
 */
export function calculateSeverityCounts(findings: SecurityFinding[]): RiskSeverityCounts {
  const counts: RiskSeverityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const finding of findings) {
    switch (finding.severity) {
      case 'CRITICAL':
        counts.critical++;
        break;
      case 'HIGH':
        counts.high++;
        break;
      case 'MEDIUM':
        counts.medium++;
        break;
      case 'LOW':
      default:
        counts.low++;
        break;
    }
  }

  return counts;
}

/**
 * Initializes and computes breakdown statistics for all supported security categories.
 * All categories are guaranteed to be present even when finding count is zero.
 */
export function calculateCategoryBreakdown(
  findings: SecurityFinding[]
): Record<SecurityFindingCategory, RiskCategoryBreakdown> {
  const breakdown: Record<SecurityFindingCategory, RiskCategoryBreakdown> = {
    CREDENTIAL: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    PERMISSION: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    IDENTITY: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    AI_AGENT: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    AWS: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    RESOURCE: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
  };

  for (const finding of findings) {
    const entry = breakdown[finding.category];
    if (entry) {
      entry.count++;
      entry.riskContribution += finding.riskContribution || 0;
      if (finding.severity === 'CRITICAL') entry.criticalCount++;
      if (finding.severity === 'HIGH') entry.highCount++;
    }
  }

  return breakdown;
}

/**
 * Deterministic Overall Risk Score Calculation:
 *
 * 1. Weighted Contribution:
 *    weightedContribution = sum(finding.riskContribution * severityMultiplier)
 *    where:
 *      CRITICAL = 1.50
 *      HIGH     = 1.25
 *      MEDIUM   = 1.00
 *      LOW      = 0.50
 *
 * 2. Deterministic Saturation Function:
 *    overallScore = Math.min(100, Math.round(100 * (1 - Math.exp(-weightedContribution / 100))))
 *
 * Guarantees:
 * - Output is strictly bounded between 0 and 100.
 * - 0 findings produce an overallScore of 0.
 * - Findings monotonically increase overall risk.
 * - Asymptotically approaches 100 as risk accumulates without unbounded overflow.
 */
export function calculateOverallRiskScore(findings: SecurityFinding[]): number {
  if (findings.length === 0) {
    return 0;
  }

  let weightedContribution = 0;

  for (const finding of findings) {
    const multiplier = SEVERITY_MULTIPLIERS[finding.severity] ?? 1.0;
    const contribution = finding.riskContribution || 0;
    weightedContribution += contribution * multiplier;
  }

  if (weightedContribution <= 0) {
    return 0;
  }

  const score = Math.min(
    100,
    Math.round(100 * (1 - Math.exp(-weightedContribution / 100)))
  );

  return score;
}

/**
 * Maps risk score (0-100) to standard SecurityFindingSeverity using NEXUS thresholds:
 * - CRITICAL: >= 75
 * - HIGH: >= 50
 * - MEDIUM: >= 25
 * - LOW: < 25
 */
export function mapScoreToSeverity(score: number): SecurityFindingSeverity {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * Maps risk score (0-100) to human-readable posture status:
 * - CRITICAL: 'Critical'
 * - HIGH: 'High Risk'
 * - MEDIUM: 'Medium Risk'
 * - LOW: 'Healthy'
 */
export function mapScoreToStatus(
  score: number
): 'Healthy' | 'Medium Risk' | 'High Risk' | 'Critical' {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High Risk';
  if (score >= 25) return 'Medium Risk';
  return 'Healthy';
}

/**
 * Sorts findings deterministically and extracts the top risk contributors (max 10).
 * Deterministic sort order:
 * 1. Severity: CRITICAL > HIGH > MEDIUM > LOW
 * 2. Risk contribution descending
 * 3. Finding code ascending
 * 4. Finding ID ascending
 *
 * Omits full evidence and credentials from summaries for security.
 */
export function extractTopContributors(
  findings: SecurityFinding[],
  subjectNameMap?: Map<string, string>,
  limit = 10
): RiskTopContributor[] {
  const sorted = [...findings].sort((a, b) => {
    const weightA = SEVERITY_ORDER[a.severity] || 0;
    const weightB = SEVERITY_ORDER[b.severity] || 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }

    if (b.riskContribution !== a.riskContribution) {
      return b.riskContribution - a.riskContribution;
    }

    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) {
      return codeCompare;
    }

    return a.id.localeCompare(b.id);
  });

  return sorted.slice(0, limit).map((f) => ({
    findingId: f.id,
    code: f.code,
    category: f.category,
    severity: f.severity,
    subjectId: f.subjectId,
    subjectType: f.subjectType,
    subjectName: subjectNameMap?.get(f.subjectId),
    title: f.title,
    riskContribution: f.riskContribution,
    recommendation: f.recommendation,
  }));
}

/**
 * Calculates identity and AI-agent subject posture breakdowns.
 * atRisk threshold is riskScore >= 50.
 * averageRiskScore is arithmetic mean, or 0 if subjects count is 0.
 */
export function calculateSubjectBreakdown(
  identities: { id: string; risk_score?: number | null }[],
  agents: { id: string; risk_score?: number | null }[],
  findings: SecurityFinding[]
): {
  identities: RiskSubjectBreakdown;
  aiAgents: RiskSubjectBreakdown;
} {
  const totalIdentities = identities.length;
  const atRiskIdentities = identities.filter(
    (i) => (i.risk_score ?? 0) >= 50
  ).length;
  const identityRiskSum = identities.reduce(
    (acc, i) => acc + (i.risk_score ?? 0),
    0
  );
  const avgIdentityRisk =
    totalIdentities > 0 ? Math.round(identityRiskSum / totalIdentities) : 0;
  const identityFindingsCount = findings.filter(
    (f) => f.subjectType === 'identity'
  ).length;

  const totalAgents = agents.length;
  const atRiskAgents = agents.filter((a) => (a.risk_score ?? 0) >= 50).length;
  const agentRiskSum = agents.reduce(
    (acc, a) => acc + (a.risk_score ?? 0),
    0
  );
  const avgAgentRisk =
    totalAgents > 0 ? Math.round(agentRiskSum / totalAgents) : 0;
  const agentFindingsCount = findings.filter(
    (f) => f.subjectType === 'ai_agent'
  ).length;

  return {
    identities: {
      total: totalIdentities,
      atRisk: atRiskIdentities,
      averageRiskScore: avgIdentityRisk,
      findingsCount: identityFindingsCount,
    },
    aiAgents: {
      total: totalAgents,
      atRisk: atRiskAgents,
      averageRiskScore: avgAgentRisk,
      findingsCount: agentFindingsCount,
    },
  };
}

export const riskIntelligenceService = {
  /**
   * Retrieves the organization-level security risk posture.
   * Reuses findings produced by findingService and aggregates them into an
   * explainable, deterministic posture report.
   */
  async getOrganizationRiskPosture(
    organizationId: string
  ): Promise<OrganizationRiskPosture> {
    const assessedAt = new Date().toISOString();

    if (!organizationId) {
      return {
        overallScore: 0,
        severity: 'LOW',
        status: 'Healthy',
        assessedAt,
        totalFindings: 0,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        categoryBreakdown: calculateCategoryBreakdown([]),
        subjectBreakdown: {
          identities: { total: 0, atRisk: 0, averageRiskScore: 0, findingsCount: 0 },
          aiAgents: { total: 0, atRisk: 0, averageRiskScore: 0, findingsCount: 0 },
        },
        topRiskContributors: [],
      };
    }

    // 1. Fetch all deduplicated findings from Phase 8A findingService
    const allFindings: SecurityFinding[] = [];
    const firstPage = await findingService.getAllFindings(organizationId);
    allFindings.push(...firstPage.data);

    if (firstPage.pagination.totalPages > 1) {
      for (let p = 2; p <= firstPage.pagination.totalPages; p++) {
        const nextPage = await findingService.getAllFindings(organizationId, {
          page: p,
        });
        allFindings.push(...nextPage.data);
      }
    }

    // 2. Fetch subject metadata (names & risk scores) in a single parallel batch scoped by org
    const supabase = createAdminClient();
    const [identitiesRes, agentsRes] = await Promise.all([
      supabase
        .from('identities')
        .select('id, name, risk_score')
        .eq('organization_id', organizationId),
      supabase
        .from('ai_agents')
        .select('id, name, risk_score')
        .eq('organization_id', organizationId),
    ]);

    const identities = identitiesRes.data || [];
    const agents = agentsRes.data || [];

    // 3. Build subject name resolution map
    const subjectNameMap = new Map<string, string>();
    for (const id of identities) {
      if (id.name) subjectNameMap.set(id.id, id.name);
    }
    for (const ag of agents) {
      if (ag.name) subjectNameMap.set(ag.id, ag.name);
    }

    // 4. Compute metrics
    const totalFindings = allFindings.length;
    const severityCounts = calculateSeverityCounts(allFindings);
    const categoryBreakdown = calculateCategoryBreakdown(allFindings);
    const overallScore = calculateOverallRiskScore(allFindings);
    const severity = mapScoreToSeverity(overallScore);
    const status = mapScoreToStatus(overallScore);
    const subjectBreakdown = calculateSubjectBreakdown(identities, agents, allFindings);
    const topRiskContributors = extractTopContributors(
      allFindings,
      subjectNameMap,
      10
    );

    return {
      overallScore,
      severity,
      status,
      assessedAt,
      totalFindings,
      severityCounts,
      categoryBreakdown,
      subjectBreakdown,
      topRiskContributors,
    };
  },
};

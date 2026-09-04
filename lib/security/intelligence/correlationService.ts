import { createAdminClient } from '@/lib/supabase/admin';
import { findingService } from './findingService';
import { sanitizeEvidence } from './evidence';
import {
  SecurityFinding,
  SecurityPattern,
  SecurityPatternSeverity,
  SecurityPatternsSummary,
  SecurityPatternsResponse,
  SecurityFindingsPagination,
} from './types';

const SEVERITY_SORT_WEIGHT: Record<SecurityPatternSeverity, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
};

function getLatestDetectedAt(findings: SecurityFinding[]): string {
  const timestamps = findings
    .map((f) => f.detectedAt)
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .sort();

  return timestamps.at(-1) || '1970-01-01T00:00:00.000Z';
}

/**
 * Pure function: Evaluates the 5 deterministic correlation rules across a list of findings.
 * Findings are strictly grouped by `${subjectType}:${subjectId}` to prevent cross-subject correlation.
 */
export function detectCorrelatedPatterns(
  findings: SecurityFinding[],
  subjectNameMap?: Map<string, string>
): SecurityPattern[] {
  const patterns: SecurityPattern[] = [];

  // Group findings strictly by subjectType + subjectId
  const subjectGroups = new Map<string, SecurityFinding[]>();

  for (const finding of findings) {
    const groupKey = `${finding.subjectType}:${finding.subjectId}`;
    let group = subjectGroups.get(groupKey);
    if (!group) {
      group = [];
      subjectGroups.set(groupKey, group);
    }
    group.push(finding);
  }

  for (const [groupKey, groupFindings] of subjectGroups.entries()) {
    const [subjectType, subjectId] = groupKey.split(':') as [
      'identity' | 'ai_agent' | 'resource',
      string,
    ];

    const organizationId = groupFindings[0]?.organizationId || '';
    const subjectName =
      subjectNameMap?.get(`${subjectType}:${subjectId}`) ||
      subjectNameMap?.get(subjectId);

    // Index findings by finding code for O(1) lookup
    const codeMap = new Map<string, SecurityFinding>();
    for (const f of groupFindings) {
      codeMap.set(f.code, f);
    }

    // ------------------------------------------------------------------------
    // IDENTITY CORRELATION RULES
    // ------------------------------------------------------------------------
    if (subjectType === 'identity') {
      // RULE 1: Stale Unrotated Credential with Full Administrator Access
      const oldKeyFinding = codeMap.get('AWS_ACCESS_KEY_OLD_180');
      const adminFinding = codeMap.get('AWS_ADMINISTRATOR_POLICY');

      if (oldKeyFinding && adminFinding) {
        const patternCode = 'PATTERN_STALE_ADMIN_CREDENTIAL';
        const severity: SecurityPatternSeverity = 'CRITICAL';
        const fingerprint = `${subjectId}:${patternCode}:${severity}`;
        const id = `pat_${Buffer.from(fingerprint).toString('base64url')}`;
        const detectedAt = getLatestDetectedAt([oldKeyFinding, adminFinding]);

        const combinedEvidence = sanitizeEvidence({
          keyAgeDays: oldKeyFinding.evidence.maxKeyAgeDays,
          activeKeyCount: oldKeyFinding.evidence.activeKeyCount,
          isAdministrator: adminFinding.evidence.isAdministrator ?? true,
          policyCount: adminFinding.evidence.policyCount,
          policyNames: adminFinding.evidence.policyNames,
        });

        patterns.push({
          id,
          organizationId,
          patternCode,
          patternType: 'CREDENTIAL_EXPOSURE',
          severity,
          title: 'Stale Unrotated Credential with Full Administrator Access',
          description:
            'An active AWS access key has not been rotated in over 180 days and is attached to an identity possessing full AdministratorAccess. This combination creates a severe credential and privilege exposure condition.',
          recommendation:
            'Immediately rotate or invalidate the stale access key and restrict the identity to least-privilege role-based permissions.',
          subjectId,
          subjectType,
          subjectName,
          correlatedFindingIds: [oldKeyFinding.id, adminFinding.id],
          correlatedFindingCodes: [oldKeyFinding.code, adminFinding.code],
          evidence: combinedEvidence,
          detectedAt,
          fingerprint,
        });
      }

      // RULE 2: Administrator Identity with Multiple Active Access Keys
      const multiKeyFinding = codeMap.get('AWS_MULTIPLE_ACTIVE_KEYS');
      if (multiKeyFinding && adminFinding) {
        const patternCode = 'PATTERN_ADMIN_MULTIPLE_ACTIVE_KEYS';
        const severity: SecurityPatternSeverity = 'CRITICAL';
        const fingerprint = `${subjectId}:${patternCode}:${severity}`;
        const id = `pat_${Buffer.from(fingerprint).toString('base64url')}`;
        const detectedAt = getLatestDetectedAt([multiKeyFinding, adminFinding]);

        const combinedEvidence = sanitizeEvidence({
          activeKeyCount: multiKeyFinding.evidence.activeKeyCount,
          totalKeyCount: multiKeyFinding.evidence.totalKeyCount,
          isAdministrator: adminFinding.evidence.isAdministrator ?? true,
          policyNames: adminFinding.evidence.policyNames,
        });

        patterns.push({
          id,
          organizationId,
          patternCode,
          patternType: 'CREDENTIAL_EXPOSURE',
          severity,
          title: 'Administrator Identity with Multiple Active Access Keys',
          description:
            'An identity with AdministratorAccess has multiple concurrent active access keys, unnecessarily increasing credential exposure for a highly privileged identity.',
          recommendation:
            'Deactivate and remove unused access keys and minimize active credentials for administrative identities.',
          subjectId,
          subjectType,
          subjectName,
          correlatedFindingIds: [multiKeyFinding.id, adminFinding.id],
          correlatedFindingCodes: [multiKeyFinding.code, adminFinding.code],
          evidence: combinedEvidence,
          detectedAt,
          fingerprint,
        });
      }

      // RULE 3: Unrestricted Wildcard Action and Resource Authority
      const wildcardActionFinding = codeMap.get('AWS_WILDCARD_ACTION');
      const wildcardResourceFinding = codeMap.get('AWS_WILDCARD_RESOURCE');

      if (wildcardActionFinding && wildcardResourceFinding) {
        const patternCode = 'PATTERN_UNRESTRICTED_WILDCARD_PERMISSIONS';
        const severity: SecurityPatternSeverity = 'HIGH';
        const fingerprint = `${subjectId}:${patternCode}:${severity}`;
        const id = `pat_${Buffer.from(fingerprint).toString('base64url')}`;
        const detectedAt = getLatestDetectedAt([
          wildcardActionFinding,
          wildcardResourceFinding,
        ]);

        const combinedEvidence = sanitizeEvidence({
          wildcardActions: true,
          wildcardResources: true,
          actionPolicyNames: wildcardActionFinding.evidence.policyNames,
          resourcePolicyNames: wildcardResourceFinding.evidence.policyNames,
        });

        patterns.push({
          id,
          organizationId,
          patternCode,
          patternType: 'ATTACK_SURFACE',
          severity,
          title: 'Unrestricted Wildcard Action and Resource Authority',
          description:
            'Identity policies grant wildcard API actions against wildcard resources, creating broad ambient authority and increasing potential blast radius if the identity is compromised.',
          recommendation:
            'Replace wildcard actions with explicit required API actions and scope resources to specific ARNs where supported.',
          subjectId,
          subjectType,
          subjectName,
          correlatedFindingIds: [wildcardActionFinding.id, wildcardResourceFinding.id],
          correlatedFindingCodes: [wildcardActionFinding.code, wildcardResourceFinding.code],
          evidence: combinedEvidence,
          detectedAt,
          fingerprint,
        });
      }
    }

    // ------------------------------------------------------------------------
    // AI AGENT CORRELATION RULES
    // ------------------------------------------------------------------------
    if (subjectType === 'ai_agent') {
      const highRiskToolFinding = codeMap.get('AI_AGENT_HIGH_RISK_TOOL_ACCESS');
      const unrestrictedResourceFinding = codeMap.get('AI_AGENT_UNRESTRICTED_RESOURCE_ACCESS');
      const excessiveCapsFinding = codeMap.get('AI_AGENT_EXCESSIVE_CAPABILITIES');

      // RULE 4: AI Agent with Unbounded Administrative Tool Execution
      if (highRiskToolFinding && unrestrictedResourceFinding) {
        const patternCode = 'PATTERN_AI_AGENT_UNCONSTRAINED_ADMIN';
        const severity: SecurityPatternSeverity = 'CRITICAL';
        const fingerprint = `${subjectId}:${patternCode}:${severity}`;
        const id = `pat_${Buffer.from(fingerprint).toString('base64url')}`;
        const detectedAt = getLatestDetectedAt([
          highRiskToolFinding,
          unrestrictedResourceFinding,
        ]);

        const combinedEvidence = sanitizeEvidence({
          adminCapabilityCount: highRiskToolFinding.evidence.adminCapabilityCount,
          highRiskCapabilities: highRiskToolFinding.evidence.highRiskCapabilities,
          unrestrictedResources: unrestrictedResourceFinding.evidence.unrestrictedResources,
        });

        patterns.push({
          id,
          organizationId,
          patternCode,
          patternType: 'UNBOUNDED_EXECUTION',
          severity,
          title: 'AI Agent with Unbounded Administrative Tool Execution',
          description:
            'An autonomous AI agent has administrative execution capability combined with wildcard resource targeting. This configuration creates an excessive autonomous execution scope and increases the potential blast radius of unintended or malicious actions.',
          recommendation:
            'Reduce administrative tool access to the minimum required scope and constrain resource targets to specific resource identifiers.',
          subjectId,
          subjectType,
          subjectName,
          correlatedFindingIds: [highRiskToolFinding.id, unrestrictedResourceFinding.id],
          correlatedFindingCodes: [highRiskToolFinding.code, unrestrictedResourceFinding.code],
          evidence: combinedEvidence,
          detectedAt,
          fingerprint,
        });
      }

      // RULE 5: Overprivileged Monolithic AI Agent
      if (highRiskToolFinding && excessiveCapsFinding) {
        const patternCode = 'PATTERN_AI_AGENT_OVERPRIVILEGED_MONOLITH';
        const severity: SecurityPatternSeverity = 'HIGH';
        const fingerprint = `${subjectId}:${patternCode}:${severity}`;
        const id = `pat_${Buffer.from(fingerprint).toString('base64url')}`;
        const detectedAt = getLatestDetectedAt([
          highRiskToolFinding,
          excessiveCapsFinding,
        ]);

        const combinedEvidence = sanitizeEvidence({
          adminCapabilityCount: highRiskToolFinding.evidence.adminCapabilityCount,
          totalCapabilities: excessiveCapsFinding.evidence.totalCapabilities,
          permissionsCount: excessiveCapsFinding.evidence.permissionsCount,
        });

        patterns.push({
          id,
          organizationId,
          patternCode,
          patternType: 'PRIVILEGE_ESCALATION',
          severity,
          title: 'Overprivileged Monolithic AI Agent',
          description:
            'An AI agent combines administrative execution capability with a large capability set. This creates excessive autonomous privilege concentration and increases blast radius.',
          recommendation:
            'Decompose the agent into smaller, isolated, single-purpose agents with minimal capabilities.',
          subjectId,
          subjectType,
          subjectName,
          correlatedFindingIds: [highRiskToolFinding.id, excessiveCapsFinding.id],
          correlatedFindingCodes: [highRiskToolFinding.code, excessiveCapsFinding.code],
          evidence: combinedEvidence,
          detectedAt,
          fingerprint,
        });
      }
    }
  }

  return patterns;
}

/**
 * Pure function: Calculates statistical summary across detected patterns.
 */
export function calculatePatternsSummary(
  patterns: SecurityPattern[]
): SecurityPatternsSummary {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  const affectedSubjectsSet = new Set<string>();

  for (const pattern of patterns) {
    if (pattern.severity === 'CRITICAL') criticalCount++;
    else if (pattern.severity === 'HIGH') highCount++;
    else if (pattern.severity === 'MEDIUM') mediumCount++;

    affectedSubjectsSet.add(`${pattern.subjectType}:${pattern.subjectId}`);
  }

  return {
    totalPatterns: patterns.length,
    criticalPatterns: criticalCount,
    highPatterns: highCount,
    mediumPatterns: mediumCount,
    affectedSubjects: affectedSubjectsSet.size,
  };
}

/**
 * Pure function: Sorts, filters, and paginates patterns deterministically.
 * Deterministic sort order:
 * 1. Severity: CRITICAL > HIGH > MEDIUM
 * 2. patternCode ascending
 * 3. subjectId ascending
 * 4. id ascending
 */
export function filterAndPaginatePatterns(
  patterns: SecurityPattern[],
  options?: {
    severity?: string;
    subjectType?: string;
    page?: number;
    limit?: number;
  }
): {
  data: SecurityPattern[];
  pagination: SecurityFindingsPagination;
} {
  let filtered = [...patterns];

  if (options?.severity) {
    const targetSeverity = options.severity.toUpperCase().trim();
    filtered = filtered.filter((p) => p.severity === targetSeverity);
  }

  if (options?.subjectType) {
    const targetType = options.subjectType.toLowerCase().trim();
    filtered = filtered.filter((p) => p.subjectType === targetType);
  }

  // Deterministic sort
  filtered.sort((a, b) => {
    const weightA = SEVERITY_SORT_WEIGHT[a.severity] || 0;
    const weightB = SEVERITY_SORT_WEIGHT[b.severity] || 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }

    const codeCompare = a.patternCode.localeCompare(b.patternCode);
    if (codeCompare !== 0) {
      return codeCompare;
    }

    const subjectCompare = a.subjectId.localeCompare(b.subjectId);
    if (subjectCompare !== 0) {
      return subjectCompare;
    }

    return a.id.localeCompare(b.id);
  });

  const total = filtered.length;
  const page = Math.max(1, options?.page || 1);
  const limit = Math.min(100, Math.max(1, options?.limit || 50));
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  const paginatedData = filtered.slice(offset, offset + limit);

  return {
    data: paginatedData,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

export const correlationService = {
  /**
   * Retrieves all correlated attack patterns for an organization.
   * Reuses findings produced by findingService and detects elevated multi-finding patterns.
   */
  async getCorrelatedPatterns(
    organizationId: string,
    options?: {
      severity?: string;
      subjectType?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<SecurityPatternsResponse> {
    if (!organizationId) {
      return {
        data: [],
        summary: {
          totalPatterns: 0,
          criticalPatterns: 0,
          highPatterns: 0,
          mediumPatterns: 0,
          affectedSubjects: 0,
        },
        pagination: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        },
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

    // 2. Fetch subject names in parallel via organization-scoped query
    const supabase = createAdminClient();
    const [identitiesRes, agentsRes] = await Promise.all([
      supabase
        .from('identities')
        .select('id, name')
        .eq('organization_id', organizationId),
      supabase
        .from('ai_agents')
        .select('id, name')
        .eq('organization_id', organizationId),
    ]);

    const subjectNameMap = new Map<string, string>();
    for (const id of identitiesRes.data || []) {
      if (id.name) subjectNameMap.set(`identity:${id.id}`, id.name);
    }
    for (const ag of agentsRes.data || []) {
      if (ag.name) subjectNameMap.set(`ai_agent:${ag.id}`, ag.name);
    }

    // 3. Detect all correlated patterns
    const allPatterns = detectCorrelatedPatterns(allFindings, subjectNameMap);

    // 4. Calculate overall summary across all patterns before pagination
    const summary = calculatePatternsSummary(allPatterns);

    // 5. Apply filtering, sorting, and pagination
    const { data, pagination } = filterAndPaginatePatterns(allPatterns, options);

    return {
      data,
      summary,
      pagination,
    };
  },
};

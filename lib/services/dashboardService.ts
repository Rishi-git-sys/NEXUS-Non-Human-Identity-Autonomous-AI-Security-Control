import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { isAWSIAMIdentity } from '@/lib/integrations/aws/utils';
import { RiskTrendPoint } from '@/lib/types/risk';
import { SupabaseClient } from '@supabase/supabase-js';

type IdentityRow = Database['public']['Tables']['identities']['Row'];
type AIAgentRow = Database['public']['Tables']['ai_agents']['Row'];
type PolicyRow = Database['public']['Tables']['policies']['Row'];
type ViolationRow = Database['public']['Tables']['policy_violations']['Row'];
type AlertRow = Database['public']['Tables']['alerts']['Row'];
type AuditRow = Database['public']['Tables']['audit_logs']['Row'];

import { DashboardData } from '../types/dashboard';

export type { DashboardData };

export const dashboardService = {
  /**
   * Retrieves dashboard telemetry from Supabase PostgreSQL tables.
   * Every query is explicitly scoped to the user's organization_id.
   */
  async getDashboardData(
    organizationId: string,
    timeframe: '7d' | '30d' | '90d' = '7d',
    customClient?: SupabaseClient<Database>
  ): Promise<DashboardData> {
    if (!organizationId) {
      throw new Error('Organization ID is required to fetch dashboard telemetry.');
    }

    // Execute queries in parallel scoped to the target organization
    const supabase = customClient || await createClient();
    const [
      orgRes,
      identitiesRes,
      agentsRes,
      policiesRes,
      violationsRes,
      alertsRes,
      auditLogsRes,
    ] = await Promise.all([
      supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle(),
      supabase
        .from('identities')
        .select('*')
        .eq('organization_id', organizationId),
      supabase
        .from('ai_agents')
        .select('*')
        .eq('organization_id', organizationId),
      supabase
        .from('policies')
        .select('*')
        .eq('organization_id', organizationId),
      supabase
        .from('policy_violations')
        .select('*')
        .eq('organization_id', organizationId),
      supabase
        .from('alerts')
        .select('*')
        .eq('organization_id', organizationId),
      supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (orgRes.error) console.error('Error querying organization name:', orgRes.error.message);
    if (identitiesRes.error) console.error('Error querying identities:', identitiesRes.error.message);
    if (agentsRes.error) console.error('Error querying ai_agents:', agentsRes.error.message);
    if (policiesRes.error) console.error('Error querying policies:', policiesRes.error.message);
    if (violationsRes.error) console.error('Error querying policy_violations:', violationsRes.error.message);
    if (alertsRes.error) console.error('Error querying alerts:', alertsRes.error.message);
    if (auditLogsRes.error) console.error('Error querying audit_logs:', auditLogsRes.error.message);

    const organizationName = orgRes.data?.name || 'NEXUS Security';
    const identitiesList: IdentityRow[] = identitiesRes.data || [];
    const agentsList: AIAgentRow[] = agentsRes.data || [];
    const policiesList: PolicyRow[] = policiesRes.data || [];
    const violationsList: ViolationRow[] = violationsRes.data || [];
    const alertsList: AlertRow[] = alertsRes.data || [];
    const auditLogsList: AuditRow[] = auditLogsRes.data || [];

    // --- Identity Metrics ---
    const totalIdentities = identitiesList.length;
    const highRiskIdentities = identitiesList.filter(i => (i.risk_score || 0) >= 50 && (i.risk_score || 0) < 75).length;
    const criticalRiskIdentities = identitiesList.filter(i => (i.risk_score || 0) >= 75).length;
    const activeIdentities = identitiesList.filter(i => i.status === 'active').length;
    const disabledIdentities = identitiesList.filter(i => i.status === 'suspended').length;
    const avgIdentityRisk = totalIdentities > 0
      ? Math.round(identitiesList.reduce((acc, i) => acc + (i.risk_score || 0), 0) / totalIdentities)
      : 0;

    // --- AWS Identity Metrics ---
    const awsIdentitiesList = identitiesList.filter(i => {
      const meta = (typeof i.metadata === 'object' && i.metadata !== null) ? (i.metadata as Record<string, unknown>) : {};
      return isAWSIAMIdentity(meta);
    });
    
    const awsIdentities = {
      total: awsIdentitiesList.length,
      highRisk: awsIdentitiesList.filter(i => (i.risk_score || 0) >= 50 && (i.risk_score || 0) < 75).length,
      criticalRisk: awsIdentitiesList.filter(i => (i.risk_score || 0) >= 75).length,
      iamUsers: awsIdentitiesList.filter(i => i.identity_type === 'service_account').length,
      iamRoles: awsIdentitiesList.filter(i => i.identity_type === 'workload_identity').length,
      activeAccessKeys: 0,
      oldAccessKeys: 0,
      administratorIdentities: 0,
      wildcardPermissions: 0,
      administratorAccess: 0,
      powerUserAccess: 0,
      dangerousIamPermissions: 0,
      leastPrivilegeReview: 0,
    };

    for (const i of awsIdentitiesList) {
      const meta = (typeof i.metadata === 'object' && i.metadata !== null) ? (i.metadata as Record<string, unknown>) : {};
      const awsSecurity = meta.awsSecurity as { accessKeys?: { status: string; ageDays: number }[]; privilegeSummary?: { administrator: boolean } } | undefined;
      const nexusRisk = meta.nexusRisk as { riskFactors?: { code: string }[] } | undefined;

      if (awsSecurity) {
        if (awsSecurity.accessKeys) {
          for (const k of awsSecurity.accessKeys) {
            if (k.status === 'Active') {
              awsIdentities.activeAccessKeys++;
              if (k.ageDays > 90) awsIdentities.oldAccessKeys++;
            }
          }
        }
        if (awsSecurity.privilegeSummary?.administrator) {
          awsIdentities.administratorIdentities++;
        }
      }

      if (nexusRisk && Array.isArray(nexusRisk.riskFactors)) {
        let hasWildcard = false;
        let hasAdmin = false;
        let hasPower = false;
        let hasDangerous = false;
        let hasServiceLinkedFactor = false;

        for (const factor of nexusRisk.riskFactors) {
          if (factor.code === 'AWS_MANAGED_SERVICE_ROLE') hasServiceLinkedFactor = true;
          if (factor.code === 'AWS_WILDCARD_RESOURCE' || factor.code === 'AWS_WILDCARD_ACTION') hasWildcard = true;
          if (factor.code === 'AWS_ADMINISTRATOR_POLICY') hasAdmin = true;
          if (factor.code === 'AWS_POWERUSER_POLICY') hasPower = true;
          if (factor.code === 'AWS_DANGEROUS_IAM_PERMISSION') hasDangerous = true;
        }

        if (hasWildcard) awsIdentities.wildcardPermissions++;
        if (hasAdmin) awsIdentities.administratorAccess++;
        if (hasPower) awsIdentities.powerUserAccess++;
        if (hasDangerous) awsIdentities.dangerousIamPermissions++;

        if ((hasWildcard || hasAdmin || hasPower || hasDangerous) && !hasServiceLinkedFactor) {
          awsIdentities.leastPrivilegeReview++;
        }
      }
    }

    // --- AI Agent Metrics ---
    const totalAgents = agentsList.length;
    const highRiskAgents = agentsList.filter(a => (a.risk_score || 0) >= 60 && (a.risk_score || 0) < 80).length;
    const criticalRiskAgents = agentsList.filter(a => (a.risk_score || 0) >= 80).length;
    const activeAgents = agentsList.filter(a => a.status === 'Active').length;
    const suspendedAgents = agentsList.filter(a => a.status === 'Suspended').length;
    const avgAgentRisk = totalAgents > 0
      ? Math.round(agentsList.reduce((acc, a) => acc + (a.risk_score || 0), 0) / totalAgents)
      : 0;

    // --- Policy & Violation Metrics ---
    const totalPolicies = policiesList.length;
    const activePolicies = policiesList.filter(p => p.status === 'Active').length;
    const totalViolations = violationsList.length;
    const openViolationsList = violationsList.filter(v => v.status?.toLowerCase() !== 'resolved');
    const openViolationsCount = openViolationsList.length;
    const criticalViolationsCount = openViolationsList.filter(v => v.severity?.toLowerCase() === 'critical').length;

    // --- Alert Metrics ---
    const totalAlerts = alertsList.length;
    const openAlertsList = alertsList.filter(a => ['open', 'acknowledged', 'investigating'].includes(a.status?.toLowerCase() || ''));
    const openAlertsCount = openAlertsList.length;
    const criticalAlertsCount = openAlertsList.filter(a => a.severity?.toLowerCase() === 'critical').length;
    const highAlertsCount = openAlertsList.filter(a => a.severity?.toLowerCase() === 'high').length;

    // Determine if database has security telemetry data
    const hasTelemetry = totalIdentities > 0 || totalAgents > 0 || totalPolicies > 0 || totalViolations > 0 || totalAlerts > 0;

    let compliancePercentage: number | null = null;
    if (totalPolicies > 0) {
      const violatedPolicyIds = new Set(openViolationsList.map(v => v.policy_id));
      const compliantPolicyCount = totalPolicies - violatedPolicyIds.size;
      compliancePercentage = Math.min(100, Math.max(0, Math.round((compliantPolicyCount / totalPolicies) * 100)));
    } else if (openViolationsCount > 0) {
      compliancePercentage = Math.max(0, 100 - openViolationsCount * 10);
    }

    // --- Deterministic Security Score Calculation ---
    let scoreVal: number | null = null;
    let statusLabel = 'No Data';

    if (hasTelemetry) {
      let calculatedScore = 100;
      calculatedScore -= criticalAlertsCount * 10;
      calculatedScore -= highAlertsCount * 5;
      calculatedScore -= criticalViolationsCount * 8;
      calculatedScore -= openViolationsCount * 3;
      calculatedScore -= criticalRiskIdentities * 6;
      calculatedScore -= highRiskIdentities * 3;
      calculatedScore -= criticalRiskAgents * 6;
      calculatedScore -= highRiskAgents * 3;

      scoreVal = Math.min(100, Math.max(0, calculatedScore));

      if (scoreVal < 50) statusLabel = 'Critical';
      else if (scoreVal < 75) statusLabel = 'Needs Review';
      else if (scoreVal < 90) statusLabel = 'Healthy';
      else statusLabel = 'Excellent';
    }

    const identityRiskBadge = (criticalRiskIdentities + highRiskIdentities) > 0 ? 'Needs Review' : (totalIdentities === 0 ? 'No Data' : 'Low Risk');
    const agentRiskBadge = (criticalRiskAgents + highRiskAgents) > 0 ? 'Critical' : (totalAgents === 0 ? 'No Data' : 'Low Risk');

    // Sub-scores for Posture Breakdown Ring
    const identitySecurityScore = hasTelemetry && totalIdentities > 0 ? Math.min(100, Math.max(0, 100 - avgIdentityRisk)) : null;
    const aiAgentSecurityScore = hasTelemetry && totalAgents > 0 ? Math.min(100, Math.max(0, 100 - avgAgentRisk)) : null;
    const accessGovernanceScore = scoreVal;
    const policyComplianceScore = compliancePercentage;

    // --- Attention Required Items ---
    const attentionItems: DashboardData['attentionRequired'] = [];

    if (criticalRiskAgents > 0 || highRiskAgents > 0) {
      attentionItems.push({
        id: 'agent_risk',
        severity: criticalRiskAgents > 0 ? 'CRITICAL' : 'WARNING',
        title: `${criticalRiskAgents + highRiskAgents} AI agent(s) have elevated risk scores`,
        what: `Agent execution contexts exhibit risk scores above thresholds.`,
        why: `Unmonitored high-risk LLM tool calls can lead to unauthorized API access or data leaks.`,
        action: `Review agent boundaries and restrict active privileges.`,
        link: '/agents',
      });
    }

    if (criticalRiskIdentities > 0 || highRiskIdentities > 0) {
      attentionItems.push({
        id: 'identity_risk',
        severity: criticalRiskIdentities > 0 ? 'CRITICAL' : 'WARNING',
        title: `${criticalRiskIdentities + highRiskIdentities} non-human identity(ies) require security review`,
        what: `Machine credentials exceed recommended security posture bounds.`,
        why: `Unrotated service keys and stale access credentials increase hijack exposure.`,
        action: `Perform identity credential audit and rotate keys.`,
        link: '/identities',
      });
    }

    if (openViolationsCount > 0) {
      attentionItems.push({
        id: 'policy_violations',
        severity: criticalViolationsCount > 0 ? 'CRITICAL' : 'WARNING',
        title: `${openViolationsCount} open policy violation(s) detected`,
        what: `Enforcement boundary checks reported active policy breaches.`,
        why: `Policy deviations expose workload resources to unauthorized escalation.`,
        action: `Inspect policy engine violations and remediate rules.`,
        link: '/policies',
      });
    }

    if (openAlertsCount > 0 && attentionItems.length < 3) {
      attentionItems.push({
        id: 'open_alerts',
        severity: criticalAlertsCount > 0 ? 'CRITICAL' : 'WARNING',
        title: `${openAlertsCount} unacknowledged security alert(s)`,
        what: `Security alerts require operator triage.`,
        why: `Uninvestigated alerts may indicate active perimeter probes.`,
        action: `Open Command Center alerts to investigate telemetry.`,
        link: '/alerts',
      });
    }

    // --- Recent Activity Timeline ---
    const recentActivity: DashboardData['recentActivity'] = auditLogsList.map((log) => {
      const metadataObj = (typeof log.metadata === 'object' && log.metadata !== null) ? log.metadata as Record<string, unknown> : {};
      const actorName = (metadataObj.actor as string) || (metadataObj.actor_name as string) || log.actor_id || 'System Operator';
      
      let type: 'critical' | 'warning' | 'healthy' | 'info' = 'info';
      const actionUpper = log.action.toUpperCase();
      if (actionUpper.includes('DELETE') || actionUpper.includes('BLOCK') || actionUpper.includes('REVOKE') || actionUpper.includes('CRITICAL')) {
        type = 'critical';
      } else if (actionUpper.includes('SUSPEND') || actionUpper.includes('WARN') || actionUpper.includes('REVIEW')) {
        type = 'warning';
      } else if (actionUpper.includes('CREATE') || actionUpper.includes('ALLOW') || actionUpper.includes('ROTATE')) {
        type = 'healthy';
      }

      return {
        id: log.id,
        actor: actorName,
        event: `${log.action} (${log.entity_type})`,
        time: formatRelativeTime(log.created_at),
        timestamp: log.created_at,
        type,
      };
    });

    // --- Risk Trend Timeline ---
    const daysCount = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const trendMap: Record<string, { day: string; blocked: number; baseline: number; violations: number }> = {};
    
    const now = new Date();
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trendMap[dateStr] = { day: dateStr, blocked: 0, baseline: 0, violations: 0 };
    }

    auditLogsList.forEach((log) => {
      const dateStr = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (trendMap[dateStr]) {
        const act = log.action.toUpperCase();
        if (act.includes('BLOCK') || act.includes('DENY')) {
          trendMap[dateStr].blocked += 1;
        } else if (act.includes('VIOLATION') || act.includes('WARN')) {
          trendMap[dateStr].violations += 1;
        } else {
          trendMap[dateStr].baseline += 1;
        }
      }
    });

    const riskTrend: RiskTrendPoint[] = Object.values(trendMap);

    // --- AI Insight ---
    let aiInsight: DashboardData['aiInsight'] = null;
    if (criticalRiskAgents > 0 || highRiskAgents > 0) {
      const highestRiskAgent = agentsList.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))[0];
      if (highestRiskAgent) {
        aiInsight = {
          text: `"${highestRiskAgent.name} has a risk score of ${highestRiskAgent.risk_score}. Unused high-privilege scopes detected."`,
          recommendation: `Consider reducing permissions for ${highestRiskAgent.name}. Adhering to the principle of least privilege reduces compromise exposure surfaces.`,
          targetLink: `/agents/${highestRiskAgent.id}`,
        };
      }
    } else if (criticalRiskIdentities > 0 || highRiskIdentities > 0) {
      const highestRiskIdentity = identitiesList.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))[0];
      if (highestRiskIdentity) {
        aiInsight = {
          text: `"${highestRiskIdentity.name} credential key age exceeds security policy bounds."`,
          recommendation: `Rotate key credentials for ${highestRiskIdentity.name} to maintain zero-trust posture compliance.`,
          targetLink: `/identities/${highestRiskIdentity.id}`,
        };
      }
    }

    return {
      organizationName,
      hasTelemetry,
      identities: {
        total: totalIdentities,
        highRisk: highRiskIdentities,
        criticalRisk: criticalRiskIdentities,
        active: activeIdentities,
        disabled: disabledIdentities,
        averageRisk: avgIdentityRisk,
      },
      awsIdentities,
      aiAgents: {
        total: totalAgents,
        highRisk: highRiskAgents,
        criticalRisk: criticalRiskAgents,
        active: activeAgents,
        suspended: suspendedAgents,
        averageRisk: avgAgentRisk,
      },
      policies: {
        total: totalPolicies,
        active: activePolicies,
        totalViolations,
        openViolations: openViolationsCount,
        criticalViolations: criticalViolationsCount,
        compliancePercentage,
      },
      alerts: {
        total: totalAlerts,
        open: openAlertsCount,
        critical: criticalAlertsCount,
        high: highAlertsCount,
      },
      securityScore: {
        score: scoreVal,
        statusLabel,
        identityRiskBadge,
        agentRiskBadge,
      },
      breakdown: {
        identitySecurityScore,
        aiAgentSecurityScore,
        accessGovernanceScore,
        policyComplianceScore,
      },
      attentionRequired: attentionItems,
      recentActivity,
      riskTrend,
      aiInsight,
    };
  },

  async logScanAudit(organizationId: string, actorId: string, actorName: string) {
    if (!organizationId) return;
    try {
      const supabase = await createClient();
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: actorId,
        action: 'DISCOVER_SCAN',
        entity_type: 'workspace/all-identities',
        metadata: {
          actor: actorName,
          reason: 'On-demand compliance boundary scan triggered by security operator.',
          decision: 'ALLOWED',
          riskScore: 10,
        },
      });
    } catch (err) {
      console.error('Error logging scan audit event:', err);
    }
  },
};

function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    return `${diffDays} d ago`;
  } catch {
    return 'Recently';
  }
}

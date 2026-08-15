import { RiskTrendPoint } from '@/lib/types/risk';

export interface DashboardData {
  organizationName: string;
  hasTelemetry: boolean;
  identities: {
    total: number;
    highRisk: number;
    criticalRisk: number;
    active: number;
    disabled: number;
    averageRisk: number;
  };
  awsIdentities: {
    total: number;
    highRisk: number;
    criticalRisk: number;
    iamUsers: number;
    iamRoles: number;
    activeAccessKeys: number;
    oldAccessKeys: number;
    administratorIdentities: number;
    wildcardPermissions: number;
    administratorAccess: number;
    powerUserAccess: number;
    dangerousIamPermissions: number;
    leastPrivilegeReview: number;
  };
  aiAgents: {
    total: number;
    highRisk: number;
    criticalRisk: number;
    active: number;
    suspended: number;
    averageRisk: number;
  };
  policies: {
    total: number;
    active: number;
    totalViolations: number;
    openViolations: number;
    criticalViolations: number;
    compliancePercentage: number | null;
  };
  alerts: {
    total: number;
    open: number;
    critical: number;
    high: number;
  };
  securityScore: {
    score: number | null;
    statusLabel: string;
    identityRiskBadge: string;
    agentRiskBadge: string;
  };
  breakdown: {
    identitySecurityScore: number | null;
    aiAgentSecurityScore: number | null;
    accessGovernanceScore: number | null;
    policyComplianceScore: number | null;
  };
  attentionRequired: Array<{
    id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    what: string;
    why: string;
    action: string;
    link: string;
  }>;
  recentActivity: Array<{
    id: string;
    actor: string;
    event: string;
    time: string;
    timestamp: string;
    type: 'critical' | 'warning' | 'healthy' | 'info';
  }>;
  riskTrend: RiskTrendPoint[];
  aiInsight?: {
    text: string;
    recommendation: string;
    targetLink?: string;
  } | null;
}

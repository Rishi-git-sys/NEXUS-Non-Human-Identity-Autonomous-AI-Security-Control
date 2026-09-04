import { Database } from '@/types/supabase';
import { NexusRisk, RiskFactor, AWSSecurityIntelligence } from '@/lib/types/identity';
import { isAWSIAMIdentity, isAWSServiceLinkedRole } from '@/lib/integrations/aws/utils';
import {
  SecurityFinding,
  SecurityFindingCategory,
  SecurityFindingSeverity,
} from './types';
import { sanitizeEvidence } from './evidence';

type IdentityRow = Database['public']['Tables']['identities']['Row'];

/**
 * Maps known risk factor codes to their deterministic security category.
 */
export function getFactorCategory(code: string): SecurityFindingCategory {
  switch (code) {
    case 'IAM_USER_LONG_LIVED_CREDENTIAL_RISK':
    case 'AWS_ACCESS_KEY_ACTIVE':
    case 'AWS_MULTIPLE_ACTIVE_KEYS':
    case 'AWS_ACCESS_KEY_OLD_180':
    case 'CREDENTIAL_AGE_OVER_90_DAYS':
    case 'ACCESS_KEY_POSTURE_UNKNOWN':
      return 'CREDENTIAL';

    case 'AWS_ADMINISTRATOR_POLICY':
    case 'AWS_POWERUSER_POLICY':
    case 'AWS_WILDCARD_ACTION':
    case 'AWS_WILDCARD_RESOURCE':
    case 'AWS_DANGEROUS_IAM_PERMISSION':
    case 'IAM_ROLE_ASSUMPTION_RISK':
      return 'PERMISSION';

    case 'AWS_API_PERMISSION_ERROR':
    case 'AWS_MANAGED_SERVICE_ROLE':
      return 'AWS';

    default:
      if (code.startsWith('AI_AGENT_')) return 'AI_AGENT';
      if (code.startsWith('AWS_')) return 'AWS';
      return 'IDENTITY';
  }
}

/**
 * Maps risk factor severity string to normalized SecurityFindingSeverity.
 * Preserves the severity determined by the upstream risk calculation.
 */
export function mapFactorSeverity(severityStr: string): SecurityFindingSeverity {
  const norm = (severityStr || '').toUpperCase().trim();
  switch (norm) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    case 'LOW':
    case 'INFO':
    default:
      return 'LOW';
  }
}

/**
 * Returns the exact deterministic risk point contribution associated with a factor code.
 */
export function getFactorRiskContribution(code: string, severity: SecurityFindingSeverity): number {
  switch (code) {
    case 'AWS_ACCESS_KEY_OLD_180':
    case 'AWS_ADMINISTRATOR_POLICY':
      return 40;
    case 'CREDENTIAL_AGE_OVER_90_DAYS':
    case 'AWS_POWERUSER_POLICY':
      return 30;
    case 'IAM_USER_LONG_LIVED_CREDENTIAL_RISK':
    case 'AWS_WILDCARD_ACTION':
      return 20;
    case 'AWS_MULTIPLE_ACTIVE_KEYS':
    case 'AWS_WILDCARD_RESOURCE':
    case 'AWS_DANGEROUS_IAM_PERMISSION':
      return 15;
    case 'AWS_ACCESS_KEY_ACTIVE':
    case 'IAM_ROLE_ASSUMPTION_RISK':
    case 'AWS_API_PERMISSION_ERROR':
    case 'ACCESS_KEY_POSTURE_UNKNOWN':
      return 10;
    case 'AWS_MANAGED_SERVICE_ROLE':
      return 0;
    default:
      if (severity === 'CRITICAL') return 35;
      if (severity === 'HIGH') return 25;
      if (severity === 'MEDIUM') return 15;
      return 5;
  }
}

/**
 * Builds a structured, safe evidence dictionary from an identity and its AWS intelligence data.
 * Guarantees no secret keys or sensitive tokens are included.
 */
function buildIdentitySafeEvidence(
  identity: IdentityRow,
  factor: RiskFactor
): Record<string, unknown> {
  const meta =
    typeof identity.metadata === 'object' && identity.metadata !== null
      ? (identity.metadata as Record<string, unknown>)
      : {};

  const awsSecurity = meta.awsSecurity as AWSSecurityIntelligence | undefined;
  const isAWS = isAWSIAMIdentity(meta);
  const isServiceLinked = isAWSServiceLinkedRole(meta);

  const keys = awsSecurity?.accessKeys || [];
  const activeKeys = keys.filter((k) => k.status === 'Active');
  let maxKeyAgeDays = 0;
  for (const k of activeKeys) {
    if (k.ageDays > maxKeyAgeDays) maxKeyAgeDays = k.ageDays;
  }

  const policies = awsSecurity?.policies || [];

  // Tailor evidence depending on the factor code
  let rawEvidence: Record<string, unknown> = {
    identityType: identity.identity_type,
    provider: isAWS ? 'AWS' : (meta.provider as string) || 'Nexus',
    isServiceLinkedRole: isServiceLinked,
  };

  switch (factor.code) {
    case 'IAM_USER_LONG_LIVED_CREDENTIAL_RISK':
      rawEvidence = {
        ...rawEvidence,
        credentialType: 'Long-lived IAM User Credential',
        hasActiveAccessKeys: activeKeys.length > 0,
      };
      break;

    case 'AWS_ACCESS_KEY_ACTIVE':
    case 'AWS_MULTIPLE_ACTIVE_KEYS':
    case 'AWS_ACCESS_KEY_OLD_180':
    case 'CREDENTIAL_AGE_OVER_90_DAYS':
    case 'ACCESS_KEY_POSTURE_UNKNOWN':
      rawEvidence = {
        ...rawEvidence,
        activeKeyCount: activeKeys.length,
        totalKeyCount: keys.length,
        maxKeyAgeDays: maxKeyAgeDays,
      };
      break;

    case 'AWS_ADMINISTRATOR_POLICY':
    case 'AWS_POWERUSER_POLICY':
    case 'AWS_WILDCARD_ACTION':
    case 'AWS_WILDCARD_RESOURCE':
    case 'AWS_DANGEROUS_IAM_PERMISSION':
      rawEvidence = {
        ...rawEvidence,
        policyCount: policies.length,
        policyNames: policies.slice(0, 10).map((p) => p.name),
        wildcardActions: awsSecurity?.privilegeSummary?.wildcardActions ?? false,
        wildcardResources: awsSecurity?.privilegeSummary?.wildcardResources ?? false,
        isAdministrator: awsSecurity?.privilegeSummary?.administrator ?? false,
      };
      break;

    case 'AWS_MANAGED_SERVICE_ROLE':
      rawEvidence = {
        ...rawEvidence,
        isServiceLinkedRole: true,
      };
      break;

    case 'AWS_API_PERMISSION_ERROR': {
      const firstError = awsSecurity?.errors?.[0];
      rawEvidence = {
        ...rawEvidence,
        operation: firstError?.operation || 'AWS IAM Enumeration',
        errorCode: firstError?.errorCode || firstError?.errorName || 'AccessDenied',
      };
      break;
    }

    default:
      rawEvidence = {
        ...rawEvidence,
        status: identity.status,
      };
      break;
  }

  return sanitizeEvidence(rawEvidence);
}

/**
 * Normalizes an identity's calculated NexusRisk factors into standard SecurityFinding records.
 * Ensures deduplication by fingerprint `${subjectId}:${code}:${severity}`.
 */
export function normalizeIdentityRiskFactors(
  organizationId: string,
  identity: IdentityRow,
  risk: NexusRisk
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const seenFingerprints = new Set<string>();

  const detectedAt = risk.calculatedAt || new Date().toISOString();
  const meta =
    typeof identity.metadata === 'object' && identity.metadata !== null
      ? (identity.metadata as Record<string, unknown>)
      : {};
  const isAWS = isAWSIAMIdentity(meta);
  const provider = isAWS ? 'AWS' : (meta.provider as string) || 'Nexus';

  for (const factor of risk.riskFactors) {
    if (!factor || !factor.code) continue;

    const severity = mapFactorSeverity(factor.severity);
    const fingerprint = `${identity.id}:${factor.code}:${severity}`;

    if (seenFingerprints.has(fingerprint)) {
      continue;
    }
    seenFingerprints.add(fingerprint);

    const category = getFactorCategory(factor.code);
    const riskContribution = getFactorRiskContribution(factor.code, severity);
    const safeEvidence = buildIdentitySafeEvidence(identity, factor);

    const findingId = `find_${Buffer.from(fingerprint).toString('base64url').slice(0, 24)}`;

    findings.push({
      id: findingId,
      organizationId,
      subjectId: identity.id,
      subjectType: 'identity',
      code: factor.code,
      category,
      severity,
      title: factor.title || factor.code,
      description: factor.description || 'Elevated risk condition detected on identity.',
      recommendation: factor.recommendation || 'Review identity configuration and remediate elevated privileges.',
      riskContribution,
      riskScore: risk.score,
      evidence: safeEvidence,
      provider,
      resourceId: (meta.arn as string) || undefined,
      detectedAt,
      fingerprint,
    });
  }

  return findings;
}

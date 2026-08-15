import { createAdminClient } from '@/lib/supabase/admin';
import { Database } from '@/types/supabase';
import { NexusRisk, RiskFactor, AWSSecurityIntelligence } from '../types/identity';
import { isAWSIAMIdentity, isAWSServiceLinkedRole } from '@/lib/integrations/aws/utils';

type IdentityRow = Database['public']['Tables']['identities']['Row'];

export const RISK_THRESHOLDS = {
  HIGH: 50,
  CRITICAL: 75,
};

export const identityRiskService = {
  /**
   * Deterministically calculates the risk score and factors for an identity.
   */
  calculateRisk(identity: IdentityRow): NexusRisk {
    let score = 0;
    const riskFactors: RiskFactor[] = [];
    const meta = (typeof identity.metadata === 'object' && identity.metadata !== null)
      ? (identity.metadata as Record<string, unknown>)
      : {};

    const isAWS = isAWSIAMIdentity(meta);

    if (!isAWS) {
      return {
        score: identity.risk_score || 0,
        severity: (identity.risk_score || 0) >= RISK_THRESHOLDS.CRITICAL ? 'CRITICAL' : (identity.risk_score || 0) >= RISK_THRESHOLDS.HIGH ? 'HIGH' : (identity.risk_score || 0) >= 25 ? 'MEDIUM' : 'LOW',
        calculatedAt: new Date().toISOString(),
        riskFactors: [],
      };
    }

    let credentialRisk = 0;
    let permissionRisk = 0;
    
    // RULE 1: IAM USER
    if (identity.identity_type === 'service_account') {
      score += 20;
      riskFactors.push({
        code: 'IAM_USER_LONG_LIVED_CREDENTIAL_RISK',
        severity: 'MEDIUM',
        title: 'Long-lived IAM User',
        description: 'IAM users commonly rely on long-lived credentials and therefore carry higher credential exposure risk.',
        recommendation: identityRiskService.getRecommendation('IAM_USER_LONG_LIVED_CREDENTIAL_RISK'),
      });
    }

    // RULE 2: IAM ROLE
    if (identity.identity_type === 'workload_identity') {
      score += 10;
      riskFactors.push({
        code: 'IAM_ROLE_ASSUMPTION_RISK',
        severity: 'LOW',
        title: 'IAM Role Assumption Risk',
        description: 'IAM roles use temporary credentials but may become high impact when broadly assumable or over-permissioned.',
        recommendation: identityRiskService.getRecommendation('IAM_ROLE_ASSUMPTION_RISK'),
      });
    }

    const isServiceLinked = isAWSServiceLinkedRole(meta);
    if (isServiceLinked) {
      riskFactors.push({
        code: 'AWS_MANAGED_SERVICE_ROLE',
        severity: 'INFO',
        title: 'AWS Managed Service-Linked Role',
        description: 'This identity is an AWS-managed service-linked role. Broad permissions may be required by the AWS service and should be reviewed in context rather than treated as equivalent to a custom IAM identity.',
        recommendation: identityRiskService.getRecommendation('AWS_MANAGED_SERVICE_ROLE'),
      });
    }

    const awsSecurity = meta.awsSecurity as AWSSecurityIntelligence | undefined;
    if (awsSecurity && (!awsSecurity.errors || awsSecurity.errors.length === 0)) {
      // Credential Risk Analysis
      const keys = (awsSecurity.accessKeys as Array<{ status: string; ageDays: number }>) || [];
      const activeKeys = keys.filter((k) => k.status === 'Active');
      
      if (activeKeys.length > 0) {
        credentialRisk += 10;
        riskFactors.push({
          code: 'AWS_ACCESS_KEY_ACTIVE',
          severity: 'LOW',
          title: 'Active Access Key',
          description: 'Identity has an active AWS access key.',
          recommendation: identityRiskService.getRecommendation('AWS_ACCESS_KEY_ACTIVE'),
        });
      }

      if (activeKeys.length > 1) {
        credentialRisk += 15;
        riskFactors.push({
          code: 'AWS_MULTIPLE_ACTIVE_KEYS',
          severity: 'MEDIUM',
          title: 'Multiple Active Access Keys',
          description: 'Identity has multiple active access keys, increasing the attack surface.',
          recommendation: identityRiskService.getRecommendation('AWS_MULTIPLE_ACTIVE_KEYS'),
        });
      }

      let maxAge = 0;
      for (const k of activeKeys) {
        if (k.ageDays > maxAge) maxAge = k.ageDays;
      }

      if (maxAge > 180) {
        credentialRisk += 40;
        riskFactors.push({
          code: 'AWS_ACCESS_KEY_OLD_180',
          severity: 'CRITICAL',
          title: 'Access Key Older Than 180 Days',
          description: 'An active access key has not been rotated in over 180 days.',
          recommendation: identityRiskService.getRecommendation('AWS_ACCESS_KEY_OLD_180'),
        });
      } else if (maxAge > 90) {
        credentialRisk += 30;
        riskFactors.push({
          code: 'CREDENTIAL_AGE_OVER_90_DAYS',
          severity: 'HIGH',
          title: 'Credential Older Than 90 Days',
          description: 'An active access key has not been rotated in over 90 days.',
          recommendation: identityRiskService.getRecommendation('CREDENTIAL_AGE_OVER_90_DAYS'),
        });
      }

      // Permission Risk Analysis
      const policies = (awsSecurity.policies as Array<{ name: string; actions: string[]; resources: string[] }>) || [];
      
      let hasAdmin = false;
      let hasPowerUser = false;
      let hasWildcardAction = false;
      let hasWildcardResource = false;
      let hasDangerous = false;

      const dangerousPermissions = ['iam:*', 'iam:PassRole', 'iam:CreatePolicy', 'iam:AttachRolePolicy', 'iam:CreateUser', 'iam:PutRolePolicy', 'sts:AssumeRole'];

      for (const p of policies) {
        const isActionWildcard = Array.isArray(p.actions) && p.actions.includes('*');
        const isResourceWildcard = Array.isArray(p.resources) && p.resources.includes('*');
        
        if (p.name === 'AdministratorAccess' || (isActionWildcard && isResourceWildcard)) {
          hasAdmin = true;
        }
        if (p.name === 'PowerUserAccess') {
          hasPowerUser = true;
        }
        if (isActionWildcard) {
          hasWildcardAction = true;
        }
        if (isResourceWildcard) {
          hasWildcardResource = true;
        }
        if (Array.isArray(p.actions)) {
          for (const a of p.actions) {
            if (dangerousPermissions.includes(a)) {
              hasDangerous = true;
            }
          }
        }
      }

      if (hasAdmin) {
        permissionRisk += isServiceLinked ? 0 : 40;
        riskFactors.push({
          code: 'AWS_ADMINISTRATOR_POLICY',
          severity: isServiceLinked ? 'INFO' : 'CRITICAL',
          title: 'Administrator Access',
          description: isServiceLinked 
            ? 'Service-linked role has administrator-style permissions, which may be required by AWS.'
            : 'Identity has full administrator access to the AWS environment.',
          recommendation: identityRiskService.getRecommendation('AWS_ADMINISTRATOR_POLICY'),
        });
      } else {
        if (hasPowerUser) {
          permissionRisk += isServiceLinked ? 0 : 30;
          riskFactors.push({
            code: 'AWS_POWERUSER_POLICY',
            severity: isServiceLinked ? 'INFO' : 'HIGH',
            title: 'PowerUser Access',
            description: isServiceLinked 
              ? 'Service-linked role has PowerUser access.' 
              : 'Identity has broad PowerUser access to AWS resources.',
            recommendation: identityRiskService.getRecommendation('AWS_POWERUSER_POLICY'),
          });
        }
        
        if (hasWildcardAction && !hasPowerUser) {
          permissionRisk += isServiceLinked ? 0 : 20;
          riskFactors.push({
            code: 'AWS_WILDCARD_ACTION',
            severity: isServiceLinked ? 'INFO' : 'HIGH',
            title: 'Wildcard Action Permissions',
            description: isServiceLinked
              ? 'Service-linked role uses wildcard actions (*).'
              : 'Identity policies contain wildcard actions (*), granting broad capabilities.',
            recommendation: identityRiskService.getRecommendation('AWS_WILDCARD_ACTION'),
          });
        }

        if (hasWildcardResource) {
          permissionRisk += isServiceLinked ? 0 : 15;
          riskFactors.push({
            code: 'AWS_WILDCARD_RESOURCE',
            severity: isServiceLinked ? 'INFO' : 'MEDIUM',
            title: 'Wildcard Resource Permissions',
            description: isServiceLinked
              ? 'Service-linked role policies apply to wildcard resources (*).'
              : 'Identity policies apply to wildcard resources (*), increasing potential blast radius.',
            recommendation: identityRiskService.getRecommendation('AWS_WILDCARD_RESOURCE'),
          });
        }

        if (hasDangerous) {
          permissionRisk += isServiceLinked ? 0 : 15;
          riskFactors.push({
            code: 'AWS_DANGEROUS_IAM_PERMISSION',
            severity: isServiceLinked ? 'INFO' : 'HIGH',
            title: 'Dangerous Permissions',
            description: isServiceLinked
              ? 'Service-linked role possesses dangerous permissions, assumed necessary for the service.'
              : 'Identity possesses permissions that can modify security boundaries, compute, or critical data.',
            recommendation: identityRiskService.getRecommendation('AWS_DANGEROUS_IAM_PERMISSION'),
          });
        }
      }

    } else {
      // RULE: UNKNOWN ACCESS KEY POSTURE (Either missing or API error)
      credentialRisk += 10;
      const hasErrors = awsSecurity?.errors && Array.isArray(awsSecurity.errors) && awsSecurity.errors.length > 0;
      const firstError = hasErrors ? awsSecurity.errors![0] : null;
      riskFactors.push({
        code: hasErrors ? 'AWS_API_PERMISSION_ERROR' : 'ACCESS_KEY_POSTURE_UNKNOWN',
        severity: 'MEDIUM',
        title: hasErrors ? 'AWS IAM Permission Denied' : 'Unknown Access Key Posture',
        description: hasErrors 
          ? `The intelligence crawler encountered an error: ${firstError?.errorCode || firstError?.errorName}`
          : 'The current AWS inventory does not provide sufficient information to verify the identity\'s access-key security posture.',
        recommendation: identityRiskService.getRecommendation(hasErrors ? 'AWS_API_PERMISSION_ERROR' : 'ACCESS_KEY_POSTURE_UNKNOWN'),
      });
    }

    score = score + credentialRisk + permissionRisk;

    // Cap at 100
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    let severity: NexusRisk['severity'] = 'LOW';
    if (score >= RISK_THRESHOLDS.CRITICAL) severity = 'CRITICAL';
    else if (score >= RISK_THRESHOLDS.HIGH) severity = 'HIGH';
    else if (score >= 25) severity = 'MEDIUM';

    return {
      score,
      severity,
      credentialRisk,
      permissionRisk,
      calculatedAt: new Date().toISOString(),
      riskFactors,
    };
  },

  /**
   * Deterministic recommendation mapper for risk factors.
   */
  getRecommendation(code: string): string {
    switch (code) {
      case 'NEXUS_PHASE5B_TEST_HIGH':
        return 'This is a development validation finding and requires no remediation.';
      case 'IAM_USER_LONG_LIVED_CREDENTIAL_RISK':
        return 'Prefer short-lived credentials or temporary AWS credentials where supported, and review whether this IAM user is still required.';
      case 'AWS_ACCESS_KEY_ACTIVE':
      case 'AWS_MULTIPLE_ACTIVE_KEYS':
        return 'Review whether this access key is required and consider temporary credentials where supported.';
      case 'CREDENTIAL_AGE_OVER_90_DAYS':
      case 'AWS_ACCESS_KEY_OLD_180':
        return 'Rotate or replace the credential if it is no longer required.';
      case 'AWS_WILDCARD_RESOURCE':
        return 'Review wildcard configurations. Replace \'*\' resources with the smallest required resource scope.';
      case 'AWS_WILDCARD_ACTION':
        return 'Review action grants. Replace wildcard actions with explicitly required API actions.';
      case 'AWS_ADMINISTRATOR_POLICY':
        return 'Review whether administrator-level access is required for this identity\'s function.';
      case 'AWS_POWERUSER_POLICY':
        return 'Review whether PowerUser-level access can be reduced to service-specific roles.';
      case 'AWS_DANGEROUS_IAM_PERMISSION':
        return 'Validate requirement: Review whether this identity requires permission to modify IAM security boundaries.';
      default:
        return 'Review the identity and associated risk factors to determine necessary remediation steps.';
    }
  },

  /**
   * Generates individual deduplicated alerts for HIGH and CRITICAL risk factors.
   */
  async generateAlertsForRiskFactors(organizationId: string, identity: IdentityRow, risk: NexusRisk): Promise<number> {
    let alertsCreated = 0;
    const adminClient = createAdminClient();
    const meta = (typeof identity.metadata === 'object' && identity.metadata !== null) 
      ? identity.metadata as Record<string, unknown> 
      : {};

    const provider = isAWSIAMIdentity(meta) ? 'AWS' : undefined;
    const awsType = meta.awsType as string | undefined;
    const arn = meta.arn as string | undefined;

    // Fetch existing open alerts for this identity
    const { data: existingAlerts, error: queryError } = await adminClient
      .from('alerts')
      .select('id, metadata')
      .eq('organization_id', organizationId)
      .eq('identity_id', identity.id)
      .eq('alert_type', 'IDENTITY_RISK_ELEVATED')
      .in('status', ['open', 'new', 'investigating', 'acknowledged']);

    if (queryError) {
      console.error('Failed to query existing alerts:', queryError);
      return 0; 
    }

    const openFingerprints = new Set(
      (existingAlerts || []).map(a => {
        const aMeta = (typeof a.metadata === 'object' && a.metadata !== null) 
          ? a.metadata as Record<string, unknown> 
          : {};
        return aMeta.fingerprint as string;
      }).filter(Boolean)
    );

    for (const factor of risk.riskFactors) {
      if (factor.severity !== 'HIGH' && factor.severity !== 'CRITICAL') {
        continue;
      }

      const alertSeverity = factor.severity.toLowerCase();
      const fingerprint = `${identity.id}_${factor.code}_${factor.severity}`;

      if (openFingerprints.has(fingerprint)) {
        continue; // Deduplicated
      }

      const title = factor.title;
      const description = `${identity.name} triggered a ${factor.severity} risk finding: ${factor.description}`;
      const recommendation = this.getRecommendation(factor.code);

      const { error: insertError } = await adminClient
        .from('alerts')
        .insert({
          organization_id: organizationId,
          title,
          description,
          alert_type: 'IDENTITY_RISK_ELEVATED',
          severity: alertSeverity,
          status: 'open',
          identity_id: identity.id,
          metadata: {
            fingerprint,
            riskScore: risk.score,
            riskFactorCode: factor.code,
            provider,
            awsType,
            arn,
            recommendation,
          }
        });

      if (insertError) {
        console.error('Failed to insert alert:', insertError);
      } else {
        alertsCreated++;
      }
    }
    return alertsCreated;
  },

  /**
   * Main entry point to analyze an identity and trigger side effects (DB updates & alerts).
   */
  async analyzeAndAlert(organizationId: string, identityId: string): Promise<boolean> {
    const adminClient = createAdminClient();

    // Re-fetch the identity to ensure we have the latest state
    const { data: identity, error: fetchError } = await adminClient
      .from('identities')
      .select('*')
      .eq('id', identityId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !identity) {
      console.error(`Failed to fetch identity ${identityId} for risk analysis:`, fetchError);
      return false;
    }

    const risk = this.calculateRisk(identity);
    
    // Update identity record
    const meta = (typeof identity.metadata === 'object' && identity.metadata !== null) 
      ? identity.metadata as Record<string, unknown> 
      : {};
      
    const updatedMetadata = {
      ...meta,
      nexusRisk: risk,
    };

    const { error: updateError } = await adminClient
      .from('identities')
      .update({
        risk_score: risk.score,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: updatedMetadata as any,
        updated_at: new Date().toISOString()
      })
      .eq('id', identity.id)
      .eq('organization_id', organizationId);

    if (updateError) {
      console.error(`Failed to update risk score for identity ${identity.id}:`, updateError);
      return false;
    }

    // Trigger alert generation
    await this.generateAlertsForRiskFactors(organizationId, identity, risk);

    return true;
  }
};

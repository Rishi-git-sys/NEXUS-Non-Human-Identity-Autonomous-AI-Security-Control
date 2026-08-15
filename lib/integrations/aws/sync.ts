import { discoverIAMIdentities } from './iam';
import { isAWSIAMIdentity } from './utils';
import { discoverUserIntelligence, discoverRoleIntelligence } from './intelligence';
import { createClient } from '@/lib/supabase/server';
import { AWSSecurityIntelligence } from '@/lib/types/identity';

// Lightweight memory lock to prevent concurrent syncs per organization
const syncLocks = new Map<string, boolean>();

export interface SyncSummary {
  sync: {
    usersDiscovered: number;
    rolesDiscovered: number;
    identitiesCreated: number;
    identitiesUpdated: number;
    skipped: number;
    identitySyncErrors: number;
  };
  intelligence: {
    intelligenceErrors: {
      identityName: string;
      identityType: string;
      operation: string;
      errorName?: string;
      errorCode?: string;
      message?: string;
    }[];
    accessKeysAnalyzed: number;
    policiesAnalyzed: number;
    highRiskIdentities: number;
    criticalRiskIdentities: number;
  };
  riskAnalysis: {
    status: 'success' | 'partial' | 'pending';
    analyzed: number;
    highRisk: number;
    criticalRisk: number;
    alertsCreated: number;
    errors: number;
  };
}

export interface SyncResult {
  success: boolean;
  summary: SyncSummary;
  error?: string;
}

/**
 * Synchronizes discovered AWS identities safely into the Supabase database.
 * @param organizationId - The validated organization ID of the authenticated user
 * @param defaultOwnerId - The user ID executing the sync, to assign to newly created identities
 */
export async function syncAWSIdentities(organizationId: string, defaultOwnerId: string): Promise<SyncResult> {
  const summary: SyncSummary = {
    sync: {
      usersDiscovered: 0,
      rolesDiscovered: 0,
      identitiesCreated: 0,
      identitiesUpdated: 0,
      skipped: 0,
      identitySyncErrors: 0,
    },
    intelligence: {
      intelligenceErrors: [],
      accessKeysAnalyzed: 0,
      policiesAnalyzed: 0,
      highRiskIdentities: 0,
      criticalRiskIdentities: 0,
    },
    riskAnalysis: {
      status: 'pending',
      analyzed: 0,
      highRisk: 0,
      criticalRisk: 0,
      alertsCreated: 0,
      errors: 0,
    }
  };

  if (syncLocks.get(organizationId)) {
    return {
      success: false,
      summary,
      error: 'A synchronization process is already running for this organization.',
    };
  }

  // Acquire lock
  syncLocks.set(organizationId, true);

  try {
    const supabase = await createClient();

    // 1. Discover identities from AWS
    const discovery = await discoverIAMIdentities();
    
    if (!discovery.success) {
      throw new Error(discovery.error || 'Failed to discover AWS identities');
    }

    summary.sync.usersDiscovered = discovery.users.length;
    summary.sync.rolesDiscovered = discovery.roles.length;
    
    const allDiscovered = [...discovery.users, ...discovery.roles];

    if (allDiscovered.length === 0) {
      return { success: true, summary };
    }

    // 2. Fetch existing identities for the organization (Read-then-Write to prevent duplicates without unique constraints)
    const { data: existingIdentities, error: fetchError } = await supabase
      .from('identities')
      .select('id, name, identity_type, owner_id, risk_score, metadata')
      .eq('organization_id', organizationId);

    if (fetchError) {
      throw new Error(`Failed to fetch existing identities: ${fetchError.message}`);
    }

    // Map existing ARNs to their database records
    const existingArnMap = new Map<string, Record<string, unknown>>();
    for (const identity of existingIdentities || []) {
      const meta = identity.metadata as Record<string, unknown>;
      if (meta && typeof meta.arn === 'string') {
        existingArnMap.set(meta.arn, identity as unknown as Record<string, unknown>);
      }
    }

    // 3. Process each discovered identity
    for (const awsId of allDiscovered) {
      try {
        const arn = awsId.metadata.arn;
        if (!awsId.name) {
          summary.sync.identitySyncErrors++;
          continue;
        }

        const existingRecord = existingArnMap.get(arn);

        const safeMetadata = {
          provider: 'AWS',
          environment: 'Production', // Default assumptions mapped from AWS
          arn: awsId.metadata.arn,
          awsType: awsId.metadata.type,
          path: awsId.metadata.path,
          aws_path: awsId.metadata.path, // legacy
          aws_type: awsId.metadata.type, // legacy
          aws_create_date: awsId.metadata.createDate,
          credentialsCount: 1, // Will be overridden or preserved safely
          credentialAgeDays: 0, 
          accessBreadth: 'Medium',
          riskFactors: [],
        };

        if (existingRecord) {
          // Update existing AWS identity
          const existingMeta = (existingRecord.metadata as Record<string, unknown>) || {};
          
          // Merge metadata securely, preserving user-added attributes
          const mergedMetadata = {
            ...existingMeta,
            ...safeMetadata,
            provider: 'AWS', // Ensure existing gets upgraded
            awsType: awsId.metadata.type, // Ensure existing gets upgraded
            // Keep user-configured counts if present
            credentialsCount: existingMeta.credentialsCount ?? safeMetadata.credentialsCount,
            credentialAgeDays: existingMeta.credentialAgeDays ?? safeMetadata.credentialAgeDays,
            accessBreadth: existingMeta.accessBreadth ?? safeMetadata.accessBreadth,
            riskFactors: existingMeta.riskFactors ?? safeMetadata.riskFactors,
          };

          // We check if any core AWS field actually changed to determine "skipped" vs "updated"
          const nameChanged = existingRecord.name !== awsId.name;
          const metaChanged = existingMeta.arn !== safeMetadata.arn || existingMeta.aws_path !== safeMetadata.aws_path;

          if (!nameChanged && !metaChanged) {
            summary.sync.skipped++;
            continue;
          }

          const { error: updateError } = await supabase
            .from('identities')
            .update({
              name: awsId.name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              metadata: mergedMetadata as any,
              // We do not overwrite identity_type if it was changed by user
              // We do not overwrite owner_id
              // We do not overwrite risk_score
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingRecord.id as string)
            .eq('organization_id', organizationId); // Organization bounds check

          if (updateError) throw updateError;
          summary.sync.identitiesUpdated++;

        } else {
          // Create new AWS identity
          const { error: insertError } = await supabase
            .from('identities')
            .insert({
              organization_id: organizationId,
              name: awsId.name,
              identity_type: awsId.identity_type, // 'service_account' or 'workload_identity'
              status: awsId.status,
              risk_score: 25, // Default base risk
              owner_id: defaultOwnerId,
              last_seen_at: new Date().toISOString(),
              metadata: safeMetadata,
            });

          if (insertError) throw insertError;
          summary.sync.identitiesCreated++;
        }
      } catch (err) {
        console.error(`Failed to sync AWS identity ${awsId.name}:`, err);
        summary.sync.identitySyncErrors++;
      }
    }

    // --- PHASE 3: RISK ANALYSIS ---
    try {
      summary.riskAnalysis = {
        status: 'success',
        analyzed: 0,
        highRisk: 0,
        criticalRisk: 0,
        alertsCreated: 0,
        errors: 0,
      };

      // We need to fetch the identities we just created/updated to calculate risk
      // To keep it efficient, we fetch all AWS identities for the org
      const { data: currentAWSIdentities, error: fetchError } = await supabase
        .from('identities')
        .select('*')
        .eq('organization_id', organizationId);

      if (fetchError) throw fetchError;

      const { identityRiskService } = await import('@/lib/services/identityRiskService');
      const identityUpdates = [];

      for (const identity of currentAWSIdentities || []) {
        const meta = (typeof identity.metadata === 'object' && identity.metadata !== null) ? (identity.metadata as Record<string, unknown>) : {};
        
        const isAWS = isAWSIAMIdentity(meta);

        if (!isAWS) continue;

        try {
          let awsSecurity = meta.awsSecurity;
          
          if (identity.identity_type === 'service_account') {
            const intel = await discoverUserIntelligence(identity.name);
            awsSecurity = intel;
            if (intel.errors && intel.errors.length > 0) {
              for (const err of intel.errors) {
                summary.intelligence.intelligenceErrors.push({
                  identityName: identity.name,
                  identityType: 'IAM User',
                  ...err,
                });
              }
            }
            // Always add what we successfully found
            summary.intelligence.accessKeysAnalyzed += intel.accessKeys.length;
            summary.intelligence.policiesAnalyzed += intel.policies.length;
          } else if (identity.identity_type === 'workload_identity') {
            const intel = await discoverRoleIntelligence(identity.name);
            awsSecurity = intel;
            if (intel.errors && intel.errors.length > 0) {
              for (const err of intel.errors) {
                summary.intelligence.intelligenceErrors.push({
                  identityName: identity.name,
                  identityType: 'IAM Role',
                  ...err,
                });
              }
            }
            summary.intelligence.policiesAnalyzed += intel.policies.length;
          }
          
          meta.awsSecurity = awsSecurity;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          identity.metadata = meta as any;

          const risk = identityRiskService.calculateRisk(identity);
          summary.riskAnalysis.analyzed++;

          if (risk.severity === 'HIGH') {
            summary.riskAnalysis.highRisk++;
            summary.intelligence.highRiskIdentities++;
          }
          if (risk.severity === 'CRITICAL') {
            summary.riskAnalysis.criticalRisk++;
            summary.intelligence.criticalRiskIdentities++;
          }

          const updatedMetadata = { ...meta, nexusRisk: risk };
          
          console.log(`[PHASE4] PERSIST: { identityName: ${identity.name}, identityType: ${identity.identity_type}, accessKeyCount: ${(awsSecurity as AWSSecurityIntelligence)?.accessKeys?.length || 0}, policyCount: ${(awsSecurity as AWSSecurityIntelligence)?.policies?.length || 0}, credentialRisk: ${risk.credentialRisk || 0}, permissionRisk: ${risk.permissionRisk || 0}, totalRisk: ${risk.score} }`);

          identityUpdates.push({
            id: identity.id,
            organization_id: organizationId,
            name: identity.name,
            identity_type: identity.identity_type,
            status: identity.status,
            owner_id: identity.owner_id,
            risk_score: risk.score,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            metadata: updatedMetadata as any,
            last_seen_at: identity.last_seen_at,
            created_at: identity.created_at,
            updated_at: new Date().toISOString()
          });

          // Generate alert if needed
          const alertsCreated = await identityRiskService.generateAlertsForRiskFactors(organizationId, identity, risk);
          if (alertsCreated > 0) summary.riskAnalysis.alertsCreated += alertsCreated;
        } catch (riskErr) {
          console.error(`Risk analysis failed for identity ${identity.id}:`, riskErr);
          summary.riskAnalysis.errors++;
          summary.riskAnalysis.status = 'partial';
        }
      }

      // Upsert the risk scores back to database efficiently
      if (identityUpdates.length > 0) {
        const { error: batchUpdateError } = await supabase
          .from('identities')
          .upsert(identityUpdates, { onConflict: 'id' });

        if (batchUpdateError) {
          console.error('Failed to batch update risk scores:', batchUpdateError);
          summary.riskAnalysis.status = 'partial';
          summary.riskAnalysis.errors++;
        }
      }
      
      if (summary.riskAnalysis.status === 'pending') {
        summary.riskAnalysis.status = 'success';
      }

    } catch (riskSystemError) {
      console.error('Risk analysis subsystem failed:', riskSystemError);
      summary.riskAnalysis = {
        status: 'partial',
        analyzed: 0,
        highRisk: 0,
        criticalRisk: 0,
        alertsCreated: 0,
        errors: 1,
      };
    }

    return { success: true, summary };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown sync error occurred';
    return {
      success: false,
      summary,
      error: message,
    };
  } finally {
    // Always release lock
    syncLocks.delete(organizationId);
  }
}

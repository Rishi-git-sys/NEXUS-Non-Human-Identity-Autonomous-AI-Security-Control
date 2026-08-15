import { 
  IAMClient, 
  ListAccessKeysCommand, 
  ListAttachedUserPoliciesCommand, 
  ListUserPoliciesCommand, 
  GetUserPolicyCommand,
  GetPolicyCommand,
  GetPolicyVersionCommand,
  ListGroupsForUserCommand,
  ListAttachedGroupPoliciesCommand,
  ListGroupPoliciesCommand,
  GetGroupPolicyCommand,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand,
  GetRolePolicyCommand,
  ListAccessKeysCommandOutput,
  ListAttachedUserPoliciesCommandOutput,
  ListUserPoliciesCommandOutput,
  ListGroupsForUserCommandOutput,
  ListAttachedGroupPoliciesCommandOutput,
  ListGroupPoliciesCommandOutput,
  ListAttachedRolePoliciesCommandOutput,
  ListRolePoliciesCommandOutput
} from '@aws-sdk/client-iam';
import { getAWSClient } from './client';
import { AWSSecurityIntelligence, AWSAccessKey, AWSPolicy } from '@/lib/types/identity';

function calculateAgeDays(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// Safely parse a policy document to extract wildcard indicators and administrator flags
function parsePolicyDocument(docString: string): { actions: string[], resources: string[], admin: boolean } {
  const result = { actions: [] as string[], resources: [] as string[], admin: false };
  try {
    const decoded = decodeURIComponent(docString);
    const doc = JSON.parse(decoded);
    const statements = Array.isArray(doc.Statement) ? doc.Statement : [doc.Statement];

    for (const stmt of statements) {
      if (!stmt || stmt.Effect !== 'Allow') continue;
      
      const actions = Array.isArray(stmt.Action) ? stmt.Action : (stmt.Action ? [stmt.Action] : []);
      const resources = Array.isArray(stmt.Resource) ? stmt.Resource : (stmt.Resource ? [stmt.Resource] : []);

      for (const a of actions) {
        if (typeof a === 'string') {
          result.actions.push(a);
          if (a === '*') result.admin = true;
        }
      }
      for (const r of resources) {
        if (typeof r === 'string') {
          result.resources.push(r);
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse policy document:', err);
  }
  return result;
}

async function getManagedPolicyDetails(client: IAMClient, policyArn: string): Promise<{ actions: string[], resources: string[], admin: boolean }> {
  try {
    const policyRes = await client.send(new GetPolicyCommand({ PolicyArn: policyArn }));
    const versionId = policyRes.Policy?.DefaultVersionId;
    if (versionId) {
      const versionRes = await client.send(new GetPolicyVersionCommand({ PolicyArn: policyArn, VersionId: versionId }));
      if (versionRes.PolicyVersion?.Document) {
        return parsePolicyDocument(versionRes.PolicyVersion.Document);
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch managed policy ${policyArn}:`, err);
  }
  return { actions: [], resources: [], admin: false };
}

export async function discoverUserIntelligence(userName: string): Promise<AWSSecurityIntelligence> {
  const client = getAWSClient();
  const accessKeys: AWSAccessKey[] = [];
  const policies: AWSPolicy[] = [];
  const groups: string[] = [];
  const intelligenceErrors: NonNullable<AWSSecurityIntelligence['errors']> = [];

  const privilegeSummary = {
    administrator: false,
    wildcardActions: false,
    wildcardResources: false,
  };

  const addError = (operation: string, error: unknown) => {
    const err = error as { name?: string; Code?: string; message?: string; $metadata?: { httpStatusCode?: number; requestId?: string } };
    intelligenceErrors.push({
      operation,
      errorName: err.name || err.Code,
      errorCode: err.Code || err.name,
      message: err.message,
      httpStatusCode: err.$metadata?.httpStatusCode,
      requestId: err.$metadata?.requestId,
    });
    console.error(`[AWS Intelligence] Error in ${operation} for IAM User ${userName}:`, {
      errorName: err.name || err.Code,
      message: err.message,
    });
  };

  // 1. Access Keys
  try {
    console.log(`[PHASE4] discoverUserCredentials START`);
    let keyMarker: string | undefined = undefined;
    do {
      console.log(`[AWS IAM API] ListAccessKeysCommand for ${userName}`);
      const keysRes: ListAccessKeysCommandOutput = await client.send(new ListAccessKeysCommand({ UserName: userName, Marker: keyMarker }));
      for (const k of keysRes.AccessKeyMetadata || []) {
        if (k.AccessKeyId && k.CreateDate && k.Status) {
          accessKeys.push({
            accessKeyId: k.AccessKeyId,
            status: k.Status as 'Active' | 'Inactive',
            createdAt: k.CreateDate.toISOString(),
            ageDays: calculateAgeDays(k.CreateDate),
          });
        }
      }
      keyMarker = keysRes.IsTruncated ? keysRes.Marker : undefined;
    } while (keyMarker);
    console.log(`[PHASE4] discoverUserCredentials RESULT { userName: ${userName}, count: ${accessKeys.length} }`);
  } catch (error) {
    addError('ListAccessKeysCommand', error);
  }

  // 2. Attached Managed Policies
  try {
    console.log(`[PHASE4] discoverUserPolicies START`);
    let attMarker: string | undefined = undefined;
    do {
      console.log(`[AWS IAM API] ListAttachedUserPoliciesCommand for ${userName}`);
      const attRes: ListAttachedUserPoliciesCommandOutput = await client.send(new ListAttachedUserPoliciesCommand({ UserName: userName, Marker: attMarker }));
      for (const p of attRes.AttachedPolicies || []) {
        if (p.PolicyArn && p.PolicyName) {
          const details = await getManagedPolicyDetails(client, p.PolicyArn);
          policies.push({
            name: p.PolicyName,
            arn: p.PolicyArn,
            source: 'managed',
            actions: details.actions,
            resources: details.resources,
            administrator: details.admin || p.PolicyName === 'AdministratorAccess',
          });
        }
      }
      attMarker = attRes.IsTruncated ? attRes.Marker : undefined;
    } while (attMarker);
  } catch (error) {
    addError('ListAttachedUserPoliciesCommand', error);
  }

  // 3. Inline Policies
  try {
    let inlMarker: string | undefined = undefined;
    do {
      console.log(`[AWS IAM API] ListUserPoliciesCommand for ${userName}`);
      const inlRes: ListUserPoliciesCommandOutput = await client.send(new ListUserPoliciesCommand({ UserName: userName, Marker: inlMarker }));
      for (const pName of inlRes.PolicyNames || []) {
        try {
          const pDocRes = await client.send(new GetUserPolicyCommand({ UserName: userName, PolicyName: pName }));
          if (pDocRes.PolicyDocument) {
            const details = parsePolicyDocument(pDocRes.PolicyDocument);
            policies.push({
              name: pName,
              source: 'inline',
              actions: details.actions,
              resources: details.resources,
              administrator: details.admin,
            });
          }
        } catch (innerError) {
          addError('GetUserPolicyCommand', innerError);
        }
      }
      inlMarker = inlRes.IsTruncated ? inlRes.Marker : undefined;
    } while (inlMarker);
  } catch (error) {
    addError('ListUserPoliciesCommand', error);
  }

  // 4. Group Policies
  try {
    let grpMarker: string | undefined = undefined;
    do {
      console.log(`[AWS IAM API] ListGroupsForUserCommand for ${userName}`);
      const grpRes: ListGroupsForUserCommandOutput = await client.send(new ListGroupsForUserCommand({ UserName: userName, Marker: grpMarker }));
      for (const g of grpRes.Groups || []) {
        if (g.GroupName) {
          groups.push(g.GroupName);
          // Group Attached Policies
          try {
            let gAttMarker: string | undefined = undefined;
            do {
              const gAttRes: ListAttachedGroupPoliciesCommandOutput = await client.send(new ListAttachedGroupPoliciesCommand({ GroupName: g.GroupName, Marker: gAttMarker }));
              for (const p of gAttRes.AttachedPolicies || []) {
                if (p.PolicyArn && p.PolicyName) {
                  const details = await getManagedPolicyDetails(client, p.PolicyArn);
                  policies.push({
                    name: p.PolicyName,
                    arn: p.PolicyArn,
                    source: 'group',
                    actions: details.actions,
                    resources: details.resources,
                    administrator: details.admin || p.PolicyName === 'AdministratorAccess',
                  });
                }
              }
              gAttMarker = gAttRes.IsTruncated ? gAttRes.Marker : undefined;
            } while (gAttMarker);
          } catch (error) {
            addError('ListAttachedGroupPoliciesCommand', error);
          }

          // Group Inline Policies
          try {
            let gInlMarker: string | undefined = undefined;
            do {
              const gInlRes: ListGroupPoliciesCommandOutput = await client.send(new ListGroupPoliciesCommand({ GroupName: g.GroupName, Marker: gInlMarker }));
              for (const pName of gInlRes.PolicyNames || []) {
                try {
                  const pDocRes = await client.send(new GetGroupPolicyCommand({ GroupName: g.GroupName, PolicyName: pName }));
                  if (pDocRes.PolicyDocument) {
                    const details = parsePolicyDocument(pDocRes.PolicyDocument);
                    policies.push({
                      name: pName,
                      source: 'group',
                      actions: details.actions,
                      resources: details.resources,
                      administrator: details.admin,
                    });
                  }
                } catch (innerError) {
                  addError('GetGroupPolicyCommand', innerError);
                }
              }
              gInlMarker = gInlRes.IsTruncated ? gInlRes.Marker : undefined;
            } while (gInlMarker);
          } catch (error) {
            addError('ListGroupPoliciesCommand', error);
          }
        }
      }
      grpMarker = grpRes.IsTruncated ? grpRes.Marker : undefined;
    } while (grpMarker);
    console.log(`[PHASE4] discoverUserPolicies RESULT { userName: ${userName}, count: ${policies.length} }`);
  } catch (error) {
    addError('ListGroupsForUserCommand', error);
  }

  // Calculate privilege summary
  for (const p of policies) {
    if (p.administrator) privilegeSummary.administrator = true;
    if (p.actions.includes('*')) privilegeSummary.wildcardActions = true;
    if (p.resources.includes('*')) privilegeSummary.wildcardResources = true;
  }

  return {
    accessKeys,
    policies,
    groups,
    privilegeSummary,
    ...(intelligenceErrors.length > 0 && { errors: intelligenceErrors }),
  };
}

export async function discoverRoleIntelligence(roleName: string): Promise<AWSSecurityIntelligence> {
  const client = getAWSClient();
  const policies: AWSPolicy[] = [];
  const intelligenceErrors: NonNullable<AWSSecurityIntelligence['errors']> = [];

  const privilegeSummary = {
    administrator: false,
    wildcardActions: false,
    wildcardResources: false,
  };

  const addError = (operation: string, error: unknown) => {
    const err = error as { name?: string; Code?: string; message?: string; $metadata?: { httpStatusCode?: number; requestId?: string } };
    intelligenceErrors.push({
      operation,
      errorName: err.name || err.Code,
      errorCode: err.Code || err.name,
      message: err.message,
      httpStatusCode: err.$metadata?.httpStatusCode,
      requestId: err.$metadata?.requestId,
    });
    console.error(`[AWS Intelligence] Error in ${operation} for IAM Role ${roleName}:`, {
      errorName: err.name || err.Code,
      message: err.message,
    });
  };

  // 1. Attached Managed Policies
  try {
    console.log(`[PHASE4] discoverRolePolicies START`);
    let attMarker: string | undefined = undefined;
    do {
      console.log(`[AWS IAM API] ListAttachedRolePoliciesCommand for ${roleName}`);
      const attRes: ListAttachedRolePoliciesCommandOutput = await client.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName, Marker: attMarker }));
      for (const p of attRes.AttachedPolicies || []) {
        if (p.PolicyArn && p.PolicyName) {
          const details = await getManagedPolicyDetails(client, p.PolicyArn);
          policies.push({
            name: p.PolicyName,
            arn: p.PolicyArn,
            source: 'managed',
            actions: details.actions,
            resources: details.resources,
            administrator: details.admin || p.PolicyName === 'AdministratorAccess',
          });
        }
      }
      attMarker = attRes.IsTruncated ? attRes.Marker : undefined;
    } while (attMarker);
  } catch (error) {
    addError('ListAttachedRolePoliciesCommand', error);
  }

  // 2. Inline Policies
  try {
    let inlMarker: string | undefined = undefined;
    do {
      console.log(`[AWS IAM API] ListRolePoliciesCommand for ${roleName}`);
      const inlRes: ListRolePoliciesCommandOutput = await client.send(new ListRolePoliciesCommand({ RoleName: roleName, Marker: inlMarker }));
      for (const pName of inlRes.PolicyNames || []) {
        try {
          const pDocRes = await client.send(new GetRolePolicyCommand({ RoleName: roleName, PolicyName: pName }));
          if (pDocRes.PolicyDocument) {
            const details = parsePolicyDocument(pDocRes.PolicyDocument);
            policies.push({
              name: pName,
              source: 'inline',
              actions: details.actions,
              resources: details.resources,
              administrator: details.admin,
            });
          }
        } catch (innerError) {
          addError('GetRolePolicyCommand', innerError);
        }
      }
      inlMarker = inlRes.IsTruncated ? inlRes.Marker : undefined;
    } while (inlMarker);
    console.log(`[PHASE4] discoverRolePolicies RESULT { roleName: ${roleName}, count: ${policies.length} }`);
  } catch (error) {
    addError('ListRolePoliciesCommand', error);
  }

  // Calculate privilege summary
  for (const p of policies) {
    if (p.administrator) privilegeSummary.administrator = true;
    if (p.actions.includes('*')) privilegeSummary.wildcardActions = true;
    if (p.resources.includes('*')) privilegeSummary.wildcardResources = true;
  }

  return {
    accessKeys: [], // Roles do not have access keys in this context
    policies,
    privilegeSummary,
    ...(intelligenceErrors.length > 0 && { errors: intelligenceErrors }),
  };
}

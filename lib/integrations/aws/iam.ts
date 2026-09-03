import { 
  ListUsersCommand, 
  ListRolesCommand, 
  User, 
  Role,
  ListUsersCommandOutput,
  ListRolesCommandOutput
} from '@aws-sdk/client-iam';
import { getAWSClient } from './client';
import { AWSIAMDiscoveryResult, AWSIdentity } from './types';

/**
 * Normalizes an AWS IAM User to the NEXUS AWSIdentity structure.
 */
function normalizeUser(user: User): AWSIdentity {
  return {
    external_id: user.UserId || user.Arn || '',
    provider: 'AWS',
    identity_type: 'service_account', // Or 'bot' based on DB rules
    name: user.UserName || 'Unknown User',
    status: 'active', // IAM users don't have a direct 'inactive' status at the user level, you'd check passwords/access keys
    metadata: {
      arn: user.Arn || '',
      createDate: user.CreateDate?.toISOString(),
      path: user.Path,
      type: 'IAM User',
    },
  };
}

/**
 * Normalizes an AWS IAM Role to the NEXUS AWSIdentity structure.
 */
function normalizeRole(role: Role): AWSIdentity {
  return {
    external_id: role.RoleId || role.Arn || '',
    provider: 'AWS',
    identity_type: 'workload_identity',
    name: role.RoleName || 'Unknown Role',
    status: 'active', // Roles are generally active unless explicitly blocked by policies
    metadata: {
      arn: role.Arn || '',
      createDate: role.CreateDate?.toISOString(),
      path: role.Path,
      type: 'IAM Role',
    },
  };
}

/**
 * Discovers IAM users and roles in the configured AWS account.
 * Handles pagination.
 */
export async function discoverIAMIdentities(): Promise<AWSIAMDiscoveryResult> {
  try {
    const client = await getAWSClient();
    const users: AWSIdentity[] = [];
    const roles: AWSIdentity[] = [];

    // 1. Fetch Users
    let isUserTruncated = true;
    let userMarker: string | undefined = undefined;

    while (isUserTruncated) {
      const command = new ListUsersCommand({ Marker: userMarker });
      const response: ListUsersCommandOutput = await client.send(command);
      
      if (response.Users) {
        for (const u of response.Users) {
          users.push(normalizeUser(u));
        }
      }

      isUserTruncated = response.IsTruncated ?? false;
      userMarker = response.Marker;
    }

    // 2. Fetch Roles
    let isRoleTruncated = true;
    let roleMarker: string | undefined = undefined;

    while (isRoleTruncated) {
      const command = new ListRolesCommand({ Marker: roleMarker });
      const response: ListRolesCommandOutput = await client.send(command);
      
      if (response.Roles) {
        for (const r of response.Roles) {
          // Typically we skip AWS service-linked roles for pure identity governance
          // but we can include them all initially and filter in UI
          roles.push(normalizeRole(r));
        }
      }

      isRoleTruncated = response.IsTruncated ?? false;
      roleMarker = response.Marker;
    }

    return {
      success: true,
      provider: 'AWS',
      users,
      roles,
      summary: {
        users: users.length,
        roles: roles.length,
      }
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AWS IAM error';
    // We do NOT expose full stack traces for security.
    return {
      success: false,
      provider: 'AWS',
      users: [],
      roles: [],
      summary: { users: 0, roles: 0 },
      error: `Failed to discover IAM identities: ${message}`,
    };
  }
}

import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';

/**
 * PHASE 7B: AWS Dynamic Credential Federation
 * 
 * Manages acquisition and in-memory caching of temporary AWS STS credentials
 * via AssumeRole. Eliminates long-lived static credentials in production.
 * 
 * Security Guarantees:
 * 1. Server-side only (never exposed to browser, cookies, or storage).
 * 2. In-memory cache only (never persisted to DB).
 * 3. Bounded session lifetimes (default 1 hour, auto-refreshed before expiry).
 * 4. Never logs access keys, secret keys, or session tokens.
 * 5. Strictly enforces no-silent-downgrade when federated mode fails.
 */

export interface AWSTemporaryCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

export type AWSAuthMode = 'federated' | 'static' | 'unconfigured';

interface CachedCredentialRecord {
  credentials: AWSTemporaryCredentials;
  cacheKey: string;
}

// In-memory cache for temporary credentials; never persisted to disk or DB
let cachedRecord: CachedCredentialRecord | null = null;

// Test hook for isolated in-memory unit tests without live AWS STS access
let mockSTSClientInstance: STSClient | null = null;

export function _setMockSTSClientForTesting(client: STSClient | null): void {
  mockSTSClientInstance = client;
}

/**
 * Returns the currently active AWS authentication mode.
 * - 'federated': AWS_ROLE_ARN is configured (Production preference)
 * - 'static': AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY configured without role (Development fallback)
 * - 'unconfigured': neither is sufficiently configured
 */
export function getAWSAuthMode(): AWSAuthMode {
  const roleArn = process.env.AWS_ROLE_ARN?.trim();
  if (roleArn) {
    return 'federated';
  }

  const accessKey = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (accessKey && secretKey) {
    return 'static';
  }

  return 'unconfigured';
}

/**
 * Determines whether the required AWS configuration is present.
 */
export function hasAWSConfiguration(): boolean {
  const region = process.env.AWS_REGION?.trim();
  if (!region) return false;

  const mode = getAWSAuthMode();
  return mode !== 'unconfigured';
}

/**
 * Safely resolves the configured AWS region or falls back to 'us-east-1'.
 */
export function getAWSRegion(): string {
  return process.env.AWS_REGION?.trim() || 'us-east-1';
}

/**
 * Resolves session duration bounded within AWS STS limits (900s to 43200s).
 * Default: 3600s (1 hour).
 */
export function getSessionDurationSeconds(): number {
  const rawDuration = process.env.AWS_SESSION_DURATION?.trim();
  if (rawDuration) {
    const parsed = parseInt(rawDuration, 10);
    if (!isNaN(parsed) && parsed >= 900 && parsed <= 43200) {
      return parsed;
    }
  }
  return 3600;
}

/**
 * Sanitizes role session name according to AWS naming rules:
 * [\w+=,.@-]{2,64}
 */
export function getRoleSessionName(): string {
  const configured = process.env.AWS_ROLE_SESSION_NAME?.trim();
  if (configured) {
    const sanitized = configured.replace(/[^\w+=,.@-]/g, '-').slice(0, 64);
    if (sanitized.length >= 2) return sanitized;
  }
  return 'nexus-security-governance-session';
}

/**
 * Generates an in-memory cache key based on role ARN and external ID.
 */
function buildCacheKey(roleArn: string, externalId?: string): string {
  return `${roleArn}::${externalId || 'no-external-id'}`;
}

/**
 * Clears the in-memory temporary credential cache.
 */
export function clearAWSCredentialCache(): void {
  cachedRecord = null;
}

/**
 * Inspects if the cached credentials are valid and have sufficient lifetime remaining.
 * We require at least a 5-minute buffer before expiration to ensure active calls complete safely.
 */
export function isCachedCredentialValid(record: CachedCredentialRecord | null, targetCacheKey: string): boolean {
  if (!record) return false;
  if (record.cacheKey !== targetCacheKey) return false;

  const now = Date.now();
  const expiresAt = record.credentials.expiration.getTime();
  const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer

  return expiresAt - now > REFRESH_BUFFER_MS;
}

/**
 * Obtains temporary credentials through AWS STS AssumeRole with server-side in-memory caching.
 * 
 * CRITICAL ZERO-TRUST RULE:
 * If federated mode is active (AWS_ROLE_ARN configured), this function will NEVER fall back
 * to static credentials on failure. Failure to assume role aborts securely.
 */
export async function getTemporaryCredentials(): Promise<AWSTemporaryCredentials> {
  const roleArn = process.env.AWS_ROLE_ARN?.trim();
  if (!roleArn) {
    throw new Error('AWS federation configuration error: AWS_ROLE_ARN is not defined.');
  }

  // Basic ARN format validation
  if (!roleArn.startsWith('arn:aws:iam::') && !roleArn.startsWith('arn:aws-us-gov:iam::') && !roleArn.startsWith('arn:aws-cn:iam::')) {
    throw new Error('AWS federation configuration error: Invalid AWS_ROLE_ARN format.');
  }

  const externalId = process.env.AWS_EXTERNAL_ID?.trim() || undefined;
  const cacheKey = buildCacheKey(roleArn, externalId);

  // 1. Check in-memory cache
  if (cachedRecord && isCachedCredentialValid(cachedRecord, cacheKey)) {
    return cachedRecord.credentials;
  }

  // 2. Perform STS AssumeRole
  const region = getAWSRegion();
  const durationSeconds = getSessionDurationSeconds();
  const sessionName = getRoleSessionName();

  const stsClient = mockSTSClientInstance || new STSClient({
    region,
    credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
          sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
        }
      : undefined, // Uses environment/IRSA/instance profile default provider chain
  });

  try {
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      ExternalId: externalId,
      DurationSeconds: durationSeconds,
    });

    const response = await stsClient.send(command);

    if (
      !response.Credentials ||
      !response.Credentials.AccessKeyId ||
      !response.Credentials.SecretAccessKey ||
      !response.Credentials.SessionToken ||
      !response.Credentials.Expiration
    ) {
      throw new Error('Incomplete credential payload returned from AWS STS.');
    }

    const temporaryCredentials: AWSTemporaryCredentials = {
      accessKeyId: response.Credentials.AccessKeyId,
      secretAccessKey: response.Credentials.SecretAccessKey,
      sessionToken: response.Credentials.SessionToken,
      expiration: response.Credentials.Expiration,
    };

    // Store in module-level in-memory cache
    cachedRecord = {
      credentials: temporaryCredentials,
      cacheKey,
    };

    return temporaryCredentials;
  } catch (error: unknown) {
    // Sanitized error handling: Never leak credentials, raw trace headers, or tokens
    const err = error as { name?: string; message?: string };
    const errorName = err.name || 'STSAssumeRoleError';
    
    // Log safe diagnostic information without any secret material
    console.error(`[AWS Federation] STS AssumeRole failed for role [${roleArn}]: ${errorName}`);

    // Map common STS errors to clear, safe descriptions
    let safeMessage = 'Failed to assume federated AWS role.';
    if (errorName === 'AccessDenied' || errorName === 'AccessDeniedException') {
      safeMessage = 'AWS STS Access Denied: The caller is not authorized to assume the specified role or the trust policy/ExternalId is invalid.';
    } else if (errorName === 'MalformedPolicyDocument' || errorName === 'MalformedPolicyDocumentException') {
      safeMessage = 'AWS STS Error: Malformed role policy document.';
    } else if (errorName === 'PackedPolicyTooLarge' || errorName === 'PackedPolicyTooLargeException') {
      safeMessage = 'AWS STS Error: Packed policy exceeds maximum allowed size.';
    } else if (errorName === 'ExpiredToken' || errorName === 'ExpiredTokenException') {
      safeMessage = 'AWS STS Error: Calling entity security token has expired.';
    }

    throw new Error(safeMessage);
  }
}

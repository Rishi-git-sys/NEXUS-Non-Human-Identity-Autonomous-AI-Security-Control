import { IAMClient } from '@aws-sdk/client-iam';
import { 
  getTemporaryCredentials, 
  getAWSAuthMode, 
  hasAWSConfiguration, 
  getAWSRegion,
  type AWSAuthMode 
} from './credentials';

export { hasAWSConfiguration, getAWSAuthMode, type AWSAuthMode };

/**
 * Creates and returns an AWS IAM client.
 * 
 * Production Flow (Dynamic Credential Federation):
 * 1. Checks AWS_ROLE_ARN. If present, calls AWS STS AssumeRole via credentials.ts.
 * 2. Uses temporary scoped credentials (AccessKeyId, SecretAccessKey, SessionToken).
 * 3. Utilizes server-side in-memory caching to avoid repeated STS API overhead.
 * 
 * Development Fallback Flow (Static Long-Lived Keys):
 * 1. If AWS_ROLE_ARN is not configured and static keys exist, falls back to direct keys.
 * 2. Emits a security warning if running with static keys in a production environment.
 * 
 * Fails safely by throwing a controlled error rather than crashing or exposing secrets.
 * The IAMClient remains strictly server-side.
 */
export async function getAWSClient(): Promise<IAMClient> {
  if (!hasAWSConfiguration()) {
    throw new Error('AWS integration is not configured. Missing credentials or role configuration.');
  }

  const region = getAWSRegion();
  const authMode = getAWSAuthMode();

  if (authMode === 'federated') {
    const temporaryCredentials = await getTemporaryCredentials();
    return new IAMClient({
      region,
      credentials: {
        accessKeyId: temporaryCredentials.accessKeyId,
        secretAccessKey: temporaryCredentials.secretAccessKey,
        sessionToken: temporaryCredentials.sessionToken,
      },
    });
  }

  if (authMode === 'static') {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS static configuration error: Missing accessKeyId or secretAccessKey.');
    }

    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[SECURITY WARNING] AWS integration is operating in STATIC credential mode in production. ' +
        'Configuring AWS_ROLE_ARN for STS federation is strongly recommended.'
      );
    }

    return new IAMClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
      },
    });
  }

  throw new Error('AWS integration is unconfigured.');
}

import { IAMClient } from '@aws-sdk/client-iam';

/**
 * Creates and returns an AWS IAM client.
 * Uses environment variables securely.
 * Fails safely by returning null or throwing a controlled error
 * rather than crashing the Next.js process on import.
 */
export function getAWSClient(): IAMClient {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error('AWS integration is not configured. Missing credentials or region.');
  }

  // Intentionally returning a new client per request to avoid caching stale credentials,
  // or you could cache it here if needed, but for security in Nexus it's fine per-request.
  return new IAMClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Tests if the AWS configuration is present.
 */
export function hasAWSConfiguration(): boolean {
  return !!(
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

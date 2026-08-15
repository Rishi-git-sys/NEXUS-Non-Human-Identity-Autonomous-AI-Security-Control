export function isAWSIAMIdentity(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  
  const provider = String(metadata.provider || '').toLowerCase();
  const arn = metadata.arn;

  return (
    provider === 'aws' &&
    typeof arn === 'string' &&
    arn.startsWith('arn:aws:iam::')
  );
}

export function isAWSServiceLinkedRole(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  
  const path = typeof metadata.path === 'string' ? metadata.path : '';
  const arn = typeof metadata.arn === 'string' ? metadata.arn : '';
  
  if (path.includes('/aws-service-role/') || arn.includes('aws-service-role/')) {
    return true;
  }

  // Check managed policies
  const awsSecurity = metadata.awsSecurity as { policies?: Array<{ arn?: string }> } | undefined;
  if (awsSecurity && Array.isArray(awsSecurity.policies)) {
    for (const policy of awsSecurity.policies) {
      if (typeof policy.arn === 'string' && policy.arn.includes('aws-service-role/')) {
        return true;
      }
    }
  }

  return false;
}

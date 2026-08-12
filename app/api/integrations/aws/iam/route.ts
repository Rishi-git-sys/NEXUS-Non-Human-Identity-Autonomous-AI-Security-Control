import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/authorization';
import { hasAWSConfiguration } from '@/lib/integrations/aws/client';
import { discoverIAMIdentities } from '@/lib/integrations/aws/iam';

export async function GET() {
  try {
    // Authenticated user required, organization determined from authenticated profile
    await requireRole(['admin']);

    if (!hasAWSConfiguration()) {
      return NextResponse.json(
        {
          success: false,
          provider: 'aws',
          users: [],
          roles: [],
          summary: { users: 0, roles: 0 },
          error: 'AWS integration is not configured',
        },
        { status: 400 }
      );
    }

    // Discover IAM users and roles and normalize the results
    const discoveryResult = await discoverIAMIdentities();

    if (!discoveryResult.success) {
      return NextResponse.json(discoveryResult, { status: 500 });
    }

    // Return discovery results safely
    return NextResponse.json(discoveryResult);
  } catch (error: unknown) {
    const status = (error as Record<string, unknown>)?.status as number || 500;
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        provider: 'aws',
        users: [],
        roles: [],
        summary: { users: 0, roles: 0 },
        error: status === 401 || status === 403 
          ? message 
          : 'Failed to discover AWS IAM identities.',
      },
      { status }
    );
  }
}

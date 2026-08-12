import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/authorization';
import { hasAWSConfiguration } from '@/lib/integrations/aws/client';
import { syncAWSIdentities } from '@/lib/integrations/aws/sync';

export async function POST() {
  try {
    // Authenticated user required, organization extracted strictly from the token
    const { user, organizationId } = await requireRole(['admin']);

    if (!hasAWSConfiguration()) {
      return NextResponse.json(
        {
          success: false,
          error: 'AWS integration is not configured',
          summary: {
            usersDiscovered: 0,
            rolesDiscovered: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
          }
        },
        { status: 400 }
      );
    }

    // Call safe server-side sync with context org ID
    const result = await syncAWSIdentities(organizationId, user.id);

    if (!result.success) {
      // Differentiate concurrent sync error vs general error
      const status = result.error?.includes('already running') ? 429 : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const status = (error as Record<string, unknown>)?.status as number || 500;
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: status === 401 || status === 403 
          ? message 
          : 'Failed to synchronize AWS IAM identities.',
        summary: {
            usersDiscovered: 0,
            rolesDiscovered: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
        }
      },
      { status }
    );
  }
}

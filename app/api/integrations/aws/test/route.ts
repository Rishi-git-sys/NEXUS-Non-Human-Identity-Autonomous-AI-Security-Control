import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/authorization';
import { getAWSClient, hasAWSConfiguration } from '@/lib/integrations/aws/client';
import { ListUsersCommand } from '@aws-sdk/client-iam';

export async function GET() {
  try {
    // 1. & 2. & 3. Authenticate, Require User, Verify Profile & Organization
    // Only administrators can test the AWS integration initially
    await requireRole(['admin']);

    // 4. Verify AWS configuration exists
    if (!hasAWSConfiguration()) {
      return NextResponse.json(
        {
          success: false,
          provider: 'aws',
          connected: false,
          error: 'AWS integration is not configured',
        },
        { status: 400 }
      );
    }

    // 5. Attempt a lightweight AWS IAM operation
    const client = getAWSClient();
    const command = new ListUsersCommand({ MaxItems: 1 });
    await client.send(command);

    // 6. Return safe response
    return NextResponse.json({
      success: true,
      provider: 'aws',
      connected: true,
    });
  } catch (error: unknown) {
    const status = (error as Record<string, unknown>)?.status as number || 500;
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    // Return a safe failure without leaking AWS secrets or raw stack traces
    return NextResponse.json(
      {
        success: false,
        provider: 'aws',
        connected: false,
        error: status === 401 || status === 403 
          ? message 
          : 'Failed to connect to AWS with current configuration.',
      },
      { status }
    );
  }
}

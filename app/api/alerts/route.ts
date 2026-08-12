import { requireAuth } from '@/lib/auth/authorization';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { alertService } from '@/lib/services/alertService';

import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireAuth();

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const severity = url.searchParams.get('severity') || undefined;
    const identityId = url.searchParams.get('identityId') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const result = await alertService.getAlerts(organizationId, {
      status, severity, identityId, search, page, limit
    });
    return apiSuccess(result);
  } catch (err: unknown) {
    const status = (err as Record<string, unknown>)?.status as number || 500;
    const message = (err as Error)?.message || 'Failed to fetch alerts.';

    if (status === 401) return apiUnauthorized(message);
    if (status === 403) return apiForbidden(message);
    return apiError(message, status);
  }
}

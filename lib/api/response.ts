import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function apiError(message: string, status = 400) {
  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

export function apiUnauthorized(message = 'Unauthorized. Please sign in.') {
  return apiError(message, 401);
}

export function apiForbidden(message = 'Forbidden. Insufficient permissions for this resource.') {
  return apiError(message, 403);
}

export function apiNotFound(message = 'Resource not found.') {
  return apiError(message, 404);
}

export function apiConflict(message = 'Resource conflict.') {
  return apiError(message, 409);
}

export function apiTooManyRequests(
  message = 'Too many requests. Please try again later.',
  headers?: Record<string, string>
) {
  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error: message,
    },
    {
      status: 429,
      headers,
    }
  );
}

export function apiServerError(message = 'Internal server error.') {
  return apiError(message, 500);
}

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { apiTooManyRequests } from '@/lib/api/response';

export type RateLimitCategory = 'AUTH' | 'READ' | 'MUTATION' | 'DELETE' | 'EXPENSIVE';

interface RateLimitConfig {
  requests: number;
  windowStr: `${number} s` | `${number} m` | `${number} h`;
  windowSeconds: number;
  failClosed: boolean; // whether to fail-closed on Redis network errors
}

const CATEGORY_CONFIGS: Record<RateLimitCategory, RateLimitConfig> = {
  AUTH: {
    requests: 5,
    windowStr: '60 s',
    windowSeconds: 60,
    failClosed: true,
  },
  READ: {
    requests: 120,
    windowStr: '60 s',
    windowSeconds: 60,
    failClosed: false,
  },
  MUTATION: {
    requests: 30,
    windowStr: '60 s',
    windowSeconds: 60,
    failClosed: false,
  },
  DELETE: {
    requests: 20,
    windowStr: '60 s',
    windowSeconds: 60,
    failClosed: true,
  },
  EXPENSIVE: {
    requests: 10,
    windowStr: '60 s',
    windowSeconds: 60,
    failClosed: true,
  },
};

// In-memory fallback sliding-window store for dev/testing when Upstash env vars are not configured
interface MemoryRecord {
  timestamps: number[];
}
const memoryStore = new Map<string, MemoryRecord>();

function cleanMemoryStore() {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < 120000);
    if (record.timestamps.length === 0) {
      memoryStore.delete(key);
    }
  }
}

// Lazy initialization of Upstash Redis and Limiters
let redisClient: Redis | null = null;
const limiters = new Map<RateLimitCategory, Ratelimit>();
let hasLoggedMissingEnv = false;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!hasLoggedMissingEnv && process.env.NODE_ENV !== 'test') {
      console.warn(
        '[NEXUS Security] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured. Operating in local memory fallback rate-limiting mode.'
      );
      hasLoggedMissingEnv = true;
    }
    return null;
  }

  try {
    redisClient = new Redis({
      url,
      token,
    });
    return redisClient;
  } catch (err) {
    console.error('[NEXUS Security] Failed to initialize Upstash Redis client:', err);
    return null;
  }
}

function getRatelimiter(category: RateLimitCategory): Ratelimit | null {
  const client = getRedisClient();
  if (!client) return null;

  if (limiters.has(category)) {
    return limiters.get(category)!;
  }

  const config = CATEGORY_CONFIGS[category];
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(config.requests, config.windowStr),
    prefix: `nexus:rl:${category.toLowerCase()}`,
    analytics: false,
  });

  limiters.set(category, limiter);
  return limiter;
}

/**
 * Extracts a secure client IP address from request headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

/**
 * Generates an isolated rate limit identifier based on tenant context or client IP.
 */
export function getRateLimitIdentifier(
  req: NextRequest,
  category: RateLimitCategory,
  authContext?: { userId?: string; organizationId?: string }
): string {
  if (authContext?.organizationId && authContext?.userId) {
    // Composite key isolated by organization and user to prevent cross-tenant bucket starvation
    return `org_${authContext.organizationId}:usr_${authContext.userId}:${category.toLowerCase()}`;
  }

  const ip = getClientIp(req);
  return `ip_${ip}:${category.toLowerCase()}`;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  response?: NextResponse;
}

/**
 * Fallback in-memory rate limiter when Redis is unconfigured or unavailable.
 */
function checkMemoryFallback(
  identifier: string,
  category: RateLimitCategory
): { success: boolean; limit: number; remaining: number; reset: number } {
  cleanMemoryStore();
  const now = Date.now();
  const config = CATEGORY_CONFIGS[category];
  const windowMs = config.windowSeconds * 1000;

  let record = memoryStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    memoryStore.set(identifier, record);
  }

  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  const limit = config.requests;
  const currentCount = record.timestamps.length;
  const reset = Math.ceil((now + windowMs) / 1000);

  if (currentCount >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset,
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    limit,
    remaining: limit - (currentCount + 1),
    reset,
  };
}

/**
 * Enforces rate limiting against the specified category.
 * Returns { success: true } if allowed, or { success: false, response: NextResponse } with HTTP 429.
 */
export async function enforceRateLimit(
  req: NextRequest,
  category: RateLimitCategory,
  authContext?: { userId?: string; organizationId?: string }
): Promise<RateLimitResult> {
  const identifier = getRateLimitIdentifier(req, category, authContext);
  const limiter = getRatelimiter(category);
  const config = CATEGORY_CONFIGS[category];

  if (!limiter) {
    // Use in-memory sliding window fallback
    const memResult = checkMemoryFallback(identifier, category);
    if (!memResult.success) {
      const retryAfter = Math.max(1, memResult.reset - Math.floor(Date.now() / 1000));
      return {
        ...memResult,
        response: apiTooManyRequests('Too many requests. Please try again later.', {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(memResult.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(memResult.reset),
        }),
      };
    }
    return memResult;
  }

  try {
    const result = await limiter.limit(identifier);

    if (!result.success) {
      const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      return {
        success: false,
        limit: result.limit,
        remaining: result.remaining,
        reset: Math.ceil(result.reset / 1000),
        response: apiTooManyRequests('Too many requests. Please try again later.', {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
        }),
      };
    }

    return {
      success: true,
      limit: result.limit,
      remaining: result.remaining,
      reset: Math.ceil(result.reset / 1000),
    };
  } catch (err) {
    console.error(`[NEXUS Security] Rate limiter error on category ${category}:`, err);

    if (config.failClosed) {
      return {
        success: false,
        limit: config.requests,
        remaining: 0,
        reset: Math.ceil((Date.now() + config.windowSeconds * 1000) / 1000),
        response: apiTooManyRequests(
          'Security rate check temporarily unavailable. Please retry in a few moments.',
          {
            'Retry-After': '5',
          }
        ),
      };
    }

    // Fail-open for non-critical categories to prevent total system outage on transient Redis errors
    return {
      success: true,
      limit: config.requests,
      remaining: 1,
      reset: Math.ceil(Date.now() / 1000),
    };
  }
}

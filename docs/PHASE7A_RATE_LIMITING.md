# NEXUS — PHASE 7A: DISTRIBUTED RATE LIMITING

**Status**: IMPLEMENTED & VERIFIED  
**Stage**: Phase 7A — Distributed Rate Limiting Control Plane  
**Date**: August 15, 2026  

---

## 1. Executive Summary

Phase 7A introduces enterprise-grade, distributed API rate limiting across the entire NEXUS control plane using `@upstash/ratelimit` and `@upstash/redis`. Rate limiting is enforced at the server-side API boundary, preventing denial-of-service (DoS), brute-force credential enumeration, malicious automated scraping, and API quota exhaustion on external cloud integrations (e.g., AWS IAM discovery).

Multi-tenant isolation is preserved: authenticated requests are tracked via composite keys (`${organizationId}:${userId}:${category}`), ensuring that activity from one tenant never depletes the rate-limiting quota of another.

---

## 2. Architecture & Request Pipeline

```
Browser / Client Request
          ↓
  Next.js API Route Handler
          ↓
  requireAuth() / requireRole()   (Derives verified session, user ID & organization ID)
          ↓
  enforceRateLimit()             (Evaluates Upstash sliding-window rate limit)
          ↓
   Rate Limit Exceeded?
     ├── YES ──> Returns HTTP 429 Too Many Requests (JSON + Retry-After + X-RateLimit headers)
     └── NO  ──> Continues to Data Access Layer / Service Mutation
          ↓
  Audit Logging & Safe JSON Response
```

---

## 3. Dependencies Added

The following production dependencies were added to `package.json`:

- **`@upstash/ratelimit`** (`^2.0.8`): Distributed sliding-window algorithm implementation.
- **`@upstash/redis`** (`^1.36.2`): HTTP REST-based serverless Redis client for edge and serverless runtimes.

---

## 4. Environment Variables Required

The rate limiter reads server-only environment variables:

```bash
# Upstash Redis REST credentials (Server-only, do not prefix with NEXT_PUBLIC_)
UPSTASH_REDIS_REST_URL=https://your-database-id.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-secret-rest-token
```

### Security Considerations:
- **Server Isolation**: These variables are never exposed to browser bundles or client-side components.
- **Graceful Fallback**: In local development or testing environments where Upstash credentials are not yet configured, the system automatically falls back to an in-memory sliding-window store without crashing.

---

## 5. Rate Limit Categories & Limits

| Category | Limit | Algorithm | Purpose & Target Endpoints |
|---|:---:|:---:|---|
| **AUTH / SENSITIVE** | **5 req / min** | Sliding Window (60s) | Authentication endpoints, password resets, sensitive token operations. |
| **READ** | **120 req / min** | Sliding Window (60s) | Query/telemetry retrieval: `/api/identities`, `/api/ai-agents`, `/api/policies`, `/api/resources`, `/api/alerts`, `/api/dashboard`, `/api/access-graph`, `/api/audit`. |
| **MUTATION** | **30 req / min** | Sliding Window (60s) | Standard resource creations and lifecycle updates: `POST/PATCH /api/identities`, `POST/PATCH /api/ai-agents`, `POST/PATCH /api/policies`, `POST/PATCH /api/resources`, `PATCH /api/alerts/[id]`. |
| **DELETE / HIGH-RISK** | **20 req / min** | Sliding Window (60s) | Irreversible destructive mutations: `DELETE /api/policies/[id]`. |
| **AWS / EXPENSIVE** | **10 req / min** | Sliding Window (60s) | High-overhead cloud integrations & compliance scans: `/api/integrations/aws/iam`, `/api/integrations/aws/sync`, `/api/integrations/aws/test`, `POST /api/dashboard/scan`. |

---

## 6. Key Strategy & Tenant Isolation

To prevent cross-tenant rate limit starvation and denial of wallet attacks, NEXUS employs an isolated composite key strategy:

1. **Authenticated Requests**:
   - Format: `org_${organizationId}:usr_${userId}:${category}`
   - Guarantees each tenant and user gets their own dedicated rate-limiting bucket.
2. **Unauthenticated / Public Requests**:
   - Format: `ip_${clientIp}:${category}`
   - Derives IP from `x-forwarded-for` or `x-real-ip` headers.

---

## 7. Protected API Endpoints

All 18 API route handlers in `app/api/**` enforce rate limiting:

| Endpoint | Method | Rate Limit Category | Limit |
|---|:---:|:---:|:---:|
| `/api/access-graph` | `GET` | `READ` | 120 / min |
| `/api/ai-agents` | `GET` | `READ` | 120 / min |
| `/api/ai-agents` | `POST` | `MUTATION` | 30 / min |
| `/api/ai-agents/[id]` | `GET` | `READ` | 120 / min |
| `/api/ai-agents/[id]` | `PATCH` | `MUTATION` | 30 / min |
| `/api/alerts` | `GET` | `READ` | 120 / min |
| `/api/alerts/count` | `GET` | `READ` | 120 / min |
| `/api/alerts/[id]` | `GET` | `READ` | 120 / min |
| `/api/alerts/[id]` | `PATCH` | `MUTATION` | 30 / min |
| `/api/audit` | `GET` | `READ` | 120 / min |
| `/api/dashboard` | `GET` | `READ` | 120 / min |
| `/api/dashboard/scan` | `POST` | `EXPENSIVE` | 10 / min |
| `/api/identities` | `GET` | `READ` | 120 / min |
| `/api/identities` | `POST` | `MUTATION` | 30 / min |
| `/api/identities/[id]` | `GET` | `READ` | 120 / min |
| `/api/identities/[id]` | `PATCH` | `MUTATION` | 30 / min |
| `/api/policies` | `GET` | `READ` | 120 / min |
| `/api/policies` | `POST` | `MUTATION` | 30 / min |
| `/api/policies/[id]` | `GET` | `READ` | 120 / min |
| `/api/policies/[id]` | `PATCH` | `MUTATION` | 30 / min |
| `/api/policies/[id]` | `DELETE` | `DELETE` | 20 / min |
| `/api/resources` | `GET` | `READ` | 120 / min |
| `/api/resources` | `POST` | `MUTATION` | 30 / min |
| `/api/resources/[id]` | `GET` | `READ` | 120 / min |
| `/api/resources/[id]` | `PATCH` | `MUTATION` | 30 / min |
| `/api/integrations/aws/iam` | `GET` | `EXPENSIVE` | 10 / min |
| `/api/integrations/aws/sync` | `POST` | `EXPENSIVE` | 10 / min |
| `/api/integrations/aws/test` | `GET` | `EXPENSIVE` | 10 / min |

---

## 8. HTTP 429 Response Behavior

When a client exceeds their designated category threshold, the API returns a structured HTTP 429 response with RFC-compliant headers:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 42
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1723730000

{
  "success": false,
  "error": "Too many requests. Please try again later."
}
```

---

## 9. Failure Strategy: Fail-Closed vs. Fail-Open

The rate limiter incorporates deliberate failure handling depending on operation sensitivity:

- **`EXPENSIVE`, `AUTH`, `DELETE` Categories (Fail-Closed)**:
  If Redis encounters a transient infrastructure outage or network partition, high-risk mutation and cloud integration endpoints fail-closed, returning a safe HTTP 429 with retry guidance to prevent unmonitored abuse during outages.
- **`READ`, `MUTATION` Categories (Fail-Open / Memory Fallback)**:
  Standard read and operational update endpoints fail-open with structured server error logging to prevent total platform availability loss. In local execution, memory sliding-window fallback provides continuous local rate protection.

---

## 10. Server / Client Boundary Verification

- **Zero Client Imports**: `lib/security/rateLimit.ts` is never imported into client components (`"use client"`).
- **Zero Client Exposure**: No `UPSTASH_*` tokens or Redis clients are bundled into browser JavaScript.

---

## 11. Remaining Limitations & Phase 7B Roadmap

1. **IP Proxy Spoofing**: In environments behind multi-hop reverse proxies, ensure proxy trust headers (`x-forwarded-for`) are validated at the ingress edge (e.g. Cloudflare / AWS ALB).
2. **AWS STS AssumeRole Federation (Phase 7B)**: Migrate AWS integration from static IAM key pairs to temporary STS tokens.

# NEXUS — PHASE 7B: AWS DYNAMIC CREDENTIAL FEDERATION

**Status**: IMPLEMENTED & VERIFIED  
**Stage**: Phase 7B — AWS Dynamic Credential Federation & Governance  
**Date**: September 3, 2026  

---

## 1. Current Security Problem

Prior to Phase 7B, the NEXUS AWS integration relied upon long-lived static AWS credentials (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`). 

In an enterprise Non-Human Identity (NHI) governance control plane, static long-lived credentials introduce severe risks:
- **Credential Sprawl & Leakage**: Long-lived access keys frequently leak via accidental repository commits, container image layers, or environment dumps.
- **Lack of Expiration**: Static keys remain active indefinitely until manually revoked or rotated.
- **Broad Blast Radius**: A compromised static key grants persistent access to the target AWS account without time-bounded containment.
- **Non-Compliance with Zero Trust**: Zero Trust architecture demands ephemeral, just-in-time, scoped credentials rather than persistent secret material.

---

## 2. Old Architecture vs. New Architecture

### Old Architecture (Static Keys)
```
Browser / Admin
       ↓
API Route (/api/integrations/aws/...)
       ↓
getAWSClient()
       ↓
Reads AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY directly from process.env
       ↓
IAMClient initialized with static credentials
       ↓
AWS IAM API
```
*Weakness*: Static credentials must be provisioned and maintained in the environment; no session boundaries or role-based temporal containment.

### New Architecture (Dynamic Federation via STS AssumeRole)
```
Browser / Admin
       ↓
Next.js Server API Boundary (requireRole(['admin']) + enforceRateLimit())
       ↓
getAWSClient() (lib/integrations/aws/client.ts)
       ↓
resolve AWS credentials via getTemporaryCredentials() (lib/integrations/aws/credentials.ts)
       ↓
In-Memory Credential Cache Hit?
  ├── YES (valid > 5 min remaining) ──> Return cached temporary credentials
  └── NO (expired or initial call)  ──> Call AWS STS AssumeRoleCommand
                                            ↓
                               AWS STS returns temporary credentials:
                               (AccessKeyId, SecretAccessKey, SessionToken, Expiration)
                                            ↓
                               Store in server-side in-memory cache
       ↓
IAMClient initialized with temporary session credentials
       ↓
AWS IAM API (Read-only discovery & intelligence)
```

---

## 3. STS AssumeRole Flow

```
+----------------+          +-----------------------+          +--------------------+
|  NEXUS Server  |          | AWS STS (AssumeRole)  |          |   Target AWS IAM   |
+----------------+          +-----------------------+          +--------------------+
       |                                |                                |
       | 1. Check in-memory cache       |                                |
       |    (expired / cache-miss)      |                                |
       |                                |                                |
       | 2. AssumeRoleCommand:          |                                |
       |    - RoleArn                   |                                |
       |    - RoleSessionName           |                                |
       |    - ExternalId                |                                |
       |    - DurationSeconds (3600s)   |                                |
       | -----------------------------> |                                |
       |                                |                                |
       | 3. Validate Trust Policy &     |                                |
       |    ExternalId match            |                                |
       |                                |                                |
       | 4. Return Temporary Creds:     |                                |
       |    - AccessKeyId               |                                |
       |    - SecretAccessKey           |                                |
       |    - SessionToken              |                                |
       |    - Expiration                |                                |
       | <----------------------------- |                                |
       |                                |                                |
       | 5. Store in-memory with buffer |                                |
       |                                |                                |
       | 6. Initialize IAMClient with   |                                |
       |    temporary session token     |                                |
       |                                |                                |
       | 7. ListUsers / ListRoles /     |                                |
       |    GetPolicy / Intelligence    |                                |
       | --------------------------------------------------------------> |
       |                                |                                |
       | 8. Normalized IAM Identities & Risk Scores                     |
       | <-------------------------------------------------------------- |
```

---

## 4. Required Environment Variables

Configure the following server-only environment variables in `.env` (or cloud secrets manager):

```bash
# ==============================================================================
# AWS INTEGRATION (PHASE 7B: DYNAMIC CREDENTIAL FEDERATION)
# ==============================================================================
# The AWS region where STS and IAM clients operate (Default: us-east-1)
AWS_REGION=us-east-1

# Target IAM Role ARN to assume (Production mode)
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/NexusSecurityGovernanceRole

# Optional shared secret to prevent confused deputy attacks in multi-tenant environments
AWS_EXTERNAL_ID=nexus-tenant-unique-external-id

# Custom role session name (alphanumeric + +=,.@-, 2-64 chars)
AWS_ROLE_SESSION_NAME=nexus-governance-session

# Bounded session duration in seconds (900 to 43200; default: 3600)
AWS_SESSION_DURATION=3600

# ------------------------------------------------------------------------------
# DEVELOPMENT FALLBACK ONLY (Optional static credentials)
# ------------------------------------------------------------------------------
# If AWS_ROLE_ARN is unset, NEXUS can fall back to static keys for local testing.
# In production, leave these empty and configure AWS_ROLE_ARN.
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
```

> [!WARNING]
> None of these variables should EVER be prefixed with `NEXT_PUBLIC_`. AWS credentials, role ARNs, and external IDs must remain strictly server-side.

---

## 5. IAM Trust Relationship Requirements

To allow the NEXUS platform to assume the target governance role, configure the IAM Role Trust Policy on the target AWS account:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "NexusAssumeRoleWithExternalId",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::NEXUS_HOSTING_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "nexus-tenant-unique-external-id"
        }
      }
    }
  ]
}
```

### Attached Permission Policy (Least Privilege Read-Only)
The assumed role should possess strictly read-only permissions required for identity discovery and posture assessment:
- `iam:ListUsers`
- `iam:ListRoles`
- `iam:ListAccessKeys`
- `iam:ListAttachedUserPolicies`
- `iam:ListUserPolicies`
- `iam:GetUserPolicy`
- `iam:GetPolicy`
- `iam:GetPolicyVersion`
- `iam:ListGroupsForUser`
- `iam:ListAttachedGroupPolicies`
- `iam:ListGroupPolicies`
- `iam:GetGroupPolicy`
- `iam:ListAttachedRolePolicies`
- `iam:ListRolePolicies`
- `iam:GetRolePolicy`

---

## 6. ExternalId Purpose

The `ExternalId` parameter is a critical AWS security mechanism designed to solve the **Confused Deputy Problem**:

1. **The Risk**: If NEXUS operates as a multi-tenant platform, malicious Tenant A could configure Tenant B's Role ARN in their settings. If the role trust policy does not enforce a unique external ID, the platform acting on behalf of Tenant A would assume Tenant B's role, granting Tenant A unauthorized access to Tenant B's AWS IAM infrastructure.
2. **The Defense**: NEXUS associates each tenant with a cryptographically secure, unique `ExternalId`. The target account's trust policy requires `sts:ExternalId` matching that tenant. If Tenant A attempts to assume Tenant B's role, the trust policy evaluation fails immediately with `AccessDenied`.

---

## 7. Credential Lifetime & In-Memory Caching Strategy

Calling AWS STS `AssumeRole` on every individual IAM query would introduce severe latency, rate-limiting from AWS STS, and unnecessary network round trips.

To optimize performance while preserving zero-trust guarantees:
1. **Server-Side In-Memory Cache**:
   Temporary credentials (`AccessKeyId`, `SecretAccessKey`, `SessionToken`, `Expiration`) are cached in server memory (`lib/integrations/aws/credentials.ts`).
2. **Proactive 5-Minute Refresh Buffer**:
   Credentials are considered expired if `expiration - Date.now() <= 5 minutes`. This ensures active long-running sync requests never encounter mid-flight token expiration.
3. **Zero Persistence to Disk or Storage**:
   Credentials are stored exclusively in ephemeral Node.js process memory. They are **never** written to the database, logs, filesystem, localStorage, cookies, or HTTP headers.
4. **Cache Key Isolation**:
   Cached sessions are keyed by `${roleArn}::${externalId}`.

---

## 8. Security Guarantees

1. **No Credentials to Client Code**: The temporary credentials returned by STS are consumed exclusively by the server-side `IAMClient`. No credential objects are ever serialized into API responses.
2. **Zero Hardcoded Secrets**: All configuration is derived dynamically from environment variables.
3. **No Credential Logging**: Access keys, secret keys, session tokens, and raw credential payloads are strictly excluded from logging statements.
4. **Controlled Error Sanitization**: STS errors (e.g. `AccessDeniedException`, `MalformedPolicyDocument`) are mapped to clean, sanitized messages without leaking AWS account IDs, internal paths, or stack traces.
5. **Multi-Tenant Protection**: Server-side tenant boundary checks (`requireRole(['admin'])`, `enforceRateLimit()`, and organization ID verification) remain fully enforced.

---

## 9. Development Fallback Behavior

To maintain developer productivity during local development where an AWS IAM role might not yet be provisioned:
- **Mode Detection**:
  - If `AWS_ROLE_ARN` is provided: `federated` mode is active.
  - If `AWS_ROLE_ARN` is empty but `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are provided: `static` fallback mode is active.
  - Otherwise: `unconfigured`.
- **No Silent Downgrades (Critical Zero-Trust Rule)**:
  If `AWS_ROLE_ARN` is configured and STS `AssumeRole` fails, NEXUS **will never** silently downgrade to static credentials. The request aborts immediately with a sanitized error.
- **Production Warning**:
  If the application detects static credentials running when `NODE_ENV === 'production'`, a prominent security warning is emitted to server logs.

---

## 10. Production Deployment Requirements

In production environments (e.g. AWS ECS, EKS, or EC2):
1. **No Static Root Keys**: Do not configure `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in production containers.
2. **Host Identity (Default Credential Chain)**:
   - **AWS ECS**: Assign an ECS Task Role to the NEXUS task definition.
   - **AWS EKS**: Use IAM Roles for Service Accounts (IRSA) or EKS Pod Identity.
   - **AWS EC2**: Attach an IAM Instance Profile to the EC2 instance.
3. **Assume Target Role**:
   The host identity possesses permissions to call `sts:AssumeRole` on the target account's `AWS_ROLE_ARN`. The `STSClient` automatically consumes the host identity credentials via the AWS SDK default credential chain.

---

## 11. Testing Procedure

### Safe In-Memory Testing (Zero Live AWS Access Required)
NEXUS includes an isolated mock hook `_setMockSTSClientForTesting()` in `lib/integrations/aws/credentials.ts`:
- Unit tests verify:
  - Cache hits for valid credentials within expiration window.
  - Automatic cache refresh when remaining lifetime is under the 5-minute buffer.
  - Mode resolution (`federated` vs `static` vs `unconfigured`).
  - Error sanitization upon STS access denial.
  - Prevention of silent downgrades.

### API Integration Verification
1. **Connection Test**:
   `GET /api/integrations/aws/test` (Admin required, rate-limited)
2. **IAM Discovery**:
   `GET /api/integrations/aws/iam` (Admin required, rate-limited)
3. **Identity Sync & Intelligence**:
   `POST /api/integrations/aws/sync` (Admin required, rate-limited)

---

## 12. Remaining Risks & Mitigations

| Risk | Impact | NEXUS Mitigation |
| :--- | :--- | :--- |
| **Cross-Tenant Role Impersonation** | High | Enforce unique `ExternalId` condition on all tenant IAM trust policies. |
| **AWS STS Service Outage** | Medium | In-memory credential caching minimizes STS calls; token validity spans up to 12 hours if configured. |
| **Misconfigured Trust Policy** | Low | Sanitized error handling surfaces diagnostic guidance without leaking stack traces or sensitive account details. |
| **Container Memory Dump** | Low | Credentials are kept ephemeral, short-lived (1 hour), and scoped to read-only IAM permissions. |

# NEXUS AI Agent Instructions

## PROJECT IDENTITY
- **Project Name**: NEXUS
- **Project Purpose**: Non-Human Identity (NHI) & Autonomous AI Security Governance Platform. It is an enterprise security control plane to discover, monitor, assess, govern, and control NHIs and AI agents.
- **Current Development Stage**: FOUNDATION (Documentation phase is complete. Proceeding to base infrastructure).

## ARCHITECTURE PRINCIPLES
- **Modular architecture**: Ensure high cohesion and low coupling.
- **Clear separation**: Maintain distinct boundaries between frontend, backend, and security engines.
- **Secure-by-default design**: Do not rely on users to opt-in to security.
- **Least privilege**: Grant only the minimal permissions necessary for any action or component.
- **Zero Trust principles**: Verify continuously; assume no implicit trust.
- **Auditability**: All actions and decisions must be logged and traceable.
- **Explainability of security decisions**: Any ALLOW/BLOCK/REVIEW decision must have a clear, documented reason.

## TECHNOLOGY DIRECTION
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI
- **Database**: PostgreSQL (Supabase may be used during development)
- **Authentication**: Supabase Auth / secure authentication architecture
- **Caching**: Redis where required
- **ML**: Python, Scikit-learn (Isolation Forest for behavioral anomaly detection as a possible future component)
- **Infrastructure**: Docker, GitHub Actions, AWS, Kubernetes

*IMPORTANT*: Do not introduce new frameworks or major dependencies without first evaluating whether they fit the architecture.

## CODING RULES
- Use TypeScript strict mode.
- Use Python type hints.
- Write clean modular code.
- No unnecessary abstractions.
- No hardcoded secrets.
- No API keys in source code.
- Use environment variables.
- Validate all external input.
- Ensure proper error handling.
- Use structured logging.
- Avoid exposing sensitive information in logs.
- Follow least privilege.
- Never disable security controls simply to make a feature work.

## SECURITY RULES
**NEVER**:
- Commit API keys
- Commit passwords
- Commit tokens
- Commit private credentials
- Expose `.env` files
- Hardcode production secrets
- Bypass authentication
- Disable authorization checks
- Silently ignore security errors

**Always**:
- Update `.env.example` instead of committing secrets
- Validate authorization server-side
- Log security-sensitive decisions
- Preserve auditability
- Use secure defaults

## AI AGENT DEVELOPMENT RULES
AI coding agents must:
1. Read `README.md` first.
2. Read `AGENTS.md` before modifying code.
3. Inspect existing files before creating duplicates.
4. Understand the architecture before making changes.
5. Preserve existing functionality.
6. Avoid unnecessary rewrites.
7. Explain significant architectural changes.
8. Keep security-sensitive code isolated and reviewable.
9. Never invent integrations that do not exist.
10. Clearly distinguish simulated functionality from real integrations.

### Security Decision Flow
When implementing security decisions, always preserve this flow:

`Identity` → `Requested Action` → `Target Resource` → `Context` → `Risk Evaluation` → `Policy Evaluation` → `Decision` → `Audit Event`

### Possible Decisions
- **ALLOW**
- **BLOCK**
- **REVIEW**
- **ALERT**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

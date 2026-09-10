import assert from 'node:assert/strict';
import { NextRequest, NextResponse } from 'next/server';
import {
  handleInvestigationRequest,
  InvestigationApiResponse,
} from '../app/api/security/investigations/route';
import {
  InvestigationProviderRequestError,
  validateInvestigationOutput,
} from '../lib/security/investigation/aiProvider';
import type { ProfileRow } from '../lib/auth/authorization';
import type { User } from '@supabase/supabase-js';
import type {
  InvestigationContextSources,
} from '../lib/security/investigation/contextBuilder';
import type {
  InvestigationContext,
  InvestigationProvider,
  InvestigationProviderRequest,
  InvestigationResult,
} from '../lib/security/investigation/types';
import type {
  OrganizationRiskPosture,
  SecurityFinding,
  SecurityPattern,
} from '../lib/security/intelligence/types';

console.log('--- NEXUS Phase 8D: Investigation API Endpoint Test Suite ---\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  totalTests++;
  try {
    await fn();
    console.log(`PASS ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// TEST FIXTURES & MOCKS
// ---------------------------------------------------------------------------

const AUTH_ORG_ID = 'org-authoritative-1';
const OTHER_ORG_ID = 'org-other-2';

const mockFinding1: SecurityFinding = {
  id: 'finding-1',
  organizationId: AUTH_ORG_ID,
  subjectId: 'identity-1',
  subjectType: 'identity',
  code: 'AWS_ADMINISTRATOR_POLICY',
  category: 'PERMISSION',
  severity: 'CRITICAL',
  title: 'Administrator Access',
  description: 'Identity has full admin privileges attached.',
  recommendation: 'Reduce privileges to least-privilege.',
  riskContribution: 40,
  riskScore: 90,
  evidence: {
    policyCount: 1,
    policyNames: ['AdministratorAccess'],
    isAdministrator: true,
  },
  provider: 'AWS',
  resourceId: 'arn:aws:iam::123456789012:user/admin',
  detectedAt: '2026-09-01T00:00:00.000Z',
  fingerprint: 'fp-finding-1',
};

const mockFindingOtherOrg: SecurityFinding = {
  id: 'finding-other-org',
  organizationId: OTHER_ORG_ID,
  subjectId: 'identity-other',
  subjectType: 'identity',
  code: 'AWS_ACCESS_KEY_OLD_180',
  category: 'CREDENTIAL',
  severity: 'HIGH',
  title: 'Old Access Key',
  description: 'Unrotated key.',
  recommendation: 'Rotate key.',
  riskContribution: 20,
  evidence: {},
  detectedAt: '2026-09-01T00:00:00.000Z',
  fingerprint: 'fp-finding-other',
};

const mockPattern1: SecurityPattern = {
  id: 'pattern-1',
  organizationId: AUTH_ORG_ID,
  patternCode: 'PATTERN_STALE_ADMIN_CREDENTIAL',
  patternType: 'CREDENTIAL_EXPOSURE',
  severity: 'CRITICAL',
  title: 'Stale Admin Credential',
  description: 'Stale credential with admin access.',
  recommendation: 'Rotate credential and reduce access.',
  subjectId: 'identity-1',
  subjectType: 'identity',
  subjectName: 'Admin User',
  correlatedFindingIds: ['finding-1'],
  correlatedFindingCodes: ['AWS_ADMINISTRATOR_POLICY'],
  evidence: {
    activeKeyCount: 1,
  },
  detectedAt: '2026-09-02T00:00:00.000Z',
  fingerprint: 'fp-pattern-1',
};

const mockPosture: OrganizationRiskPosture = {
  overallScore: 75,
  severity: 'HIGH',
  status: 'High Risk',
  assessedAt: '2026-09-03T00:00:00.000Z',
  totalFindings: 1,
  severityCounts: { critical: 1, high: 0, medium: 0, low: 0 },
  categoryBreakdown: {
    CREDENTIAL: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    PERMISSION: { count: 1, riskContribution: 40, criticalCount: 1, highCount: 0 },
    IDENTITY: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    AI_AGENT: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    AWS: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    RESOURCE: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
  },
  subjectBreakdown: {
    identities: { total: 1, atRisk: 1, averageRiskScore: 90, findingsCount: 1 },
    aiAgents: { total: 0, atRisk: 0, averageRiskScore: 0, findingsCount: 0 },
  },
  topRiskContributors: [],
};

function createMockSources(
  findings: SecurityFinding[] = [mockFinding1, mockFindingOtherOrg],
  patterns: SecurityPattern[] = [mockPattern1]
): InvestigationContextSources {
  return {
    getAllFindings: async (orgId) => {
      const scoped = findings.filter((f) => f.organizationId === orgId);
      return {
        data: scoped,
        pagination: { total: scoped.length, page: 1, limit: 100, totalPages: 1 },
      };
    },
    getCorrelatedPatterns: async (orgId) => {
      const scoped = patterns.filter((p) => p.organizationId === orgId);
      return {
        data: scoped,
        summary: {
          totalPatterns: scoped.length,
          criticalPatterns: scoped.filter((p) => p.severity === 'CRITICAL').length,
          highPatterns: 0,
          mediumPatterns: 0,
          affectedSubjects: scoped.length,
        },
        pagination: { total: scoped.length, page: 1, limit: 100, totalPages: 1 },
      };
    },
    getOrganizationRiskPosture: async () => mockPosture,
  };
}

const validProviderOutput: InvestigationResult = {
  summary: 'Investigation confirms active administrator policy bound to identity.',
  verifiedFacts: [
    'Finding finding-1 confirms AWS_ADMINISTRATOR_POLICY attached.',
    'Pattern pattern-1 correlates finding into PATTERN_STALE_ADMIN_CREDENTIAL.',
  ],
  impact: 'Potential full account takeover.',
  priorityRationale: 'CRITICAL severity based on unconstrained permissions.',
  recommendedActions: ['Revoke administrator policy.', 'Enforce least privilege.'],
  evidenceGaps: ['CloudTrail audit logs are not attached.'],
  uncertainty: ['Whether this account is actively used by production services.'],
  sourceFindingIds: ['finding-1'],
  sourcePatternIds: ['pattern-1'],
  model: 'gpt-4o-mini',
  generatedAt: '2026-09-06T12:00:00.000Z',
};

function createMockProvider(
  customImplementation?: (req: InvestigationProviderRequest) => Promise<InvestigationResult>
): InvestigationProvider {
  return {
    name: 'openai',
    generateInvestigation: async (req: InvestigationProviderRequest) => {
      if (customImplementation) {
        return customImplementation(req);
      }
      return validProviderOutput;
    },
  };
}

function createRequest(body?: unknown, rawBodyString?: string): NextRequest {
  const url = 'http://localhost:3000/api/security/investigations';
  const bodyContent =
    rawBodyString !== undefined
      ? rawBodyString
      : body !== undefined
      ? JSON.stringify(body)
      : undefined;

  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: bodyContent,
  });
}

function mockAuth(role = 'analyst', organizationId = AUTH_ORG_ID) {
  return async () => ({
    user: { id: 'usr-1', email: 'analyst@nexus.test' } as unknown as User,
    profile: { id: 'usr-1', role, organization_id: organizationId } as unknown as ProfileRow,
    organizationId,
    role,
  });
}

const mockAllowedRateLimiter = async () => ({
  success: true,
  limit: 10,
  remaining: 9,
  reset: Math.ceil(Date.now() / 1000) + 60,
});

const defaultDeps = {
  authHelper: mockAuth('analyst'),
  rateLimiter: mockAllowedRateLimiter,
  contextSources: createMockSources(),
  providerFactory: () => createMockProvider(),
};

// ---------------------------------------------------------------------------
// TEST RUNNER
// ---------------------------------------------------------------------------

async function runAllTests(): Promise<void> {
  // 1. Unauthenticated request rejected
  await runTest('1. Unauthenticated request rejected (401)', async () => {
    const unauthDeps = {
      ...defaultDeps,
      authHelper: async () => {
        const err = new Error('Unauthorized session.');
        Object.assign(err, { status: 401 });
        throw err;
      },
    };
    const req = createRequest({ targetType: 'finding', findingIds: ['finding-1'] });
    const res = await handleInvestigationRequest(req, unauthDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 401);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'UNAUTHENTICATED');
  });

  // 2. Unauthorized role rejected
  await runTest('2. Unauthorized role rejected (403 for viewer)', async () => {
    const viewerDeps = {
      ...defaultDeps,
      authHelper: async () => {
        const err = new Error("Forbidden: Role 'viewer' cannot perform this action.");
        Object.assign(err, { status: 403 });
        throw err;
      },
    };
    const req = createRequest({ targetType: 'finding', findingIds: ['finding-1'] });
    const res = await handleInvestigationRequest(req, viewerDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 403);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'FORBIDDEN');
  });

  // 3. Rate-limited request rejected
  await runTest('3. Rate-limited request rejected (429 with retry headers)', async () => {
    const rateLimitedDeps = {
      ...defaultDeps,
      rateLimiter: async () => ({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Math.ceil(Date.now() / 1000) + 45,
        response: new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: {
            'Retry-After': '45',
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
          },
        }),
      }),
    };
    const req = createRequest({ targetType: 'finding', findingIds: ['finding-1'] });
    const res = await handleInvestigationRequest(req, rateLimitedDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 429);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(res.headers.get('Retry-After'), '45');
  });

  // 4. Malformed JSON rejected
  await runTest('4. Malformed JSON rejected (400 MALFORMED_JSON)', async () => {
    const req = createRequest(undefined, '{"invalid_json: missing_brace');
    const res = await handleInvestigationRequest(req, defaultDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'MALFORMED_JSON');
  });

  // 5. Invalid target rejected
  await runTest('5. Invalid target rejected (400 INVALID_TARGET)', async () => {
    const req = createRequest({ targetType: 'unsupported_target' });
    const res = await handleInvestigationRequest(req, defaultDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'INVALID_TARGET');
  });

  // 6. organizationId supplied by client is ignored/rejected
  await runTest('6. organizationId supplied by client is rejected (400)', async () => {
    const reqWithOrgId = createRequest({
      targetType: 'finding',
      findingIds: ['finding-1'],
      organizationId: 'malicious-injected-org',
    });
    const res1 = await handleInvestigationRequest(reqWithOrgId, defaultDeps);
    const json1: InvestigationApiResponse = await res1.json();

    assert.equal(res1.status, 400);
    assert.equal(json1.success, false);
    assert.equal(json1.error?.code, 'INVALID_REQUEST');
    assert(json1.error?.message.includes('organizationId'));

    // Also check snake_case organization_id
    const reqWithSnakeOrg = createRequest({
      targetType: 'finding',
      findingIds: ['finding-1'],
      organization_id: 'malicious-injected-org',
    });
    const res2 = await handleInvestigationRequest(reqWithSnakeOrg, defaultDeps);
    const json2: InvestigationApiResponse = await res2.json();

    assert.equal(res2.status, 400);
    assert.equal(json2.success, false);
    assert.equal(json2.error?.code, 'INVALID_REQUEST');
  });

  // 7. Raw findings supplied by client are ignored/rejected
  await runTest('7. Raw findings supplied by client are rejected (400)', async () => {
    const req = createRequest({
      targetType: 'finding',
      findingIds: ['finding-1'],
      findings: [{ id: 'spoofed-finding', severity: 'LOW' }],
    });
    const res = await handleInvestigationRequest(req, defaultDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'INVALID_REQUEST');
    assert(json.error?.message.includes('findings'));
  });

  // 8. Raw evidence supplied by client are ignored/rejected
  await runTest('8. Raw evidence supplied by client are rejected (400)', async () => {
    const req = createRequest({
      targetType: 'finding',
      findingIds: ['finding-1'],
      evidence: { injectedKey: 'spoofed-evidence' },
    });
    const res = await handleInvestigationRequest(req, defaultDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'INVALID_REQUEST');
    assert(json.error?.message.includes('evidence'));
  });

  // 9. Server builds authoritative context
  await runTest('9. Server builds authoritative context from server sources', async () => {
    let capturedContext: InvestigationContext | undefined;
    const trackingDeps = {
      ...defaultDeps,
      providerFactory: () =>
        createMockProvider(async (req) => {
          capturedContext = req.context;
          return validProviderOutput;
        }),
    };

    const req = createRequest({
      targetType: 'finding',
      findingIds: ['finding-1'],
      analystQuestion: 'Is this finding critical?',
    });
    const res = await handleInvestigationRequest(req, trackingDeps);
    assert.equal(res.status, 200);

    assert(capturedContext !== undefined);
    assert.equal(capturedContext.targetType, 'finding');
    assert.equal(capturedContext.analystQuestion, 'Is this finding critical?');
    assert.deepEqual(capturedContext.sourceFindingIds, ['finding-1']);
    // Verified facts must originate exclusively from server-loaded findings
    assert.equal(capturedContext.verifiedFacts.findings[0].code, 'AWS_ADMINISTRATOR_POLICY');
    assert.equal(capturedContext.verifiedFacts.findings[0].id, 'finding-1');
  });

  // 10. Provider abstraction is called
  await runTest('10. Provider abstraction is called with server context and question', async () => {
    let called = false;
    let receivedQuestion: string | undefined;

    const providerTrackingDeps = {
      ...defaultDeps,
      providerFactory: () => ({
        name: 'mock-provider',
        generateInvestigation: async (req: InvestigationProviderRequest) => {
          called = true;
          receivedQuestion = req.analystQuestion;
          return validProviderOutput;
        },
      }),
    };

    const req = createRequest({
      targetType: 'finding',
      findingIds: ['finding-1'],
      analystQuestion: 'Verify administrative privileges.',
    });
    const res = await handleInvestigationRequest(req, providerTrackingDeps);
    assert.equal(res.status, 200);
    assert.equal(called, true);
    assert.equal(receivedQuestion, 'Verify administrative privileges.');
  });

  // 11. Provider failure maps safely to 502
  await runTest('11. Provider failure maps safely to 502 without leaking secrets', async () => {
    const secretKey = 'sk-secret-do-not-leak-12345';
    const failureDeps = {
      ...defaultDeps,
      providerFactory: () => ({
        name: 'mock-provider',
        generateInvestigation: async () => {
          throw new InvestigationProviderRequestError(`OpenAI request failed at api.openai.com key ${secretKey}`);
        },
      }),
    };

    const req = createRequest({ targetType: 'finding', findingIds: ['finding-1'] });
    const res = await handleInvestigationRequest(req, failureDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 502);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'UPSTREAM_PROVIDER_ERROR');
    // Verify no secret or internal stack details leak in client response
    assert(!JSON.stringify(json).includes(secretKey));
    assert(!JSON.stringify(json).includes('api.openai.com'));
  });

  // 12. Successful investigation returns { success: true, data }
  await runTest('12. Successful investigation returns { success: true, data }', async () => {
    const req = createRequest({ targetType: 'finding', findingIds: ['finding-1'] });
    const res = await handleInvestigationRequest(req, defaultDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert(json.data !== undefined);
    assert.equal(json.data.summary, validProviderOutput.summary);
    assert.deepEqual(json.data.verifiedFacts, validProviderOutput.verifiedFacts);
    assert.deepEqual(json.data.sourceFindingIds, ['finding-1']);
    assert.equal(json.data.model, 'gpt-4o-mini');
  });

  // 13. Source IDs remain constrained
  await runTest('13. Source IDs remain constrained to context subsets', async () => {
    // If the provider tries to return an unknown source finding ID not in context,
    // Step 4 output guardrails throw InvestigationProviderValidationError, mapping to 502
    const rogueDeps = {
      ...defaultDeps,
      providerFactory: () => ({
        name: 'mock-provider',
        generateInvestigation: async (req: InvestigationProviderRequest) => {
          // Attempting to inject fabricated source finding ID
          const badOutput = {
            ...validProviderOutput,
            sourceFindingIds: ['finding-fabricated-999'],
          };
          return validateInvestigationOutput(badOutput, req.context, 'gpt-4o-mini');
        },
      }),
    };

    const req = createRequest({ targetType: 'finding', findingIds: ['finding-1'] });
    const res = await handleInvestigationRequest(req, rogueDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 502);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'UPSTREAM_PROVIDER_ERROR');
  });

  // 14. No mutation/persistence occurs
  await runTest('14. No mutation/persistence occurs during investigation', async () => {
    let mutated = false;
    const immutableSources: InvestigationContextSources = {
      getAllFindings: async (orgId) => {
        const scoped = [mockFinding1].filter((f) => f.organizationId === orgId);
        return {
          data: scoped,
          pagination: { total: scoped.length, page: 1, limit: 100, totalPages: 1 },
        };
      },
      getCorrelatedPatterns: async (orgId) => {
        const scoped = [mockPattern1].filter((p) => p.organizationId === orgId);
        return {
          data: scoped,
          summary: {
            totalPatterns: scoped.length,
            criticalPatterns: scoped.filter((p) => p.severity === 'CRITICAL').length,
            highPatterns: 0,
            mediumPatterns: 0,
            affectedSubjects: scoped.length,
          },
          pagination: { total: scoped.length, page: 1, limit: 100, totalPages: 1 },
        };
      },
      getOrganizationRiskPosture: async () => mockPosture,
    };

    // Proxy to detect any attempted property mutations
    const proxySources = new Proxy(immutableSources, {
      set() {
        mutated = true;
        return true;
      },
    });

    const readOnlyDeps = {
      ...defaultDeps,
      contextSources: proxySources,
    };

    const req = createRequest({ targetType: 'finding', findingIds: ['finding-1'] });
    const res = await handleInvestigationRequest(req, readOnlyDeps);

    assert.equal(res.status, 200);
    assert.equal(mutated, false);
  });

  // 15. Cross-organization target cannot be investigated
  await runTest('15. Cross-organization target cannot be investigated (404)', async () => {
    // Attempting to query finding-other-org which belongs to OTHER_ORG_ID,
    // while the authenticated session is strictly AUTH_ORG_ID
    const req = createRequest({
      targetType: 'finding',
      findingIds: ['finding-other-org'],
    });
    const res = await handleInvestigationRequest(req, defaultDeps);
    const json: InvestigationApiResponse = await res.json();

    assert.equal(res.status, 404);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'TARGET_NOT_FOUND');
  });

  // 16. Bounds are enforced
  await runTest('16. Bounds are enforced (>10 findings, >5 patterns, >1000 char question)', async () => {
    // 16a. More than 10 findings
    const tooManyFindingsReq = createRequest({
      targetType: 'finding',
      findingIds: Array.from({ length: 11 }, (_, i) => `finding-${i}`),
    });
    const resA = await handleInvestigationRequest(tooManyFindingsReq, defaultDeps);
    const jsonA: InvestigationApiResponse = await resA.json();
    assert.equal(resA.status, 400);
    assert.equal(jsonA.error?.code, 'BOUNDS_VIOLATION');

    // 16b. More than 5 patterns
    const tooManyPatternsReq = createRequest({
      targetType: 'pattern',
      patternIds: Array.from({ length: 6 }, (_, i) => `pattern-${i}`),
    });
    const resB = await handleInvestigationRequest(tooManyPatternsReq, defaultDeps);
    const jsonB: InvestigationApiResponse = await resB.json();
    assert.equal(resB.status, 400);
    assert.equal(jsonB.error?.code, 'BOUNDS_VIOLATION');

    // 16c. Analyst question > 1000 characters
    const longQuestionReq = createRequest({
      targetType: 'finding',
      findingIds: ['finding-1'],
      analystQuestion: 'a'.repeat(1001),
    });
    const resC = await handleInvestigationRequest(longQuestionReq, defaultDeps);
    const jsonC: InvestigationApiResponse = await resC.json();
    assert.equal(resC.status, 400);
    assert.equal(jsonC.error?.code, 'BOUNDS_VIOLATION');
  });

  console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error('Test run failed with error:', error);
  process.exit(1);
});

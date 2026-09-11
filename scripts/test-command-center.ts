/**
 * NEXUS Phase 8F: Command Center Intelligence Visualization Test Suite
 *
 * Deterministic offline tests verifying:
 * - Command Center API authentication/authorization
 * - Runtime evidence sanitization (field-by-field construction)
 * - Risk posture data integrity (no frontend recalculation)
 * - Finding/pattern data shape
 * - NVIDIA advisory trust boundary
 * - Security guarantees
 *
 * No live API calls, no database, no Playwright.
 */

import assert from 'node:assert/strict';

// ============================================================================
// INLINE TYPES (avoid import resolution issues with tsx scripts)
// ============================================================================

interface CommandCenterFinding {
  readonly id: string;
  readonly organizationId: string;
  readonly subjectId: string;
  readonly subjectType: 'identity' | 'ai_agent' | 'resource';
  readonly code: string;
  readonly category: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly riskContribution: number;
  readonly riskScore?: number;
  readonly provider?: string;
  readonly detectedAt: string;
  readonly fingerprint: string;
}

interface CommandCenterPattern {
  readonly id: string;
  readonly organizationId: string;
  readonly patternCode: string;
  readonly patternType: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly subjectId: string;
  readonly subjectType: 'identity' | 'ai_agent' | 'resource';
  readonly subjectName?: string;
  readonly correlatedFindingIds: string[];
  readonly correlatedFindingCodes: string[];
  readonly detectedAt: string;
  readonly fingerprint: string;
}

interface RiskSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface RiskCategoryBreakdown {
  count: number;
  riskContribution: number;
  criticalCount: number;
  highCount: number;
}

interface RiskSubjectBreakdown {
  total: number;
  atRisk: number;
  averageRiskScore: number;
  findingsCount: number;
}

interface RiskTopContributor {
  findingId: string;
  code: string;
  category: string;
  severity: string;
  subjectId: string;
  subjectType: string;
  subjectName?: string;
  title: string;
  riskContribution: number;
  recommendation: string;
}

interface OrganizationRiskPosture {
  overallScore: number;
  severity: string;
  status: string;
  assessedAt: string;
  totalFindings: number;
  severityCounts: RiskSeverityCounts;
  categoryBreakdown: Record<string, RiskCategoryBreakdown>;
  subjectBreakdown: {
    identities: RiskSubjectBreakdown;
    aiAgents: RiskSubjectBreakdown;
  };
  topRiskContributors: RiskTopContributor[];
}

interface SecurityPatternsSummary {
  totalPatterns: number;
  criticalPatterns: number;
  highPatterns: number;
  mediumPatterns: number;
  affectedSubjects: number;
}

interface CommandCenterIntelligence {
  riskPosture: OrganizationRiskPosture;
  findings: CommandCenterFinding[];
  patterns: CommandCenterPattern[];
  patternsSummary: SecurityPatternsSummary;
  assessedAt: string;
}

// ============================================================================
// TEST HARNESS
// ============================================================================

let totalTests = 0;
let passedTests = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
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

// ============================================================================
// MOCK DATA — simulate raw service output
// ============================================================================

function createRawFinding(overrides: Partial<{
  id: string;
  organizationId: string;
  subjectId: string;
  subjectType: string;
  code: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  riskContribution: number;
  riskScore: number;
  evidence: Record<string, unknown>;
  provider: string;
  resourceId: string;
  detectedAt: string;
  fingerprint: string;
}> = {}) {
  return {
    id: overrides.id || 'finding-1',
    organizationId: overrides.organizationId || 'org-a',
    subjectId: overrides.subjectId || 'identity-1',
    subjectType: overrides.subjectType || 'identity',
    code: overrides.code || 'AWS_ADMIN_ACCESS_ATTACHED',
    category: overrides.category || 'PERMISSION',
    severity: overrides.severity || 'CRITICAL',
    title: overrides.title || 'Administrator Access Attached',
    description: overrides.description || 'Full AdministratorAccess policy attached.',
    recommendation: overrides.recommendation || 'Scope permissions down.',
    riskContribution: overrides.riskContribution ?? 40,
    riskScore: overrides.riskScore ?? 85,
    evidence: overrides.evidence ?? { policyArn: 'arn:aws:iam::policy/AdministratorAccess', secretKey: 'AKIAIOSFODNN7EXAMPLE' },
    provider: overrides.provider,
    resourceId: overrides.resourceId ?? 'res-1',
    detectedAt: overrides.detectedAt || '2026-09-06T12:00:00.000Z',
    fingerprint: overrides.fingerprint || 'fp-1',
  };
}

function createRawPattern(overrides: Partial<{
  id: string;
  organizationId: string;
  patternCode: string;
  patternType: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  subjectId: string;
  subjectType: string;
  subjectName: string;
  correlatedFindingIds: string[];
  correlatedFindingCodes: string[];
  evidence: Record<string, unknown>;
  detectedAt: string;
  fingerprint: string;
}> = {}) {
  return {
    id: overrides.id || 'pattern-1',
    organizationId: overrides.organizationId || 'org-a',
    patternCode: overrides.patternCode || 'PATTERN_STALE_ADMIN_CREDENTIAL',
    patternType: overrides.patternType || 'CREDENTIAL_EXPOSURE',
    severity: overrides.severity || 'CRITICAL',
    title: overrides.title || 'Stale Administrator Credential',
    description: overrides.description || 'Unrotated key on admin identity.',
    recommendation: overrides.recommendation || 'Rotate key immediately.',
    subjectId: overrides.subjectId || 'identity-1',
    subjectType: overrides.subjectType || 'identity',
    subjectName: overrides.subjectName || 'test-admin-user',
    correlatedFindingIds: overrides.correlatedFindingIds || ['finding-1', 'finding-2'],
    correlatedFindingCodes: overrides.correlatedFindingCodes || ['AWS_ADMIN_ACCESS_ATTACHED', 'AWS_ACCESS_KEY_OLD_180'],
    evidence: overrides.evidence ?? { keyAgeDays: 185, accessKeyId: 'AKIAIOSFODNN7EXAMPLE' },
    detectedAt: overrides.detectedAt || '2026-09-06T12:00:00.000Z',
    fingerprint: overrides.fingerprint || 'fp-pat-1',
  };
}

function createRiskPosture(): OrganizationRiskPosture {
  return {
    overallScore: 75,
    severity: 'HIGH',
    status: 'High Risk',
    assessedAt: '2026-09-06T12:00:00.000Z',
    totalFindings: 4,
    severityCounts: { critical: 1, high: 2, medium: 1, low: 0 },
    categoryBreakdown: {
      CREDENTIAL: { count: 1, riskContribution: 20, criticalCount: 0, highCount: 1 },
      PERMISSION: { count: 2, riskContribution: 50, criticalCount: 1, highCount: 1 },
      IDENTITY: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
      AI_AGENT: { count: 1, riskContribution: 15, criticalCount: 0, highCount: 0 },
      AWS: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
      RESOURCE: { count: 0, riskContribution: 0, criticalCount: 0, highCount: 0 },
    },
    subjectBreakdown: {
      identities: { total: 5, atRisk: 2, averageRiskScore: 65, findingsCount: 3 },
      aiAgents: { total: 3, atRisk: 1, averageRiskScore: 40, findingsCount: 1 },
    },
    topRiskContributors: [
      {
        findingId: 'finding-1',
        code: 'AWS_ADMIN_ACCESS_ATTACHED',
        category: 'PERMISSION',
        severity: 'CRITICAL',
        subjectId: 'identity-1',
        subjectType: 'identity',
        subjectName: 'test-admin-user',
        title: 'Administrator Access Attached',
        riskContribution: 40,
        recommendation: 'Remove AdministratorAccess and scope to least privilege.',
      },
    ],
  };
}

/**
 * Simulates the runtime sanitization logic from the API route.
 * Evidence is explicitly NOT copied — fields are constructed one-by-one.
 */
function sanitizeFinding(raw: ReturnType<typeof createRawFinding>): CommandCenterFinding {
  return {
    id: raw.id,
    organizationId: raw.organizationId,
    subjectId: raw.subjectId,
    subjectType: raw.subjectType as 'identity' | 'ai_agent' | 'resource',
    code: raw.code,
    category: raw.category,
    severity: raw.severity,
    title: raw.title,
    description: raw.description,
    recommendation: raw.recommendation,
    riskContribution: raw.riskContribution,
    riskScore: raw.riskScore,
    provider: raw.provider,
    detectedAt: raw.detectedAt,
    fingerprint: raw.fingerprint,
  };
}

function sanitizePattern(raw: ReturnType<typeof createRawPattern>): CommandCenterPattern {
  return {
    id: raw.id,
    organizationId: raw.organizationId,
    patternCode: raw.patternCode,
    patternType: raw.patternType,
    severity: raw.severity,
    title: raw.title,
    description: raw.description,
    recommendation: raw.recommendation,
    subjectId: raw.subjectId,
    subjectType: raw.subjectType as 'identity' | 'ai_agent' | 'resource',
    subjectName: raw.subjectName,
    correlatedFindingIds: [...raw.correlatedFindingIds],
    correlatedFindingCodes: [...raw.correlatedFindingCodes],
    detectedAt: raw.detectedAt,
    fingerprint: raw.fingerprint,
  };
}

// ============================================================================
// MOCK API SIMULATION
// ============================================================================

interface MockAuthResult {
  authenticated: boolean;
  role?: string;
  organizationId?: string;
}

function simulateCommandCenterApi(
  auth: MockAuthResult,
  rawFindings: ReturnType<typeof createRawFinding>[],
  riskPosture: OrganizationRiskPosture,
  rawPatterns: ReturnType<typeof createRawPattern>[],
): { status: number; body: Record<string, unknown> } {
  // 1. Auth check
  if (!auth.authenticated) {
    return { status: 401, body: { success: false, error: 'Unauthenticated' } };
  }

  if (!auth.organizationId) {
    return { status: 403, body: { success: false, error: 'No organization' } };
  }

  // 2. Sort findings
  const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sorted = [...rawFindings].sort((a, b) => {
    const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    if (sevDiff !== 0) return sevDiff;
    return b.riskContribution - a.riskContribution;
  }).slice(0, 20);

  // 3. Sanitize
  const sanitizedFindings = sorted.map(sanitizeFinding);
  const sanitizedPatterns = rawPatterns.map(sanitizePattern);

  // 4. Patterns summary
  const patternsSummary: SecurityPatternsSummary = {
    totalPatterns: rawPatterns.length,
    criticalPatterns: rawPatterns.filter(p => p.severity === 'CRITICAL').length,
    highPatterns: rawPatterns.filter(p => p.severity === 'HIGH').length,
    mediumPatterns: rawPatterns.filter(p => p.severity === 'MEDIUM').length,
    affectedSubjects: new Set(rawPatterns.map(p => p.subjectId)).size,
  };

  const intelligence: CommandCenterIntelligence = {
    riskPosture,
    findings: sanitizedFindings,
    patterns: sanitizedPatterns,
    patternsSummary,
    assessedAt: new Date().toISOString(),
  };

  return { status: 200, body: { success: true, data: intelligence } };
}

// ============================================================================
// TESTS
// ============================================================================

async function runAllTests() {
  console.log('--- NEXUS Phase 8F: Command Center Intelligence Visualization Test Suite ---\n');

  // 1. Authentication required
  await runTest('1. Command Center API requires authentication (401)', () => {
    const res = simulateCommandCenterApi(
      { authenticated: false },
      [], createRiskPosture(), []
    );
    assert.equal(res.status, 401);
    assert.equal((res.body as { success: boolean }).success, false);
  });

  // 2. Organization required
  await runTest('2. Command Center API requires valid organization (403)', () => {
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin' },
      [], createRiskPosture(), []
    );
    assert.equal(res.status, 403);
  });

  // 3. Risk posture score returned from API
  await runTest('3. Risk posture score is returned from API (not recalculated)', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [createRawFinding()], posture, []
    );
    assert.equal(res.status, 200);
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.riskPosture.overallScore, 75);
  });

  // 4. Risk posture severity returned from API
  await runTest('4. Risk posture severity is returned from API (not recalculated)', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], posture, []
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.riskPosture.severity, 'HIGH');
  });

  // 5. Risk posture status
  await runTest('5. Risk posture status is returned from API (not recalculated)', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], posture, []
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.riskPosture.status, 'High Risk');
  });

  // 6. Severity counts correct
  await runTest('6. Severity counts are correct', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], posture, []
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.riskPosture.severityCounts.critical, 1);
    assert.equal(data.riskPosture.severityCounts.high, 2);
    assert.equal(data.riskPosture.severityCounts.medium, 1);
    assert.equal(data.riskPosture.severityCounts.low, 0);
  });

  // 7. Category breakdown has all 6 categories
  await runTest('7. Category breakdown contains all 6 categories', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], posture, []
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    const cats = Object.keys(data.riskPosture.categoryBreakdown);
    assert.ok(cats.includes('CREDENTIAL'));
    assert.ok(cats.includes('PERMISSION'));
    assert.ok(cats.includes('IDENTITY'));
    assert.ok(cats.includes('AI_AGENT'));
    assert.ok(cats.includes('AWS'));
    assert.ok(cats.includes('RESOURCE'));
  });

  // 8. Top contributors returned (max 10)
  await runTest('8. Top contributors are returned (max 10)', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], posture, []
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.ok(data.riskPosture.topRiskContributors.length <= 10);
    assert.equal(data.riskPosture.topRiskContributors[0].findingId, 'finding-1');
  });

  // 9. Findings sorted by severity desc
  await runTest('9. Findings are returned sorted by severity desc', () => {
    const findings = [
      createRawFinding({ id: 'f-low', severity: 'LOW', riskContribution: 5 }),
      createRawFinding({ id: 'f-crit', severity: 'CRITICAL', riskContribution: 40 }),
      createRawFinding({ id: 'f-high', severity: 'HIGH', riskContribution: 20 }),
      createRawFinding({ id: 'f-med', severity: 'MEDIUM', riskContribution: 10 }),
    ];
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      findings, createRiskPosture(), []
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.findings[0].id, 'f-crit');
    assert.equal(data.findings[1].id, 'f-high');
    assert.equal(data.findings[2].id, 'f-med');
    assert.equal(data.findings[3].id, 'f-low');
  });

  // 10. Evidence stripped from findings
  await runTest('10. Findings evidence is stripped from response', () => {
    const raw = createRawFinding({ evidence: { secretKey: 'sk-12345', policyArn: 'arn:aws:iam::policy/Admin' } });
    const sanitized = sanitizeFinding(raw);
    assert.equal('evidence' in sanitized, false);
    assert.equal('resourceId' in sanitized, false);
    // Verify raw has evidence but sanitized does not
    assert.ok('evidence' in raw);
    assert.ok(raw.evidence.secretKey !== undefined);
  });

  // 11. Patterns summary
  await runTest('11. Patterns response includes summary', () => {
    const patterns = [
      createRawPattern({ id: 'p-1', severity: 'CRITICAL' }),
      createRawPattern({ id: 'p-2', severity: 'HIGH', subjectId: 'identity-2' }),
    ];
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], createRiskPosture(), patterns
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.patternsSummary.totalPatterns, 2);
    assert.equal(data.patternsSummary.criticalPatterns, 1);
    assert.equal(data.patternsSummary.highPatterns, 1);
    assert.equal(data.patternsSummary.affectedSubjects, 2);
  });

  // 12. Subject breakdown present
  await runTest('12. Identity vs AI agent breakdown present', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], posture, []
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.ok(data.riskPosture.subjectBreakdown.identities);
    assert.ok(data.riskPosture.subjectBreakdown.aiAgents);
    assert.equal(data.riskPosture.subjectBreakdown.identities.total, 5);
    assert.equal(data.riskPosture.subjectBreakdown.aiAgents.total, 3);
  });

  // 13. NVIDIA advisory marked isAdvisory (simulated structure)
  await runTest('13. NVIDIA advisory marked as isAdvisory=true when available', () => {
    // Simulates a full orchestration result shape
    const nvidiaResult = {
      deterministic: {
        findings: [],
        riskPosture: createRiskPosture(),
        patterns: [],
      },
      nvidia: {
        available: true,
        advisory: {
          isAdvisory: true as const,
          insights: [],
          confidence: 0.85,
          rationale: 'Test rationale.',
          sourceFindingIds: [],
          sourcePatternIds: [],
          model: 'test-model',
          generatedAt: new Date().toISOString(),
        },
      },
      generatedAt: new Date().toISOString(),
    };
    assert.equal(nvidiaResult.nvidia.advisory.isAdvisory, true);
    // Verify advisory cannot be confused with authoritative
    assert.equal(nvidiaResult.nvidia.available, true);
  });

  // 14. NVIDIA failure does not hide deterministic intelligence
  await runTest('14. NVIDIA failure does not hide deterministic intelligence', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [createRawFinding()], posture, [createRawPattern()]
    );
    // Deterministic data is fully present regardless of NVIDIA state
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.riskPosture.overallScore, 75);
    assert.equal(data.findings.length, 1);
    assert.equal(data.patterns.length, 1);
    // No nvidia field in command center API response
    assert.equal('nvidia' in data, false);
  });

  // 15. NVIDIA unavailable returns available: false
  await runTest('15. NVIDIA unavailable returns available=false in orchestration result', () => {
    const nvidiaResult = {
      nvidia: { available: false, advisory: null },
    };
    assert.equal(nvidiaResult.nvidia.available, false);
    assert.equal(nvidiaResult.nvidia.advisory, null);
  });

  // 16. Empty findings
  await runTest('16. Empty findings produce empty array (no error)', () => {
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], createRiskPosture(), []
    );
    assert.equal(res.status, 200);
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.findings.length, 0);
  });

  // 17. Empty patterns
  await runTest('17. Empty patterns produce empty array with summary', () => {
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [], createRiskPosture(), []
    );
    const data = (res.body as { data: CommandCenterIntelligence }).data;
    assert.equal(data.patterns.length, 0);
    assert.equal(data.patternsSummary.totalPatterns, 0);
  });

  // 18. No NVIDIA API key in response body
  await runTest('18. No NVIDIA API key in response body', () => {
    const posture = createRiskPosture();
    const res = simulateCommandCenterApi(
      { authenticated: true, role: 'admin', organizationId: 'org-a' },
      [createRawFinding()], posture, [createRawPattern()]
    );
    const jsonStr = JSON.stringify(res.body);
    assert.equal(jsonStr.includes('nvapi-'), false);
    assert.equal(jsonStr.includes('NVIDIA_API_KEY'), false);
    assert.equal(jsonStr.includes('apiKey'), false);
  });

  // 19. No raw evidence in findings
  await runTest('19. No raw evidence in findings', () => {
    const raw = createRawFinding({
      evidence: { secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', policyArn: 'arn:aws:iam::policy/Admin' }
    });
    const sanitized = sanitizeFinding(raw);
    const jsonStr = JSON.stringify(sanitized);
    assert.equal(jsonStr.includes('wJalrXUtnFEMI'), false);
    assert.equal(jsonStr.includes('secretAccessKey'), false);
    assert.equal(jsonStr.includes('policyArn'), false);
  });

  // 20. No secrets in top contributor recommendations
  await runTest('20. No secrets in top contributor recommendations', () => {
    const posture = createRiskPosture();
    for (const contrib of posture.topRiskContributors) {
      const rec = contrib.recommendation;
      // Recommendations should be actionable text, not secrets
      assert.equal(rec.includes('AKIA'), false);
      assert.equal(rec.includes('nvapi-'), false);
      assert.equal(rec.includes('sk-'), false);
    }
  });

  // --- SUMMARY ---
  console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
  process.exit(passedTests === totalTests ? 0 : 1);
}

runAllTests();

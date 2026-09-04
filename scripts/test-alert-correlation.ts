import assert from 'node:assert/strict';
import {
  detectCorrelatedPatterns,
  calculatePatternsSummary,
  filterAndPaginatePatterns,
} from '@/lib/security/intelligence/correlationService';
import { SecurityFinding } from '@/lib/security/intelligence/types';

console.log('--- NEXUS Phase 8C: Alert Correlation & Attack-Pattern Detection Test Suite ---\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passedTests++;
  } catch (err: unknown) {
    console.error(`✗ [FAIL] ${name}`);
    console.error((err as Error).stack || err);
  }
}

function createMockFinding(
  overrides: Partial<SecurityFinding> & { id: string; code: string; subjectId: string; subjectType: 'identity' | 'ai_agent' | 'resource' }
): SecurityFinding {
  return {
    id: overrides.id,
    organizationId: overrides.organizationId || 'org-test-8c',
    subjectId: overrides.subjectId,
    subjectType: overrides.subjectType,
    code: overrides.code,
    category: overrides.category || 'CREDENTIAL',
    severity: overrides.severity || 'MEDIUM',
    title: overrides.title || overrides.code,
    description: overrides.description || 'Test finding description',
    recommendation: overrides.recommendation || 'Remediate condition',
    riskContribution: overrides.riskContribution ?? 20,
    evidence: overrides.evidence || { safeField: 'safeValue' },
    detectedAt: overrides.detectedAt || '2026-09-04T12:00:00Z',
    fingerprint: overrides.fingerprint || `${overrides.subjectId}:${overrides.code}:${overrides.severity || 'MEDIUM'}`,
  };
}

// --------------------------------------------------------------------------
// TEST 1: Stale credential + Administrator policy produces PATTERN_STALE_ADMIN_CREDENTIAL
// --------------------------------------------------------------------------
runTest('1. Stale credential + Administrator policy produces PATTERN_STALE_ADMIN_CREDENTIAL', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({
      id: 'f-old-key',
      code: 'AWS_ACCESS_KEY_OLD_180',
      subjectId: 'ident-01',
      subjectType: 'identity',
      severity: 'CRITICAL',
      evidence: { maxKeyAgeDays: 195, activeKeyCount: 1 },
    }),
    createMockFinding({
      id: 'f-admin-pol',
      code: 'AWS_ADMINISTRATOR_POLICY',
      subjectId: 'ident-01',
      subjectType: 'identity',
      severity: 'CRITICAL',
      evidence: { isAdministrator: true, policyNames: ['AdministratorAccess'] },
    }),
  ];

  const patterns = detectCorrelatedPatterns(findings);
  assert.equal(patterns.length, 1);
  const p = patterns[0];
  assert.equal(p.patternCode, 'PATTERN_STALE_ADMIN_CREDENTIAL');
  assert.equal(p.severity, 'CRITICAL');
  assert.equal(p.patternType, 'CREDENTIAL_EXPOSURE');
  assert.equal(p.subjectId, 'ident-01');
  assert.equal(p.subjectType, 'identity');
  assert.deepEqual(p.correlatedFindingCodes, ['AWS_ACCESS_KEY_OLD_180', 'AWS_ADMINISTRATOR_POLICY']);
  assert.ok(p.evidence.keyAgeDays === 195);
  assert.ok(p.evidence.isAdministrator === true);
});

// --------------------------------------------------------------------------
// TEST 2: Multiple active keys + Administrator policy produces PATTERN_ADMIN_MULTIPLE_ACTIVE_KEYS
// --------------------------------------------------------------------------
runTest('2. Multiple active keys + Administrator policy produces PATTERN_ADMIN_MULTIPLE_ACTIVE_KEYS', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({
      id: 'f-multi-key',
      code: 'AWS_MULTIPLE_ACTIVE_KEYS',
      subjectId: 'ident-02',
      subjectType: 'identity',
      severity: 'MEDIUM',
      evidence: { activeKeyCount: 2, totalKeyCount: 2 },
    }),
    createMockFinding({
      id: 'f-admin-pol',
      code: 'AWS_ADMINISTRATOR_POLICY',
      subjectId: 'ident-02',
      subjectType: 'identity',
      severity: 'CRITICAL',
      evidence: { isAdministrator: true, policyNames: ['AdministratorAccess'] },
    }),
  ];

  const patterns = detectCorrelatedPatterns(findings);
  assert.equal(patterns.length, 1);
  const p = patterns[0];
  assert.equal(p.patternCode, 'PATTERN_ADMIN_MULTIPLE_ACTIVE_KEYS');
  assert.equal(p.severity, 'CRITICAL');
  assert.equal(p.patternType, 'CREDENTIAL_EXPOSURE');
  assert.equal(p.subjectId, 'ident-02');
  assert.deepEqual(p.correlatedFindingCodes, ['AWS_MULTIPLE_ACTIVE_KEYS', 'AWS_ADMINISTRATOR_POLICY']);
});

// --------------------------------------------------------------------------
// TEST 3: Wildcard action + wildcard resource produces PATTERN_UNRESTRICTED_WILDCARD_PERMISSIONS
// --------------------------------------------------------------------------
runTest('3. Wildcard action + wildcard resource produces PATTERN_UNRESTRICTED_WILDCARD_PERMISSIONS', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({
      id: 'f-wild-act',
      code: 'AWS_WILDCARD_ACTION',
      subjectId: 'ident-03',
      subjectType: 'identity',
      severity: 'HIGH',
      evidence: { wildcardActions: true, policyNames: ['CustomWildcardPolicy'] },
    }),
    createMockFinding({
      id: 'f-wild-res',
      code: 'AWS_WILDCARD_RESOURCE',
      subjectId: 'ident-03',
      subjectType: 'identity',
      severity: 'MEDIUM',
      evidence: { wildcardResources: true, policyNames: ['CustomWildcardPolicy'] },
    }),
  ];

  const patterns = detectCorrelatedPatterns(findings);
  assert.equal(patterns.length, 1);
  const p = patterns[0];
  assert.equal(p.patternCode, 'PATTERN_UNRESTRICTED_WILDCARD_PERMISSIONS');
  assert.equal(p.severity, 'HIGH');
  assert.equal(p.patternType, 'ATTACK_SURFACE');
  assert.equal(p.subjectId, 'ident-03');
  assert.deepEqual(p.correlatedFindingCodes, ['AWS_WILDCARD_ACTION', 'AWS_WILDCARD_RESOURCE']);
  assert.equal(p.evidence.wildcardActions, true);
  assert.equal(p.evidence.wildcardResources, true);
});

// --------------------------------------------------------------------------
// TEST 4: AI admin capability + wildcard resource produces PATTERN_AI_AGENT_UNCONSTRAINED_ADMIN
// --------------------------------------------------------------------------
runTest('4. AI admin capability + wildcard resource produces PATTERN_AI_AGENT_UNCONSTRAINED_ADMIN', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({
      id: 'f-agent-admin',
      code: 'AI_AGENT_HIGH_RISK_TOOL_ACCESS',
      subjectId: 'agent-01',
      subjectType: 'ai_agent',
      severity: 'HIGH',
      evidence: { adminCapabilityCount: 2, highRiskCapabilities: [{ capability: 'IAMAdmin', accessLevel: 'Admin' }] },
    }),
    createMockFinding({
      id: 'f-agent-wildcard',
      code: 'AI_AGENT_UNRESTRICTED_RESOURCE_ACCESS',
      subjectId: 'agent-01',
      subjectType: 'ai_agent',
      severity: 'HIGH',
      evidence: { wildcardCapabilityCount: 1, unrestrictedResources: ['*'] },
    }),
  ];

  const patterns = detectCorrelatedPatterns(findings);
  assert.equal(patterns.length, 1);
  const p = patterns[0];
  assert.equal(p.patternCode, 'PATTERN_AI_AGENT_UNCONSTRAINED_ADMIN');
  assert.equal(p.severity, 'CRITICAL');
  assert.equal(p.patternType, 'UNBOUNDED_EXECUTION');
  assert.equal(p.subjectId, 'agent-01');
  assert.equal(p.subjectType, 'ai_agent');
  assert.deepEqual(p.correlatedFindingCodes, ['AI_AGENT_HIGH_RISK_TOOL_ACCESS', 'AI_AGENT_UNRESTRICTED_RESOURCE_ACCESS']);
});

// --------------------------------------------------------------------------
// TEST 5: AI admin capability + excessive capabilities produces PATTERN_AI_AGENT_OVERPRIVILEGED_MONOLITH
// --------------------------------------------------------------------------
runTest('5. AI admin capability + excessive capabilities produces PATTERN_AI_AGENT_OVERPRIVILEGED_MONOLITH', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({
      id: 'f-agent-admin',
      code: 'AI_AGENT_HIGH_RISK_TOOL_ACCESS',
      subjectId: 'agent-02',
      subjectType: 'ai_agent',
      severity: 'HIGH',
      evidence: { adminCapabilityCount: 1 },
    }),
    createMockFinding({
      id: 'f-agent-excessive',
      code: 'AI_AGENT_EXCESSIVE_CAPABILITIES',
      subjectId: 'agent-02',
      subjectType: 'ai_agent',
      severity: 'MEDIUM',
      evidence: { totalCapabilities: 6, permissionsCount: 12 },
    }),
  ];

  const patterns = detectCorrelatedPatterns(findings);
  assert.equal(patterns.length, 1);
  const p = patterns[0];
  assert.equal(p.patternCode, 'PATTERN_AI_AGENT_OVERPRIVILEGED_MONOLITH');
  assert.equal(p.severity, 'HIGH');
  assert.equal(p.patternType, 'PRIVILEGE_ESCALATION');
  assert.equal(p.subjectId, 'agent-02');
  assert.equal(p.subjectType, 'ai_agent');
  assert.deepEqual(p.correlatedFindingCodes, ['AI_AGENT_HIGH_RISK_TOOL_ACCESS', 'AI_AGENT_EXCESSIVE_CAPABILITIES']);
});

// --------------------------------------------------------------------------
// TEST 6: Findings from different subjects do NOT correlate
// --------------------------------------------------------------------------
runTest('6. Findings from different subjects do NOT correlate (zero cross-entity correlation)', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({
      id: 'f-old-key-A',
      code: 'AWS_ACCESS_KEY_OLD_180',
      subjectId: 'identity-A',
      subjectType: 'identity',
      severity: 'CRITICAL',
    }),
    createMockFinding({
      id: 'f-admin-pol-B',
      code: 'AWS_ADMINISTRATOR_POLICY',
      subjectId: 'identity-B',
      subjectType: 'identity',
      severity: 'CRITICAL',
    }),
  ];

  const patterns = detectCorrelatedPatterns(findings);
  assert.equal(
    patterns.length,
    0,
    'Findings on separate identities (A and B) must NEVER correlate together'
  );
});

// --------------------------------------------------------------------------
// TEST 7: Missing half of a pair produces no pattern
// --------------------------------------------------------------------------
runTest('7. Missing half of a required finding pair produces no pattern (no false positives)', () => {
  // Only AWS_ACCESS_KEY_OLD_180, without AdministratorAccess
  const solitaryFinding = [
    createMockFinding({
      id: 'f-old-key',
      code: 'AWS_ACCESS_KEY_OLD_180',
      subjectId: 'ident-solitary',
      subjectType: 'identity',
      severity: 'CRITICAL',
    }),
  ];

  const patterns = detectCorrelatedPatterns(solitaryFinding);
  assert.equal(patterns.length, 0, 'Solitary finding without matching pair must produce 0 patterns');
});

// --------------------------------------------------------------------------
// TEST 8: Fingerprint is deterministic across repeated executions
// --------------------------------------------------------------------------
runTest('8. Fingerprint and Pattern ID are 100% deterministic across executions', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({
      id: 'f1',
      code: 'AWS_ACCESS_KEY_OLD_180',
      subjectId: 'ident-det-01',
      subjectType: 'identity',
      severity: 'CRITICAL',
      detectedAt: '2026-08-01T10:00:00Z',
    }),
    createMockFinding({
      id: 'f2',
      code: 'AWS_ADMINISTRATOR_POLICY',
      subjectId: 'ident-det-01',
      subjectType: 'identity',
      severity: 'CRITICAL',
      detectedAt: '2026-08-15T15:30:00Z',
    }),
  ];

  const subjectNameMap = new Map<string, string>([
    ['identity:ident-det-01', 'Deterministic Identity Name'],
  ]);

  const firstRun = detectCorrelatedPatterns(findings, subjectNameMap);
  const expectedFingerprint = 'ident-det-01:PATTERN_STALE_ADMIN_CREDENTIAL:CRITICAL';
  const expectedId = `pat_${Buffer.from(expectedFingerprint).toString('base64url')}`;

  assert.equal(firstRun[0].fingerprint, expectedFingerprint);
  assert.equal(firstRun[0].id, expectedId, 'Pattern ID must encode the complete deterministic fingerprint');
  assert.equal(firstRun[0].detectedAt, '2026-08-15T15:30:00Z', 'detectedAt must match the latest finding timestamp');
  assert.equal(firstRun[0].subjectName, 'Deterministic Identity Name', 'subjectName must resolve via identity:<id>');

  for (let i = 0; i < 5; i++) {
    const nextRun = detectCorrelatedPatterns(findings, subjectNameMap);
    assert.equal(nextRun[0].fingerprint, expectedFingerprint);
    assert.equal(nextRun[0].id, firstRun[0].id);
    assert.equal(nextRun[0].detectedAt, '2026-08-15T15:30:00Z');
  }
});

// --------------------------------------------------------------------------
// TEST 9: Pattern evidence contains no secrets or credentials
// --------------------------------------------------------------------------
runTest('9. Pattern evidence contains no secrets, tokens, or credentials', () => {
  const contaminatedFindings: SecurityFinding[] = [
    createMockFinding({
      id: 'f1',
      code: 'AWS_ACCESS_KEY_OLD_180',
      subjectId: 'ident-sec-01',
      subjectType: 'identity',
      evidence: {
        maxKeyAgeDays: 200,
        activeKeyCount: 1,
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        password: 'admin-password-123',
        sessionToken: 'AQoDYXdzEJr1EXAMPLE...',
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    }),
    createMockFinding({
      id: 'f2',
      code: 'AWS_ADMINISTRATOR_POLICY',
      subjectId: 'ident-sec-01',
      subjectType: 'identity',
      evidence: { isAdministrator: true, policyNames: ['AdministratorAccess'] },
    }),
  ];

  const patterns = detectCorrelatedPatterns(contaminatedFindings);
  assert.equal(patterns.length, 1);
  const p = patterns[0];

  assert.equal((p.evidence as Record<string, unknown>).accessKeyId, undefined);
  assert.equal((p.evidence as Record<string, unknown>).secretAccessKey, undefined);
  assert.equal((p.evidence as Record<string, unknown>).password, undefined);
  assert.equal((p.evidence as Record<string, unknown>).sessionToken, undefined);
  assert.equal((p.evidence as Record<string, unknown>).authorization, undefined);
  assert.equal(p.evidence.keyAgeDays, 200);
});

// --------------------------------------------------------------------------
// TEST 10: Summary counts and affectedSubjects are correct
// --------------------------------------------------------------------------
runTest('10. Summary counts and affectedSubjects are correct', () => {
  // Identity 1 triggers 2 patterns (PATTERN_STALE_ADMIN_CREDENTIAL + PATTERN_ADMIN_MULTIPLE_ACTIVE_KEYS)
  // Identity 2 triggers 1 pattern (PATTERN_UNRESTRICTED_WILDCARD_PERMISSIONS)
  // AI Agent 1 triggers 1 pattern (PATTERN_AI_AGENT_UNCONSTRAINED_ADMIN)
  const findings: SecurityFinding[] = [
    // Identity 1
    createMockFinding({ id: 'i1-1', code: 'AWS_ACCESS_KEY_OLD_180', subjectId: 'ident-1', subjectType: 'identity' }),
    createMockFinding({ id: 'i1-2', code: 'AWS_MULTIPLE_ACTIVE_KEYS', subjectId: 'ident-1', subjectType: 'identity' }),
    createMockFinding({ id: 'i1-3', code: 'AWS_ADMINISTRATOR_POLICY', subjectId: 'ident-1', subjectType: 'identity' }),
    // Identity 2
    createMockFinding({ id: 'i2-1', code: 'AWS_WILDCARD_ACTION', subjectId: 'ident-2', subjectType: 'identity' }),
    createMockFinding({ id: 'i2-2', code: 'AWS_WILDCARD_RESOURCE', subjectId: 'ident-2', subjectType: 'identity' }),
    // AI Agent 1
    createMockFinding({ id: 'a1-1', code: 'AI_AGENT_HIGH_RISK_TOOL_ACCESS', subjectId: 'agent-1', subjectType: 'ai_agent' }),
    createMockFinding({ id: 'a1-2', code: 'AI_AGENT_UNRESTRICTED_RESOURCE_ACCESS', subjectId: 'agent-1', subjectType: 'ai_agent' }),
  ];

  const patterns = detectCorrelatedPatterns(findings);
  assert.equal(patterns.length, 4, 'Total 4 patterns should be detected');

  const summary = calculatePatternsSummary(patterns);
  // ident-1: PATTERN_STALE_ADMIN_CREDENTIAL (CRITICAL) + PATTERN_ADMIN_MULTIPLE_ACTIVE_KEYS (CRITICAL) = 2 critical
  // agent-1: PATTERN_AI_AGENT_UNCONSTRAINED_ADMIN (CRITICAL) = 1 critical
  // ident-2: PATTERN_UNRESTRICTED_WILDCARD_PERMISSIONS (HIGH) = 1 high
  assert.equal(summary.totalPatterns, 4);
  assert.equal(summary.criticalPatterns, 3);
  assert.equal(summary.highPatterns, 1);
  assert.equal(summary.mediumPatterns, 0);
  assert.equal(summary.affectedSubjects, 3, 'Affected subjects count must be 3 (ident-1, ident-2, agent-1)');
});

// --------------------------------------------------------------------------
// TEST 11: Sorting, Filtering, and Pagination
// --------------------------------------------------------------------------
runTest('11. Sorting, severity filtering, subjectType filtering, and pagination limits', () => {
  const findings: SecurityFinding[] = [
    // ident-1: PATTERN_STALE_ADMIN_CREDENTIAL (CRITICAL)
    createMockFinding({ id: 'i1-1', code: 'AWS_ACCESS_KEY_OLD_180', subjectId: 'ident-1', subjectType: 'identity' }),
    createMockFinding({ id: 'i1-2', code: 'AWS_ADMINISTRATOR_POLICY', subjectId: 'ident-1', subjectType: 'identity' }),
    // ident-2: PATTERN_UNRESTRICTED_WILDCARD_PERMISSIONS (HIGH)
    createMockFinding({ id: 'i2-1', code: 'AWS_WILDCARD_ACTION', subjectId: 'ident-2', subjectType: 'identity' }),
    createMockFinding({ id: 'i2-2', code: 'AWS_WILDCARD_RESOURCE', subjectId: 'ident-2', subjectType: 'identity' }),
    // agent-1: PATTERN_AI_AGENT_UNCONSTRAINED_ADMIN (CRITICAL)
    createMockFinding({ id: 'a1-1', code: 'AI_AGENT_HIGH_RISK_TOOL_ACCESS', subjectId: 'agent-1', subjectType: 'ai_agent' }),
    createMockFinding({ id: 'a1-2', code: 'AI_AGENT_UNRESTRICTED_RESOURCE_ACCESS', subjectId: 'agent-1', subjectType: 'ai_agent' }),
  ];

  const patterns = detectCorrelatedPatterns(findings);
  assert.equal(patterns.length, 3);

  // Sorting: CRITICAL before HIGH
  const { data: sortedAll } = filterAndPaginatePatterns(patterns);
  assert.equal(sortedAll[0].severity, 'CRITICAL');
  assert.equal(sortedAll[1].severity, 'CRITICAL');
  assert.equal(sortedAll[2].severity, 'HIGH');

  // Filter by severity = HIGH
  const { data: highOnly } = filterAndPaginatePatterns(patterns, { severity: 'HIGH' });
  assert.equal(highOnly.length, 1);
  assert.equal(highOnly[0].patternCode, 'PATTERN_UNRESTRICTED_WILDCARD_PERMISSIONS');

  // Filter by subjectType = ai_agent
  const { data: agentOnly } = filterAndPaginatePatterns(patterns, { subjectType: 'ai_agent' });
  assert.equal(agentOnly.length, 1);
  assert.equal(agentOnly[0].subjectType, 'ai_agent');

  // Pagination with limit = 1
  const page1 = filterAndPaginatePatterns(patterns, { page: 1, limit: 1 });
  assert.equal(page1.data.length, 1);
  assert.equal(page1.pagination.total, 3);
  assert.equal(page1.pagination.totalPages, 3);
  assert.equal(page1.pagination.page, 1);

  // Maximum limit is capped at 100
  const maxLimit = filterAndPaginatePatterns(patterns, { limit: 200 });
  assert.equal(maxLimit.pagination.limit, 100);
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);

if (passedTests !== totalTests) {
  process.exit(1);
}

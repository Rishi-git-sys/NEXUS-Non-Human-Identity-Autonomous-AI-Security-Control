import assert from 'node:assert/strict';
import {
  calculateOverallRiskScore,
  calculateSeverityCounts,
  calculateCategoryBreakdown,
  mapScoreToSeverity,
  mapScoreToStatus,
  extractTopContributors,
  calculateSubjectBreakdown,
  ALL_SECURITY_CATEGORIES,
} from '@/lib/security/intelligence/riskIntelligenceService';
import { SecurityFinding } from '@/lib/security/intelligence/types';

console.log('--- NEXUS Phase 8B: Risk Intelligence API Test Suite ---\n');

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
  overrides: Partial<SecurityFinding> & { id: string; code: string }
): SecurityFinding {
  return {
    id: overrides.id,
    organizationId: overrides.organizationId || 'org-test-8b',
    subjectId: overrides.subjectId || 'subj-001',
    subjectType: overrides.subjectType || 'identity',
    code: overrides.code,
    category: overrides.category || 'CREDENTIAL',
    severity: overrides.severity || 'MEDIUM',
    title: overrides.title || overrides.code,
    description: overrides.description || 'Test finding description',
    recommendation: overrides.recommendation || 'Remediate immediately',
    riskContribution: overrides.riskContribution ?? 20,
    evidence: overrides.evidence || { safeKey: 'safeValue' },
    detectedAt: overrides.detectedAt || new Date().toISOString(),
    fingerprint: overrides.fingerprint || `${overrides.subjectId || 'subj-001'}:${overrides.code}:${overrides.severity || 'MEDIUM'}`,
  };
}

// --------------------------------------------------------------------------
// TEST 1: Empty findings produce overallScore = 0, severity = LOW, status = Healthy
// --------------------------------------------------------------------------
runTest('1. Empty findings produce overallScore = 0, severity = LOW, status = Healthy', () => {
  const emptyScore = calculateOverallRiskScore([]);
  assert.equal(emptyScore, 0, 'Score with 0 findings must be 0');

  const severity = mapScoreToSeverity(emptyScore);
  assert.equal(severity, 'LOW', 'Severity with 0 score must be LOW');

  const status = mapScoreToStatus(emptyScore);
  assert.equal(status, 'Healthy', 'Status with 0 score must be Healthy');
});

// --------------------------------------------------------------------------
// TEST 2: Severity counts are correct
// --------------------------------------------------------------------------
runTest('2. Severity counts are correct across all severity levels', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({ id: 'f-1', code: 'C-1', severity: 'CRITICAL' }),
    createMockFinding({ id: 'f-2', code: 'C-2', severity: 'CRITICAL' }),
    createMockFinding({ id: 'f-3', code: 'H-1', severity: 'HIGH' }),
    createMockFinding({ id: 'f-4', code: 'M-1', severity: 'MEDIUM' }),
    createMockFinding({ id: 'f-5', code: 'M-2', severity: 'MEDIUM' }),
    createMockFinding({ id: 'f-6', code: 'M-3', severity: 'MEDIUM' }),
    createMockFinding({ id: 'f-7', code: 'L-1', severity: 'LOW' }),
  ];

  const counts = calculateSeverityCounts(findings);
  assert.equal(counts.critical, 2);
  assert.equal(counts.high, 1);
  assert.equal(counts.medium, 3);
  assert.equal(counts.low, 1);
});

// --------------------------------------------------------------------------
// TEST 3: Category counts are correct and all categories initialized
// --------------------------------------------------------------------------
runTest('3. Category counts are correct and all 6 categories initialized', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({ id: 'f-1', code: 'KEY_1', category: 'CREDENTIAL' }),
    createMockFinding({ id: 'f-2', code: 'PERM_1', category: 'PERMISSION' }),
    createMockFinding({ id: 'f-3', code: 'PERM_2', category: 'PERMISSION' }),
    createMockFinding({ id: 'f-4', code: 'AGENT_1', category: 'AI_AGENT' }),
  ];

  const breakdown = calculateCategoryBreakdown(findings);

  for (const cat of ALL_SECURITY_CATEGORIES) {
    assert.ok(breakdown[cat], `Category ${cat} must be initialized in breakdown`);
  }

  assert.equal(breakdown.CREDENTIAL.count, 1);
  assert.equal(breakdown.PERMISSION.count, 2);
  assert.equal(breakdown.AI_AGENT.count, 1);
  assert.equal(breakdown.IDENTITY.count, 0);
  assert.equal(breakdown.AWS.count, 0);
  assert.equal(breakdown.RESOURCE.count, 0);
});

// --------------------------------------------------------------------------
// TEST 4: Category risk contributions are summed correctly
// --------------------------------------------------------------------------
runTest('4. Category risk contributions and severity sub-counts are summed correctly', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({ id: 'f-1', code: 'KEY_OLD', category: 'CREDENTIAL', severity: 'CRITICAL', riskContribution: 40 }),
    createMockFinding({ id: 'f-2', code: 'KEY_MULTI', category: 'CREDENTIAL', severity: 'MEDIUM', riskContribution: 15 }),
    createMockFinding({ id: 'f-3', code: 'ADMIN_POL', category: 'PERMISSION', severity: 'CRITICAL', riskContribution: 40 }),
    createMockFinding({ id: 'f-4', code: 'POWER_POL', category: 'PERMISSION', severity: 'HIGH', riskContribution: 30 }),
  ];

  const breakdown = calculateCategoryBreakdown(findings);

  assert.equal(breakdown.CREDENTIAL.riskContribution, 55);
  assert.equal(breakdown.CREDENTIAL.criticalCount, 1);
  assert.equal(breakdown.CREDENTIAL.highCount, 0);

  assert.equal(breakdown.PERMISSION.riskContribution, 70);
  assert.equal(breakdown.PERMISSION.criticalCount, 1);
  assert.equal(breakdown.PERMISSION.highCount, 1);
});

// --------------------------------------------------------------------------
// TEST 5: Severity multipliers affect weighted score correctly
// --------------------------------------------------------------------------
runTest('5. Severity multipliers affect weighted score correctly', () => {
  // 1 finding of 40 points at CRITICAL (mult 1.5 => 60 weighted)
  const critFinding = [createMockFinding({ id: 'c1', code: 'C1', severity: 'CRITICAL', riskContribution: 40 })];
  const critScore = calculateOverallRiskScore(critFinding);
  // 100 * (1 - exp(-60/100)) = 100 * (1 - 0.5488) = 45.12 => 45
  assert.equal(critScore, 45);

  // 1 finding of 40 points at LOW (mult 0.5 => 20 weighted)
  const lowFinding = [createMockFinding({ id: 'l1', code: 'L1', severity: 'LOW', riskContribution: 40 })];
  const lowScore = calculateOverallRiskScore(lowFinding);
  // 100 * (1 - exp(-20/100)) = 100 * (1 - 0.8187) = 18.13 => 18
  assert.equal(lowScore, 18);

  assert.ok(critScore > lowScore, 'CRITICAL finding must yield a strictly higher score than LOW finding with same contribution');
});

// --------------------------------------------------------------------------
// TEST 6: Overall score is always between 0 and 100
// --------------------------------------------------------------------------
runTest('6. Overall score is strictly bounded between 0 and 100 across extreme ranges', () => {
  assert.equal(calculateOverallRiskScore([]), 0);

  // Small finding
  const tinyFinding = [createMockFinding({ id: 't1', code: 'T1', severity: 'LOW', riskContribution: 2 })];
  const tinyScore = calculateOverallRiskScore(tinyFinding);
  assert.ok(tinyScore >= 0 && tinyScore <= 100);

  // Extreme finding set: 50 critical findings with 40 points each
  const extremeFindings: SecurityFinding[] = [];
  for (let i = 0; i < 50; i++) {
    extremeFindings.push(
      createMockFinding({ id: `ext-${i}`, code: `CODE_${i}`, severity: 'CRITICAL', riskContribution: 40 })
    );
  }

  const extremeScore = calculateOverallRiskScore(extremeFindings);
  assert.ok(extremeScore >= 0 && extremeScore <= 100, `Score ${extremeScore} must be <= 100`);
  assert.equal(extremeScore, 100, 'Very large critical finding sets must reach 100 asymptotically');
});

// --------------------------------------------------------------------------
// TEST 7: Score is deterministic for identical findings
// --------------------------------------------------------------------------
runTest('7. Score is deterministic for identical findings across repeated runs', () => {
  const sampleFindings = [
    createMockFinding({ id: 'f-1', code: 'AWS_ACCESS_KEY_OLD_180', severity: 'CRITICAL', riskContribution: 40 }),
    createMockFinding({ id: 'f-2', code: 'AWS_ADMINISTRATOR_POLICY', severity: 'CRITICAL', riskContribution: 40 }),
    createMockFinding({ id: 'f-3', code: 'CREDENTIAL_AGE_OVER_90_DAYS', severity: 'HIGH', riskContribution: 30 }),
    createMockFinding({ id: 'f-4', code: 'AI_AGENT_HIGH_RISK_TOOL_ACCESS', severity: 'HIGH', riskContribution: 30 }),
  ];

  const firstScore = calculateOverallRiskScore(sampleFindings);
  for (let i = 0; i < 10; i++) {
    const nextScore = calculateOverallRiskScore(sampleFindings);
    assert.equal(nextScore, firstScore, 'Score must be 100% deterministic');
  }
});

// --------------------------------------------------------------------------
// TEST 8: Top contributors are limited to 10
// --------------------------------------------------------------------------
runTest('8. Top contributors are limited to at most 10 items', () => {
  const largeFindingSet: SecurityFinding[] = [];
  for (let i = 0; i < 25; i++) {
    largeFindingSet.push(
      createMockFinding({ id: `f-${i}`, code: `CODE_${i}`, severity: 'MEDIUM', riskContribution: 10 + i })
    );
  }

  const top10 = extractTopContributors(largeFindingSet);
  assert.equal(top10.length, 10, 'Top contributors count must be capped at 10');
});

// --------------------------------------------------------------------------
// TEST 9: Top contributors have deterministic ordering
// --------------------------------------------------------------------------
runTest('9. Top contributors have deterministic ordering: severity desc, contribution desc, code asc', () => {
  const findings: SecurityFinding[] = [
    createMockFinding({ id: 'f-low', code: 'LOW_CODE', severity: 'LOW', riskContribution: 10 }),
    createMockFinding({ id: 'f-med', code: 'MED_CODE', severity: 'MEDIUM', riskContribution: 20 }),
    createMockFinding({ id: 'f-crit-2', code: 'B_CRIT_CODE', severity: 'CRITICAL', riskContribution: 40 }),
    createMockFinding({ id: 'f-crit-1', code: 'A_CRIT_CODE', severity: 'CRITICAL', riskContribution: 40 }),
    createMockFinding({ id: 'f-high-small', code: 'HIGH_CODE_1', severity: 'HIGH', riskContribution: 25 }),
    createMockFinding({ id: 'f-high-big', code: 'HIGH_CODE_2', severity: 'HIGH', riskContribution: 30 }),
  ];

  const top = extractTopContributors(findings);

  assert.equal(top[0].code, 'A_CRIT_CODE', 'Highest severity with lower code first');
  assert.equal(top[1].code, 'B_CRIT_CODE', 'Highest severity with second code');
  assert.equal(top[2].code, 'HIGH_CODE_2', 'High severity with higher contribution first');
  assert.equal(top[3].code, 'HIGH_CODE_1', 'High severity with lower contribution');
  assert.equal(top[4].code, 'MED_CODE', 'Medium severity next');
  assert.equal(top[5].code, 'LOW_CODE', 'Low severity last');
});

// --------------------------------------------------------------------------
// TEST 10: Identity and AI-agent subject breakdowns are calculated correctly
// --------------------------------------------------------------------------
runTest('10. Identity and AI-agent subject breakdowns are calculated correctly', () => {
  const mockIdentities = [
    { id: 'i-1', risk_score: 80 }, // atRisk (>= 50)
    { id: 'i-2', risk_score: 60 }, // atRisk (>= 50)
    { id: 'i-3', risk_score: 10 }, // not at risk (< 50)
  ];

  const mockAgents = [
    { id: 'a-1', risk_score: 70 }, // atRisk (>= 50)
    { id: 'a-2', risk_score: 20 }, // not at risk (< 50)
  ];

  const mockFindings = [
    createMockFinding({ id: 'f-1', code: 'C1', subjectType: 'identity' }),
    createMockFinding({ id: 'f-2', code: 'C2', subjectType: 'identity' }),
    createMockFinding({ id: 'f-3', code: 'C3', subjectType: 'ai_agent' }),
  ];

  const breakdown = calculateSubjectBreakdown(mockIdentities, mockAgents, mockFindings);

  assert.equal(breakdown.identities.total, 3);
  assert.equal(breakdown.identities.atRisk, 2);
  // (80 + 60 + 10) / 3 = 150 / 3 = 50
  assert.equal(breakdown.identities.averageRiskScore, 50);
  assert.equal(breakdown.identities.findingsCount, 2);

  assert.equal(breakdown.aiAgents.total, 2);
  assert.equal(breakdown.aiAgents.atRisk, 1);
  // (70 + 20) / 2 = 90 / 2 = 45
  assert.equal(breakdown.aiAgents.averageRiskScore, 45);
  assert.equal(breakdown.aiAgents.findingsCount, 1);
});

// --------------------------------------------------------------------------
// TEST 11: Zero subjects produce averageRiskScore = 0
// --------------------------------------------------------------------------
runTest('11. Zero subjects produce averageRiskScore = 0 without division by zero errors', () => {
  const breakdown = calculateSubjectBreakdown([], [], []);

  assert.equal(breakdown.identities.total, 0);
  assert.equal(breakdown.identities.atRisk, 0);
  assert.equal(breakdown.identities.averageRiskScore, 0);
  assert.equal(breakdown.identities.findingsCount, 0);

  assert.equal(breakdown.aiAgents.total, 0);
  assert.equal(breakdown.aiAgents.atRisk, 0);
  assert.equal(breakdown.aiAgents.averageRiskScore, 0);
  assert.equal(breakdown.aiAgents.findingsCount, 0);
});

// --------------------------------------------------------------------------
// TEST 12: No evidence/secrets are included in topRiskContributors
// --------------------------------------------------------------------------
runTest('12. No evidence/secrets are included in topRiskContributors', () => {
  const sensitiveFinding = createMockFinding({
    id: 'f-sens',
    code: 'AWS_ACCESS_KEY_ACTIVE',
    severity: 'MEDIUM',
    evidence: {
      sensitiveKey: 'secretValue',
      rawAccessKey: 'AKIAEXAMPLE',
    },
  });

  const subjectNameMap = new Map<string, string>([['subj-001', 'Production Deployer User']]);
  const contributors = extractTopContributors([sensitiveFinding], subjectNameMap);

  assert.equal(contributors.length, 1);
  const item = contributors[0];

  assert.equal(item.subjectName, 'Production Deployer User', 'Resolves subjectName from map');
  assert.equal((item as unknown as Record<string, unknown>).evidence, undefined, 'Evidence must be completely omitted');
  assert.equal((item as unknown as Record<string, unknown>).sensitiveKey, undefined, 'No evidence keys present');

  // Verify only allowed properties are present
  const allowedKeys = new Set([
    'findingId',
    'code',
    'category',
    'severity',
    'subjectId',
    'subjectType',
    'subjectName',
    'title',
    'riskContribution',
    'recommendation',
  ]);

  for (const key of Object.keys(item)) {
    assert.ok(allowedKeys.has(key), `Unexpected property ${key} found in RiskTopContributor`);
  }
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);

if (passedTests !== totalTests) {
  process.exit(1);
}

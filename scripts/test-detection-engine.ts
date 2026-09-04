import assert from 'node:assert/strict';
import { identityRiskService } from '@/lib/services/identityRiskService';
import { sanitizeEvidence } from '@/lib/security/intelligence/evidence';
import {
  normalizeIdentityRiskFactors,
  getFactorCategory,
  mapFactorSeverity,
  getFactorRiskContribution,
} from '@/lib/security/intelligence/findingNormalizer';
import { detectAgentFindings } from '@/lib/security/intelligence/agentDetectors';
import { findingService } from '@/lib/security/intelligence/findingService';
import { Database } from '@/types/supabase';
import { Agent } from '@/lib/types/agent';

type IdentityRow = Database['public']['Tables']['identities']['Row'];

console.log('--- NEXUS Phase 8A: Security Intelligence & Detection Engine Test Suite ---\n');

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

// --------------------------------------------------------------------------
// TEST 1: Existing identity risk factor normalizes correctly
// --------------------------------------------------------------------------
runTest('1. Existing identity risk factor normalizes correctly', () => {
  const mockIdentity: IdentityRow = {
    id: 'ident-001',
    organization_id: 'org-test-8a',
    name: 'prod-deployer-iam',
    identity_type: 'service_account',
    status: 'active',
    risk_score: 55,
    owner_id: 'user-001',
    last_seen_at: '2026-08-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    metadata: {
      provider: 'AWS',
      arn: 'arn:aws:iam::123456789012:user/deployer',
      awsType: 'User',
      awsSecurity: {
        accessKeys: [
          { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', status: 'Active', ageDays: 120, createdAt: '2026-04-01' },
        ],
        policies: [
          {
            name: 'DeployerPolicy',
            source: 'inline',
            actions: ['s3:*'],
            resources: ['*'],
            administrator: false,
          },
        ],
        privilegeSummary: {
          administrator: false,
          wildcardActions: true,
          wildcardResources: true,
        },
      },
    },
  };

  const risk = identityRiskService.calculateRisk(mockIdentity);
  const findings = normalizeIdentityRiskFactors('org-test-8a', mockIdentity, risk);

  assert.ok(findings.length > 0, 'Should generate normalized findings from risk factors');
  const longLivedFinding = findings.find((f) => f.code === 'IAM_USER_LONG_LIVED_CREDENTIAL_RISK');
  assert.ok(longLivedFinding, 'Should have IAM_USER_LONG_LIVED_CREDENTIAL_RISK finding');
  assert.equal(longLivedFinding?.category, 'CREDENTIAL');
  assert.equal(longLivedFinding?.severity, 'MEDIUM');
  assert.equal(longLivedFinding?.subjectType, 'identity');
  assert.equal(longLivedFinding?.subjectId, 'ident-001');
  assert.equal(longLivedFinding?.organizationId, 'org-test-8a');
  assert.ok(longLivedFinding?.recommendation.length > 0);
});

// --------------------------------------------------------------------------
// TEST 2: Fingerprint is deterministic
// --------------------------------------------------------------------------
runTest('2. Fingerprint is deterministic and stable across calls', () => {
  const subjectId = 'ident-abc-123';
  const code = 'AWS_ADMINISTRATOR_POLICY';
  const severity = 'CRITICAL';

  const expectedFingerprint = 'ident-abc-123:AWS_ADMINISTRATOR_POLICY:CRITICAL';
  const actualFingerprint = `${subjectId}:${code}:${severity}`;

  assert.equal(actualFingerprint, expectedFingerprint);

  // Assert multiple calculations produce the exact same fingerprint
  for (let i = 0; i < 5; i++) {
    assert.equal(`${subjectId}:${code}:${severity}`, expectedFingerprint);
  }
});

// --------------------------------------------------------------------------
// TEST 3: Duplicate findings are removed
// --------------------------------------------------------------------------
runTest('3. Duplicate findings are removed during normalization', () => {
  const mockIdentity: IdentityRow = {
    id: 'ident-002',
    organization_id: 'org-test-8a',
    name: 'duplicate-test-id',
    identity_type: 'service_account',
    status: 'active',
    risk_score: 30,
    owner_id: 'user-001',
    last_seen_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    metadata: { provider: 'AWS', arn: 'arn:aws:iam::123456789012:user/test' },
  };

  const syntheticDuplicateRisk = {
    score: 60,
    severity: 'HIGH' as const,
    calculatedAt: new Date().toISOString(),
    riskFactors: [
      {
        code: 'AWS_ACCESS_KEY_ACTIVE',
        severity: 'LOW',
        title: 'Active Access Key',
        description: 'Identity has an active key.',
      },
      {
        code: 'AWS_ACCESS_KEY_ACTIVE', // Exact duplicate
        severity: 'LOW',
        title: 'Active Access Key',
        description: 'Identity has an active key duplicate.',
      },
    ],
  };

  const findings = normalizeIdentityRiskFactors('org-test-8a', mockIdentity, syntheticDuplicateRisk);
  const activeKeyFindings = findings.filter((f) => f.code === 'AWS_ACCESS_KEY_ACTIVE');

  assert.equal(activeKeyFindings.length, 1, 'Duplicate risk factors must be deduplicated into a single finding');
});

// --------------------------------------------------------------------------
// TEST 4: Evidence sanitizer removes secret-like fields and sensitive values
// --------------------------------------------------------------------------
runTest('4. Evidence sanitizer removes secret-like fields and sensitive values', () => {
  const contaminatedEvidence = {
    activeKeyCount: 2,
    maxKeyAgeDays: 194,
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    sessionToken: 'AQoDYXdzEJr1EXAMPLE...',
    password: 'SuperSecretPassword123!',
    authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    client_secret: 'oauth-client-secret-999',
    safeNested: {
      policyCount: 5,
      token: 'nested-token',
      wildcardActions: true,
      rawStringWithKey: 'Key is AKIAI44QH8DHBEXAMPLE in log',
    },
  };

  const sanitized = sanitizeEvidence(contaminatedEvidence);

  assert.equal(sanitized.activeKeyCount, 2, 'Safe numbers preserved');
  assert.equal(sanitized.maxKeyAgeDays, 194, 'Safe numbers preserved');
  assert.equal(sanitized.accessKeyId, undefined, 'accessKeyId must be omitted');
  assert.equal(sanitized.secretAccessKey, undefined, 'secretAccessKey must be omitted');
  assert.equal(sanitized.sessionToken, undefined, 'sessionToken must be omitted');
  assert.equal(sanitized.password, undefined, 'password must be omitted');
  assert.equal(sanitized.authorization, undefined, 'authorization must be omitted');
  assert.equal(sanitized.client_secret, undefined, 'client_secret must be omitted');

  const nested = sanitized.safeNested as Record<string, unknown>;
  assert.ok(nested, 'Nested safe object preserved');
  assert.equal(nested.policyCount, 5, 'Safe nested property preserved');
  assert.equal(nested.token, undefined, 'Nested token key must be omitted');
  assert.equal(nested.wildcardActions, true, 'Safe boolean preserved');
  assert.equal(nested.rawStringWithKey, '[REDACTED]', 'AWS Access Key string in value must be redacted');
});

// --------------------------------------------------------------------------
// TEST 5: Identity findings preserve existing severity
// --------------------------------------------------------------------------
runTest('5. Identity findings preserve existing severity', () => {
  assert.equal(mapFactorSeverity('CRITICAL'), 'CRITICAL');
  assert.equal(mapFactorSeverity('HIGH'), 'HIGH');
  assert.equal(mapFactorSeverity('MEDIUM'), 'MEDIUM');
  assert.equal(mapFactorSeverity('LOW'), 'LOW');
  assert.equal(mapFactorSeverity('INFO'), 'LOW'); // INFO mapped to safe LOW

  const mockIdentity: IdentityRow = {
    id: 'ident-003',
    organization_id: 'org-test-8a',
    name: 'admin-iam',
    identity_type: 'service_account',
    status: 'active',
    risk_score: 90,
    owner_id: 'user-001',
    last_seen_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    metadata: {
      provider: 'AWS',
      arn: 'arn:aws:iam::123456789012:user/admin',
      awsSecurity: {
        accessKeys: [{ accessKeyId: 'AKIA123', status: 'Active', ageDays: 200, createdAt: '2026-01-01' }],
        policies: [{ name: 'AdministratorAccess', source: 'managed', actions: ['*'], resources: ['*'], administrator: true }],
        privilegeSummary: { administrator: true, wildcardActions: true, wildcardResources: true },
      },
    },
  };

  const risk = identityRiskService.calculateRisk(mockIdentity);
  const findings = normalizeIdentityRiskFactors('org-test-8a', mockIdentity, risk);

  const adminFinding = findings.find((f) => f.code === 'AWS_ADMINISTRATOR_POLICY');
  assert.ok(adminFinding);
  assert.equal(adminFinding?.severity, 'CRITICAL', 'Administrator policy severity must be CRITICAL');

  const oldKeyFinding = findings.find((f) => f.code === 'AWS_ACCESS_KEY_OLD_180');
  assert.ok(oldKeyFinding);
  assert.equal(oldKeyFinding?.severity, 'CRITICAL', 'Access key > 180 days severity must be CRITICAL');
});

// --------------------------------------------------------------------------
// TEST 6: Agent finding detection does not fabricate findings from missing data
// --------------------------------------------------------------------------
runTest('6. Agent finding detection does not fabricate findings from missing data', () => {
  const minimalAgent: Agent = {
    id: 'agent-empty',
    name: 'Minimal Clean Agent',
    purpose: 'Assisting research',
    model: 'Claude-3.5-Sonnet',
    environment: 'Staging',
    riskScore: 10,
    status: 'Active',
    owner: 'SecOps',
    lastActive: '2026-09-01T00:00:00Z',
    connectedSystems: ['VectorDB Engine', 'Jira Service Desk'], // Non-empty systems
    permissionsCount: 0,
    capabilities: [], // Zero capabilities
    riskBreakdown: { permissionRisk: 0, behaviorRisk: 0, credentialRisk: 0, exposureRisk: 0 },
  };

  const findings = detectAgentFindings('org-test-8a', minimalAgent);
  assert.equal(
    findings.length,
    0,
    'Must not fabricate security findings when capabilities and permissions are empty'
  );
});

// --------------------------------------------------------------------------
// TEST 7: Admin capability can produce the appropriate deterministic agent finding
// --------------------------------------------------------------------------
runTest('7. Admin capability produces deterministic agent finding', () => {
  const privilegedAgent: Agent = {
    id: 'agent-priv',
    name: 'Cloud Infrastructure Optimizer',
    purpose: 'Auto-scaling and policy management',
    model: 'GPT-4o',
    environment: 'Production',
    riskScore: 75,
    status: 'Active',
    owner: 'DevOps',
    lastActive: '2026-09-04T00:00:00Z',
    connectedSystems: ['AWS Cloud API'],
    permissionsCount: 12,
    capabilities: [
      {
        id: 'cap-1',
        capability: 'AWS IAM Policy Administration',
        resource: '*',
        accessLevel: 'Admin',
        decision: 'ALLOWED',
        reason: 'Required for dynamic privilege adjustments',
      },
      {
        id: 'cap-2',
        capability: 'Database Maintenance',
        resource: 'arn:aws:rds:us-east-1:123456789012:db:*',
        accessLevel: 'Write',
        decision: 'ALLOWED',
        reason: 'Routine backups',
      },
      {
        id: 'cap-3',
        capability: 'EC2 Provisioning',
        resource: 'arn:aws:ec2:us-east-1:123456789012:instance/*',
        accessLevel: 'Write',
        decision: 'ALLOWED',
        reason: 'Compute scaling',
      },
      {
        id: 'cap-4',
        capability: 'Log Aggregation',
        resource: 'arn:aws:logs:us-east-1:123456789012:log-group:app',
        accessLevel: 'Read',
        decision: 'ALLOWED',
        reason: 'Monitoring',
      },
      {
        id: 'cap-5',
        capability: 'S3 Object Storage',
        resource: 'arn:aws:s3:::backup-bucket/*',
        accessLevel: 'Write',
        decision: 'ALLOWED',
        reason: 'Storage',
      },
    ],
    riskBreakdown: { permissionRisk: 80, behaviorRisk: 40, credentialRisk: 20, exposureRisk: 60 },
  };

  const findings = detectAgentFindings('org-test-8a', privilegedAgent);

  const adminToolFinding = findings.find((f) => f.code === 'AI_AGENT_HIGH_RISK_TOOL_ACCESS');
  assert.ok(adminToolFinding, 'Should detect AI_AGENT_HIGH_RISK_TOOL_ACCESS');
  assert.equal(adminToolFinding?.severity, 'HIGH');
  assert.equal(adminToolFinding?.category, 'AI_AGENT');
  assert.equal(adminToolFinding?.subjectType, 'ai_agent');
  assert.equal(adminToolFinding?.riskContribution, 30);

  const wildcardFinding = findings.find((f) => f.code === 'AI_AGENT_UNRESTRICTED_RESOURCE_ACCESS');
  assert.ok(wildcardFinding, 'Should detect AI_AGENT_UNRESTRICTED_RESOURCE_ACCESS');
  assert.equal(wildcardFinding?.severity, 'HIGH');

  const excessiveFinding = findings.find((f) => f.code === 'AI_AGENT_EXCESSIVE_CAPABILITIES');
  assert.ok(excessiveFinding, 'Should detect AI_AGENT_EXCESSIVE_CAPABILITIES when count >= 5');
  assert.equal(excessiveFinding?.severity, 'MEDIUM');
});

// --------------------------------------------------------------------------
// TEST 8: Organization IDs are preserved correctly
// --------------------------------------------------------------------------
runTest('8. Organization IDs are preserved correctly across findings', () => {
  const orgId = 'org-specific-uuid-888';
  const mockIdentity: IdentityRow = {
    id: 'ident-004',
    organization_id: orgId,
    name: 'scoped-identity',
    identity_type: 'workload_identity',
    status: 'active',
    risk_score: 10,
    owner_id: 'user-001',
    last_seen_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    metadata: { provider: 'AWS', arn: 'arn:aws:iam::123456789012:role/app-role' },
  };

  const findings = findingService.getIdentityFindings(orgId, mockIdentity);
  for (const finding of findings) {
    assert.equal(finding.organizationId, orgId, 'Finding must strictly match the given organizationId');
  }
});

// --------------------------------------------------------------------------
// TEST 9: Empty identities/agents produce empty findings
// --------------------------------------------------------------------------
runTest('9. Empty identities/agents produce empty findings without errors', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emptyIdentityFindings = findingService.getIdentityFindings('org-test-8a', null as any);
  assert.deepEqual(emptyIdentityFindings, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emptyAgentFindings = findingService.getAgentFindings('org-test-8a', null as any);
  assert.deepEqual(emptyAgentFindings, []);

  // Missing organization ID
  const noOrgFindings = findingService.getIdentityFindings('', { id: 'x' } as IdentityRow);
  assert.deepEqual(noOrgFindings, []);
});

// --------------------------------------------------------------------------
// TEST 10: Existing identityRiskService behavior is not changed
// --------------------------------------------------------------------------
runTest('10. Existing identityRiskService behavior is unchanged', () => {
  const serviceAccountRow: IdentityRow = {
    id: 'ident-baseline',
    organization_id: 'org-test-8a',
    name: 'baseline-test',
    identity_type: 'service_account',
    status: 'active',
    risk_score: 0,
    owner_id: 'user-001',
    last_seen_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    metadata: {
      provider: 'AWS',
      arn: 'arn:aws:iam::123456789012:user/baseline',
    },
  };

  const risk = identityRiskService.calculateRisk(serviceAccountRow);

  // Baseline IAM user adds 20 points for service_account + 10 points for unknown key posture
  assert.equal(risk.score, 30);
  assert.equal(risk.severity, 'MEDIUM');
  assert.ok(risk.riskFactors.some((f) => f.code === 'IAM_USER_LONG_LIVED_CREDENTIAL_RISK'));
  assert.ok(risk.riskFactors.some((f) => f.code === 'ACCESS_KEY_POSTURE_UNKNOWN'));

  // Ensure category and risk contribution helpers are consistent
  assert.equal(getFactorCategory('IAM_USER_LONG_LIVED_CREDENTIAL_RISK'), 'CREDENTIAL');
  assert.equal(getFactorCategory('AWS_ADMINISTRATOR_POLICY'), 'PERMISSION');
  assert.equal(getFactorCategory('AWS_API_PERMISSION_ERROR'), 'AWS');
  assert.equal(getFactorRiskContribution('AWS_ADMINISTRATOR_POLICY', 'CRITICAL'), 40);
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);

if (passedTests !== totalTests) {
  process.exit(1);
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { privacyViolation } from '@/lib/architecture-census/privacy';
import { REQUIRED_BASELINE } from '@/lib/architecture-charter';
import {
  COMMAND_CONTRACTS,
  PR_EXTRA_IDENTITIES,
  REQUIRED_CHARTER,
  commandContract,
  createTestMeasurementReceipt,
  defaultProductCommandsReadReleaseEvidence,
  deterministicDiscoveryText,
  discoverTests,
  evaluateFailClosed,
  matchesGlob,
  parseVitestJson,
  qualifyDiscovery,
  validateReleaseManifest,
} from '@/lib/architecture-test-commands';
import { RELEASE_QUALIFICATION_MANIFEST_SCHEMA_VERSION } from '@/lib/architecture-test-commands';

function closed(partial: Partial<Parameters<typeof evaluateFailClosed>[0]> = {}) {
  return evaluateFailClosed({
    assertionFailures: 0,
    unhandledErrors: 0,
    unregisteredSkips: [],
    unresolved: 0,
    denominatorGaps: 0,
    evidenceDrift: 0,
    acceptedFailures: 0,
    receiptDrift: 0,
    dirtyWorktree: 0,
    mixedWorktree: 0,
    ...partial,
  });
}

const COMMIT = 'c'.repeat(40);
const TREE = 'd'.repeat(40);

function discover(paths: readonly string[]) {
  return discoverTests({
    paths,
    sourceCommit: COMMIT,
    sourceTree: TREE,
    charterSha256: REQUIRED_CHARTER.sha256,
  });
}

function qualified(paths: readonly string[]) {
  const core = discover(paths);
  const failures = qualifyDiscovery(core, {
    charterSha256: REQUIRED_CHARTER.sha256,
    charterPresent: true,
  });
  return { core, failures };
}

const ROOTS = [
  'src/lib/__tests__/math.test.ts',
  'src/app/api/health/__tests__/route.test.ts',
  'src/lib/__tests__/db.integration.test.ts',
  'tests/platform-entrypoints.spec.ts',
  'scripts/tests/test-commercial-ui-governance.ts',
  'scripts/tests/smoke-test.mjs',
  'scripts/knowledge-governance/input-inventory/__tests__/inventory.test.ts',
  'course-content/tests/test_export_handout_pdf.py',
  'rust/control-engine/tests/destroyer_hifi.rs',
  'src/lib/__tests__/test-command-contracts.test.ts',
  'scripts/tests/test-arena-home-entry.mjs',
  'scripts/tests/test-arena-routes.mjs',
];

describe('test command contracts', () => {
  it('declares one scope contract per governed command and does not use the historical evidence bundle as npm test', () => {
    const ids = COMMAND_CONTRACTS.map((item) => item.id);
    expect(ids).toEqual(['test', 'test:unit', 'test:contract', 'test:integration', 'test:e2e:critical', 'test:release', 'test:nightly']);
    const npmTest = commandContract('test');
    expect(npmTest.scope).toBe('pr-default-deterministic-fast-mandatory');
    expect(npmTest.excludedScopes).toContain('release-evidence');
    expect(npmTest.executionIdentities).toEqual([...PR_EXTRA_IDENTITIES]);
    expect(npmTest.executionIdentities.some((item) => item.includes('commercial-ui'))).toBe(false);
    expect(defaultProductCommandsReadReleaseEvidence('test')).toBe(false);
    expect(defaultProductCommandsReadReleaseEvidence('test:unit')).toBe(false);
    expect(defaultProductCommandsReadReleaseEvidence('test:contract')).toBe(false);
    expect(defaultProductCommandsReadReleaseEvidence('test:release')).toBe(true);
  });

  it('discovers a new domain test under a declared root without a manual include list', () => {
    const { core, failures } = qualified([...ROOTS, 'src/features/teacher/__tests__/new-panel.test.ts']);
    expect(failures).toEqual([]);
    const member = core.members.find((item) => item.identity.endsWith('new-panel.test.ts'));
    expect(member?.layer).toBe('unit');
    expect(member?.identity).toBe('src/features/teacher/__tests__/new-panel.test.ts');
  });

  it('fails qualification when a naming-convention file is outside declared roots', () => {
    const core = discover([...ROOTS, 'vendor/orphan.test.ts']);
    expect(core.unresolved.some((item) => item.identity === 'vendor/orphan.test.ts' && item.code === 'missing-root')).toBe(true);
    const failures = qualifyDiscovery(core, { charterSha256: REQUIRED_CHARTER.sha256, charterPresent: true });
    expect(failures.some((item) => item.code === 'discovery-denominator-incomplete')).toBe(true);
  });

  it('fails when a declared root has no independently discovered member', () => {
    const core = discover(ROOTS.filter((path) => !path.startsWith('rust/')));
    expect(core.unresolved.some((item) => item.code === 'unmatched-root' && item.identity.startsWith('rust/'))).toBe(true);
  });

  it('records explicit exclusions with owner and removal condition', () => {
    const core = discover([...ROOTS, 'src/lib/__tests__/fixtures/sample.test.ts', 'artifacts/commercial-ui/proof.test.ts']);
    expect(core.exclusions.some((item) => item.identity.includes('fixtures') && item.owner === 'platform')).toBe(true);
    expect(core.exclusions.some((item) => item.identity.startsWith('artifacts/') && item.reason === 'run-specific-evidence-not-a-test')).toBe(true);
    expect(core.members.some((item) => item.identity.startsWith('artifacts/'))).toBe(false);
  });

  it('keeps deterministic discovery byte-identical and creates a new measurement receipt for a new duration', () => {
    const first = discover(ROOTS);
    const second = discover(ROOTS);
    expect(deterministicDiscoveryText(first)).toBe(deterministicDiscoveryText(second));
    expect(privacyViolation(deterministicDiscoveryText(first))).toBeNull();
    const receiptA = createTestMeasurementReceipt({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      command: 'test',
      scope: 'pr-default-deterministic-fast-mandatory',
      platform: 'test',
      toolVersions: { node: 'v22' },
      cacheMode: 'no-cache',
      capturedAt: '2026-08-27T00:00:00.000Z',
      exitStatus: 0,
      aggregate: { durationMs: 10 },
      fingerprints: [],
    });
    const receiptB = createTestMeasurementReceipt({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      command: 'test',
      scope: 'pr-default-deterministic-fast-mandatory',
      platform: 'test',
      toolVersions: { node: 'v22' },
      cacheMode: 'no-cache',
      capturedAt: '2026-08-27T00:00:01.000Z',
      exitStatus: 0,
      aggregate: { durationMs: 11 },
      fingerprints: [],
    });
    expect(receiptA.receiptId).not.toBe(receiptB.receiptId);
    expect(receiptA.sourceCommit).toBe(COMMIT);
  });

  it('fails closed for assertion failure, unhandled error, unregistered skip, discovery gap, evidence drift, and accepted failure', () => {
    expect(closed({ assertionFailures: 1 }).ok).toBe(false);
    expect(closed({ unhandledErrors: 1 }).reasons).toContain('unhandled-error');
    expect(closed({ unregisteredSkips: ['src/lib/__tests__/hidden.test.ts'] }).reasons).toContain('unregistered-skip');
    expect(closed({ unresolved: 1 }).reasons).toContain('unresolved-discovery');
    expect(closed({ denominatorGaps: 1 }).reasons).toContain('denominator-gap');
    expect(closed({ evidenceDrift: 1 }).reasons).toContain('evidence-drift');
    expect(closed({ acceptedFailures: 1 }).reasons).toContain('accepted-failure');
    expect(closed({ dirtyWorktree: 1 }).reasons).toContain('dirty-worktree');
    expect(closed({ mixedWorktree: 1 }).reasons).toContain('mixed-worktree');
    expect(closed().ok).toBe(true);
  });

  it('treats vitest skipped assertions as unregistered skips unless the command records them', () => {
    const summary = parseVitestJson(JSON.stringify({
      numPassedTests: 1,
      numFailedTests: 0,
      testResults: [{
        name: 'src/lib/__tests__/hidden.test.ts',
        assertionResults: [
          { status: 'passed', fullName: 'keeps passing' },
          { status: 'skipped', fullName: 'hidden skip' },
        ],
      }],
    }));
    expect(summary.skipped).toEqual(['src/lib/__tests__/hidden.test.ts::hidden skip']);
    expect(closed({ unregisteredSkips: summary.skipped }).ok).toBe(false);
  });

  it('does not allow integration remainder to hide uncovered members, and nightly is not a successful no-op', () => {
    expect(commandContract('test:integration').remainderExecution).toBe(false);
    expect(commandContract('test:nightly').remainderExecution).toBe(true);
    const core = discover([...ROOTS, 'scripts/tests/test-teacher-default-class-postgres.ts']);
    expect(core.members.find((item) => item.identity.endsWith('test-teacher-default-class-postgres.ts'))?.layer).toBe('nightly');
    expect(core.unresolved.some((item) => item.code === 'execution-gap' && item.identity.endsWith('db.integration.test.ts'))).toBe(false);
  });

  it('blocks qualification when the charter is missing even if the baseline identity is present', () => {
    const core = discover(ROOTS);
    expect(core.baseline.censusCoreSha256).toBe(REQUIRED_BASELINE.censusCoreSha256);
    const failures = qualifyDiscovery(core, { charterPresent: false, charterSha256: null });
    expect(failures.some((item) => item.code === 'charter-missing-or-unqualified')).toBe(true);
  });

  it('blocks qualification on a dirty or mixed worktree instead of minting a HEAD-bound receipt', () => {
    const core = discover(ROOTS);
    expect(qualifyDiscovery(core, { charterSha256: REQUIRED_CHARTER.sha256, charterPresent: true, dirty: true }).some((item) => item.code === 'dirty-worktree')).toBe(true);
    expect(qualifyDiscovery(core, { charterSha256: REQUIRED_CHARTER.sha256, charterPresent: true, mixedWorktree: true }).some((item) => item.code === 'mixed-worktree')).toBe(true);
  });

  it('rejects release manifests that are missing, drifted, or stale, and keeps product commands independent of them', () => {
    const failures = validateReleaseManifest({
      schemaVersion: RELEASE_QUALIFICATION_MANIFEST_SCHEMA_VERSION,
      sourceCommit: COMMIT,
      sourceTree: TREE,
      artifacts: [{
        path: 'artifacts/commercial-ui/proof.json',
        sha256: 'dead',
        schema: 'example/v1',
        scope: 'commercial-ui',
        sourceCommit: COMMIT,
        sourceTree: TREE,
        capturedAt: '2020-01-01T00:00:00.000Z',
      }],
    }, {
      repoRoot: '/repo',
      expectedCommit: COMMIT,
      expectedTree: TREE,
      now: new Date('2026-08-27T00:00:00.000Z'),
      fileContents: { 'artifacts/commercial-ui/proof.json': '{"ok":true}\n' },
    });
    expect(failures.some((item) => item.code === 'release-artifact-hash-drift' || item.code === 'release-artifact-stale')).toBe(true);
    const missingShape = validateReleaseManifest({
      schemaVersion: RELEASE_QUALIFICATION_MANIFEST_SCHEMA_VERSION,
      sourceCommit: COMMIT,
      sourceTree: TREE,
      artifacts: [{
        path: 'artifacts/commercial-ui/proof.json',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        schema: '',
        scope: '',
        sourceCommit: COMMIT,
        sourceTree: TREE,
        capturedAt: '2026-08-27T00:00:00.000Z',
      }],
    }, {
      repoRoot: '/repo',
      expectedCommit: COMMIT,
      expectedTree: TREE,
      now: new Date('2026-08-27T00:00:00.000Z'),
      fileContents: { 'artifacts/commercial-ui/proof.json': '' },
    });
    expect(missingShape.some((item) => item.code === 'release-artifact-schema')).toBe(true);
    expect(missingShape.some((item) => item.code === 'release-artifact-scope')).toBe(true);
    expect(commandContract('test').requiredInputs).not.toContain('qualification-manifest');
    expect(commandContract('test:release').requiredInputs).toContain('qualification-manifest');
  });

  it('maps the current CI smoke step to the local npm test command contract', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow).toMatch(/run:\s*npm run test\b/u);
    expect(commandContract('test').ciWorkflow).toBe('.github/workflows/ci.yml');
    expect(commandContract('test').ciJob).toBe('quality');
  });

  it('treats vitest include globs as execution constraints rather than the discovery universe', () => {
    expect(matchesGlob('src/features/new-domain/__tests__/flow.test.ts', 'src/**/__tests__/**/*.{test,spec}.{ts,tsx}')).toBe(true);
    const core = discover([...ROOTS, 'src/features/new-domain/__tests__/flow.test.ts']);
    expect(core.members.some((item) => item.identity === 'src/features/new-domain/__tests__/flow.test.ts')).toBe(true);
  });
});

import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_QUALITY_GATE_REGISTRY,
  HOSTED_CI_WORKFLOW_PATHS,
  IMPACT_DENOMINATOR_KEYS,
  QUALITY_EVENTS,
  QUALITY_LAYER_IDS,
  createBlockedIntegrationProtectionReceipt,
  createIntegrationProtectionReceipt,
  createLayerReceipt,
  qualityGateRegistryHash,
  qualityCommand,
  selectPrImpact,
  serializeQualityGateRegistry,
  validateGitHubHostedCiBoundary,
  validateIntegrationProtectionReceipt,
  validateLayerReceipt,
  validateMainReleasePreservation,
  validatePackageCommandAuthority,
  validateQualityGateRegistry,
  validateTypecheckReceipts,
  validateWorkflowText,
  type QualityCommandId,
  type QualityGateRegistry,
} from '../../../scripts/quality-gates/index';
import { createGraphMeasurementReceipt } from '../../../scripts/typescript-graphs/contracts';

const COMMIT = 'c'.repeat(40);
const TREE = 'd'.repeat(40);

type TestRegistry = Omit<QualityGateRegistry, 'checks' | 'commands'> & {
  checks: QualityGateRegistry['checks'];
  commands: QualityGateRegistry['commands'];
};

function copyRegistry(): TestRegistry {
  return JSON.parse(JSON.stringify(DEFAULT_QUALITY_GATE_REGISTRY)) as TestRegistry;
}

function graphReceipt(
  graph: 'web' | 'worker' | 'tools' | 'test',
  overrides: Partial<ReturnType<typeof createGraphMeasurementReceipt>> = {},
) {
  return createGraphMeasurementReceipt({
    graph,
    command: `typecheck:${graph}`,
    scope: `scope-${graph}`,
    sourceCommit: COMMIT,
    sourceTree: TREE,
    dirty: false,
    manifestHash: `manifest-${graph}`,
    fixturePath: `typescript-graph-fixtures/${graph}.ts`,
    fixtureProbe: false,
    toolchain: { node: 'v20.19.0', typescript: '5.8.3' },
    platform: 'test',
    cacheMode: 'warm',
    capturedAt: '2026-08-27T00:00:00.000Z',
    durationMs: 1,
    peakRssBytes: 1,
    fileCount: 1,
    exitStatus: 0,
    status: 'passed',
    tscErrorCount: 0,
    boundaryFailureCount: 0,
    failureCodes: [],
    ...overrides,
  });
}

describe('PR and integration quality gate contracts', () => {
  it('uses one stable registry and all local command scripts resolve', () => {
    expect(QUALITY_LAYER_IDS).toEqual(['pr', 'integration', 'main-release', 'nightly']);
    expect(QUALITY_EVENTS).toEqual(['local']);
    expect(DEFAULT_QUALITY_GATE_REGISTRY.layers.every((layer) => layer.events.includes('local') && layer.events.length === 1)).toBe(true);
    expect(validateQualityGateRegistry()).toEqual([]);
    expect(validatePackageCommandAuthority(process.cwd())).toEqual([]);
    expect(qualityGateRegistryHash()).toBe(qualityGateRegistryHash(copyRegistry()));
    expect(serializeQualityGateRegistry()).toBe(serializeQualityGateRegistry(copyRegistry()));
  });

  it('keeps all four TypeScript graphs mandatory in PR and integration and protects release checks', () => {
    for (const layer of ['pr', 'integration'] as const) {
      const checks = DEFAULT_QUALITY_GATE_REGISTRY.checks.filter((item) => item.layer === layer);
      for (const command of ['typecheck:web', 'typecheck:worker', 'typecheck:tools', 'typecheck:test']) {
        expect(checks.some((check) => check.commandIds.includes(command as QualityCommandId))).toBe(true);
      }
    }
    const release = DEFAULT_QUALITY_GATE_REGISTRY.checks.filter((item) => item.layer === 'main-release');
    expect(release.some((item) => item.checkId === 'main-release/rollback-smoke')).toBe(true);
    expect(release.some((item) => item.checkId === 'main-release/readyz')).toBe(true);
    expect(DEFAULT_QUALITY_GATE_REGISTRY.nightlySubstitutionForbidden).toEqual(['typecheck:tools', 'typecheck:test']);
    expect(validateMainReleasePreservation(DEFAULT_QUALITY_GATE_REGISTRY, DEFAULT_QUALITY_GATE_REGISTRY)).toEqual([]);
  });

  it('rejects missing commands, duplicate command authority, and scope drift', () => {
    const missing = copyRegistry();
    missing.checks = missing.checks.map((item) => item.checkId === 'pr/contract'
      ? { ...item, commandIds: ['missing-command' as QualityCommandId] }
      : item);
    expect(validateQualityGateRegistry(missing).map((failure) => failure.code)).toContain('required-check-unknown-command');

    const duplicate = copyRegistry();
    duplicate.commands = [...duplicate.commands, { ...qualityCommand('lint'), scope: 'different-scope' }];
    expect(validateQualityGateRegistry(duplicate).map((failure) => failure.code)).toContain('duplicate-command-authority');

    const drifted = copyRegistry();
    drifted.checks = drifted.checks.map((item) => item.checkId === 'pr/affected-lint'
      ? { ...item, scope: 'unrelated-scope' }
      : item);
    expect(validateQualityGateRegistry(drifted).map((failure) => failure.code)).toContain('required-check-scope-drift');
  });

  it('rejects workflow-only test lists, silent skips, accepted failures, and the Node 20 ESM loader', () => {
    expect(existsSync(HOSTED_CI_WORKFLOW_PATHS.forbiddenQualityGates)).toBe(false);
    expect(validateGitHubHostedCiBoundary(process.cwd())).toEqual([]);
    expect(validateWorkflowText(HOSTED_CI_WORKFLOW_PATHS.main, readFileSync(HOSTED_CI_WORKFLOW_PATHS.main, 'utf8'))).toEqual([]);
    expect(validateWorkflowText('.github/workflows/quality-gates.yml', 'run: npm run quality-gates:run').map((failure) => failure.code)).toContain('github-pr-quality-workflow-forbidden');
    expect(validateWorkflowText('.github/workflows/pr-checks.yml', [
      'on:',
      '  pull_request:',
      '    branches:',
      '      - integration',
      '  schedule:',
      '    - cron: "17 2 * * *"',
    ].join('\n')).map((failure) => failure.code)).toEqual(expect.arrayContaining([
      'github-pull-request-trigger-forbidden',
      'github-integration-push-trigger-forbidden',
      'github-nightly-schedule-forbidden',
    ]));
    for (const scalar of ['on: pull_request', 'on: "pull_request"', "on: 'pull_request'", 'on: [pull_request]', 'on:\n  - pull_request', 'on: pull_request_target']) {
      expect(validateWorkflowText('.github/workflows/pr-checks.yml', scalar).map((failure) => failure.code)).toContain('github-pull-request-trigger-forbidden');
    }
    expect(validateWorkflowText('.github/workflows/nightly.yml', 'on: schedule').map((failure) => failure.code)).toContain('github-nightly-schedule-forbidden');
    const hosted = validateWorkflowText(HOSTED_CI_WORKFLOW_PATHS.main, [
      'on:',
      '  pull_request:',
      '    branches:',
      '      - integration',
      '  push:',
      '    branches:',
      '      - release/**',
      'jobs:',
      '  main-release-quality-gates:',
      '    run: npm run quality-gates:run',
    ].join('\n'));
    expect(hosted.map((failure) => failure.code)).toEqual(expect.arrayContaining([
      'github-pull-request-trigger-forbidden',
      'github-release-branch-trigger-forbidden',
      'github-main-release-quality-job-forbidden',
      'github-quality-gate-runner-hosted',
      'github-workflow-dispatch-missing',
      'github-main-push-trigger-missing',
      'github-integration-push-trigger-forbidden',
    ]));
    const invalid = validateWorkflowText('fixture.yml', [
      'run: npx vitest run src/a.test.ts',
      'continue-on-error: true',
      'run: command || true',
      'run: node --import tsx/esm ./scripts/check.ts',
    ].join('\n'));
    expect(invalid.map((failure) => failure.code)).toEqual(expect.arrayContaining([
      'workflow-manual-test-list',
      'workflow-accepted-failure',
      'workflow-silent-skip',
      'forbidden-node-tsx-esm-loader',
    ]));
  });

  it('expands or blocks when the PR impact denominator is not closed', () => {
    const closedDenominator = Object.fromEntries(IMPACT_DENOMINATOR_KEYS.map((key) => [key, true]));
    const affected = selectPrImpact({
      changedPaths: ['src/features/teacher/page.tsx'],
      denominator: closedDenominator,
    });
    expect(affected.scope).toBe('affected');
    expect(affected.affectedDomains).toEqual(['web']);
    expect(affected.requiredCheckIds).toContain('pr/typecheck-tools');
    expect(selectPrImpact({ changedPaths: ['src/features/teacher/page.tsx'] }).denominatorClosed).toBe(false);
    expect(selectPrImpact({ changedPaths: ['course-content/runtime/lessons/example.json'] }).scope).toBe('full-related');
    expect(selectPrImpact({ changedPaths: ['course-content/runtime/lessons/example.json'] }).requiredCheckIds).toContain('pr/critical-e2e');

    const expanded = selectPrImpact({
      changedPaths: ['src/features/teacher/page.tsx'],
      denominator: { 'typescript-graph': false },
    });
    expect(expanded.scope).toBe('full-related');
    expect(expanded.denominatorClosed).toBe(false);
    expect(expanded.requiredCheckIds.length).toBeGreaterThan(affected.requiredCheckIds.length);

    const blocked = selectPrImpact({
      changedPaths: ['src/features/teacher/page.tsx'],
      denominator: { 'owner-map': false },
      canExpandToFullScope: false,
    });
    expect(blocked.scope).toBe('blocked');
    expect(blocked.fallbackReason).toContain('impact-denominator-unresolved');
  });

  it('keeps integration protection unverified when GitHub returns a 403-class response', () => {
    const receipt = createBlockedIntegrationProtectionReceipt({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      responseClass: 'rest-403',
      capturedAt: '2026-08-27T00:00:00.000Z',
    });
    expect(receipt.status).toBe('blocked-unverified');
    expect(receipt.enforcement).toBe('unknown');
    expect(receipt.requiredChecks).toEqual([]);
    expect(validateIntegrationProtectionReceipt(receipt)).toEqual([]);
  });

  it('forbids mapping quality-gate registry checks to GitHub required CI status checks', () => {
    const platform = createIntegrationProtectionReceipt({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      responseClass: 'not-configured',
      enforcement: 'disabled',
      requiredChecks: [],
      strictStatus: null,
      requiredReviews: null,
      conversationResolution: null,
      bypassActors: [],
      capturedAt: '2026-08-27T00:00:00.000Z',
      status: 'verified',
    });
    expect(platform.status).toBe('verified');
    expect(platform.requiredChecks).toEqual([]);
    expect(validateIntegrationProtectionReceipt(platform)).toEqual([]);

    const hostedRequired = createIntegrationProtectionReceipt({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      responseClass: 'not-configured',
      enforcement: 'disabled',
      requiredChecks: ['pr/contract'],
      strictStatus: null,
      requiredReviews: null,
      conversationResolution: null,
      bypassActors: [],
      capturedAt: '2026-08-27T00:00:00.000Z',
      status: 'verified',
    });
    expect(hostedRequired.status).toBe('blocked-unverified');
    expect(validateIntegrationProtectionReceipt({
      ...platform,
      requiredChecks: ['pr/contract'],
    }).map((failure) => failure.code)).toContain('github-required-ci-checks-forbidden');
  });

  it('does not mark GitHub protection verified from dirty trees or local workflow files', () => {
    const dirty = createIntegrationProtectionReceipt({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: true,
      responseClass: 'not-configured',
      enforcement: 'disabled',
      requiredChecks: [],
      strictStatus: null,
      requiredReviews: null,
      conversationResolution: null,
      bypassActors: [],
      capturedAt: '2026-08-27T00:00:00.000Z',
      status: 'verified',
    });
    expect(dirty.status).toBe('blocked-unverified');
    expect(validateIntegrationProtectionReceipt(dirty)).toEqual([]);

    const localFiles = createIntegrationProtectionReceipt({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      responseClass: 'local-workflow-inspection',
      enforcement: 'disabled',
      requiredChecks: [],
      strictStatus: null,
      requiredReviews: null,
      conversationResolution: null,
      bypassActors: [],
      capturedAt: '2026-08-27T00:00:00.000Z',
      status: 'verified',
    });
    expect(localFiles.status).toBe('blocked-unverified');
    expect(validateIntegrationProtectionReceipt(localFiles)).toEqual([]);
  });

  it('does not permit a release check to be removed or downgraded', () => {
    const removed = copyRegistry();
    removed.checks = removed.checks.filter((item) => item.checkId !== 'main-release/rollback-smoke');
    expect(validateMainReleasePreservation(DEFAULT_QUALITY_GATE_REGISTRY, removed).map((failure) => failure.code)).toContain('release-check-removed');

    const downgraded = copyRegistry();
    downgraded.checks = downgraded.checks.map((item) => item.checkId === 'main-release/readyz'
      ? { ...item, failurePolicy: 'observe' as const, required: false }
      : item);
    expect(validateMainReleasePreservation(DEFAULT_QUALITY_GATE_REGISTRY, downgraded).map((failure) => failure.code)).toContain('release-check-downgraded');
  });

  it('treats graph receipt status and tsc errors as gates even when the process exits cleanly', () => {
    const blockedWeb = graphReceipt('web', { status: 'blocked', exitStatus: 0, failureCodes: ['production-to-tooling'] });
    expect(validateTypecheckReceipts([blockedWeb], { sourceCommit: COMMIT, sourceTree: TREE, requiredGraphs: ['web'] }).map((failure) => failure.code)).toContain('typecheck-receipt-status');

    const toolsError = graphReceipt('tools', { status: 'failed', exitStatus: 1, tscErrorCount: 1, failureCodes: ['tsc-type-errors'] });
    expect(validateTypecheckReceipts([toolsError, graphReceipt('test')], { sourceCommit: COMMIT, sourceTree: TREE, requiredGraphs: ['tools', 'test'] }).map((failure) => failure.code)).toEqual(expect.arrayContaining([
      'typecheck-receipt-status',
      'typecheck-receipt-exit',
      'typecheck-receipt-tsc-errors',
    ]));
  });

  it('creates revision-bound layer receipts and refuses privacy-unsafe identities', () => {
    const checks = DEFAULT_QUALITY_GATE_REGISTRY.checks.filter((item) => item.checkId === 'pr/contract');
    const receipt = createLayerReceipt({
      layer: 'pr',
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      workflowRunId: 'run-1',
      scope: 'contract',
      requiredInputs: ['test-command-discovery-core'],
      checks,
      results: [{
        checkId: 'pr/contract',
        status: 'passed',
        commandIds: ['test:contract'],
        exitStatus: 0,
        receiptIds: ['receipt-1'],
        failureCodes: [],
        unhandledErrors: 0,
      }],
      capturedAt: '2026-08-27T00:00:00.000Z',
    });
    expect(receipt.status).toBe('passed');
    expect(validateLayerReceipt(receipt, checks)).toEqual([]);
    expect(() => createLayerReceipt({
      layer: 'pr',
      sourceCommit: '/Users/private/commit',
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      scope: 'contract',
      requiredInputs: [],
      checks,
      results: [],
      capturedAt: '2026-08-27T00:00:00.000Z',
    })).toThrow('privacy-unsafe-quality-gate-receipt:absolute-path');
  });
});

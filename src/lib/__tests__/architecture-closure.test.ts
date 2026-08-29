import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_INPUT_IDS,
  CANONICAL_CLOSURE_COMMAND,
  CLOSURE_MANIFEST_SCHEMA_VERSION,
  CLOSURE_OWNER,
  REQUIRED_TERMINAL_STAGE_IDS,
  captureFromFlags,
  characterizeRepository,
  characterizeSources,
  generateArchitectureClosure,
  parseArchitectureClosureReceipt,
  runArchitectureClosureCommand,
  sealClosureInput,
  serializeDeterministic,
  sha256Text,
} from '@/lib/architecture-closure';
import type { ClosureCapture, ClosureInputReceipt, ClosureManifest } from '@/lib/architecture-closure';

const COMMIT = 'a'.repeat(40);
const TREE = 'b'.repeat(40);

function observation(identity: string, classification: ClosureInputReceipt['observations'][number]['classification'] = 'included') {
  return { identity, classification };
}

function receipt(stageId: string, overrides: Partial<ClosureInputReceipt> = {}): ClosureInputReceipt {
  const observations = overrides.observations ?? [observation(`${stageId}:item`)];
  const totals = overrides.totals ?? {
    discovered: observations.length,
    included: observations.filter((item) => item.classification === 'included').length,
    excluded: observations.filter((item) => item.classification === 'excluded').length,
    duplicate: observations.filter((item) => item.classification === 'duplicate').length,
    unresolved: observations.filter((item) => item.classification === 'unresolved').length,
  };
  return sealClosureInput({
    stageId,
    receiptId: `receipt:${stageId}`,
    schemaVersion: `act-test/${stageId}/v1`,
    owner: CLOSURE_OWNER,
    scope: stageId,
    sourceCommit: COMMIT,
    sourceTree: TREE,
    producerChange: `change-${stageId}`,
    producerRevision: COMMIT,
    status: 'qualified',
    current: true,
    evidenceClass: 'receipt',
    conclusion: `${stageId}-ok`,
    observations,
    totals,
    metrics: [],
    compatibilityRecords: [],
    blockedRecords: [],
    ...overrides,
    observations,
    totals,
  });
}

function qualifiedManifest(overrides: Partial<ClosureManifest> = {}): ClosureManifest {
  const fitness = receipt('fitness', {
    metrics: [
      {
        metricId: 'scc-count',
        scope: 'production',
        unit: 'count',
        value: 3,
        sourceField: 'totals.scc',
        phase: 'before',
        status: 'qualified',
      },
      {
        metricId: 'scc-count',
        scope: 'production',
        unit: 'count',
        value: 1,
        sourceField: 'totals.scc',
        phase: 'after',
        status: 'qualified',
      },
    ],
  });
  const inputs = {
    baseline: receipt('baseline'),
    charter: receipt('charter'),
    dependency: receipt('dependency'),
    fitness,
    qa: receipt('qa'),
  };
  return {
    schemaVersion: CLOSURE_MANIFEST_SCHEMA_VERSION,
    inputs,
    terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => receipt(stageId)),
    ...overrides,
    inputs: { ...inputs, ...(overrides.inputs ?? {}) },
    terminals: overrides.terminals ?? REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => receipt(stageId)),
  };
}

function capture(flags?: Partial<ClosureCapture>): ClosureCapture {
  return captureFromFlags(COMMIT, TREE, flags);
}

describe('architecture closure', () => {
  it('keeps the frozen terminal registry and excludes tracking parent 1603', () => {
    expect(REQUIRED_TERMINAL_STAGE_IDS).toEqual([
      'governance-1548',
      'quality-1554',
      'toolchain-1557',
      'toolchain-1558',
      'toolchain-1559',
      'assessment-personalization-1567',
      'course-classroom-1576',
      'learning-record-1587',
      'knowledge-resource-1592',
      'practice-1602',
      'assignment-retirement-1607',
      'generated-content-reconciliation-1608',
    ]);
    expect(REQUIRED_TERMINAL_STAGE_IDS.join(' ')).not.toContain('1603');
    expect(AUTHORITY_INPUT_IDS).toEqual(['baseline', 'charter', 'dependency', 'fitness', 'qa']);
  });

  it('replays a qualified manifest byte-identically and pairs before/after metrics', () => {
    const manifest = qualifiedManifest();
    const first = generateArchitectureClosure(capture(), manifest, []);
    const second = generateArchitectureClosure(capture(), manifest, []);
    expect(first.receipt.status).toBe('qualified');
    expect(first.serialized).toBe(second.serialized);
    expect(first.digest).toBe(second.digest);
    expect(first.receipt.terminalCoverage.expected).toEqual([...REQUIRED_TERMINAL_STAGE_IDS]);
    expect(first.receipt.terminalCoverage.present).toEqual([...REQUIRED_TERMINAL_STAGE_IDS].sort((left, right) => left.localeCompare(right)));
    expect(first.receipt.totals.discovered).toBe(AUTHORITY_INPUT_IDS.length + REQUIRED_TERMINAL_STAGE_IDS.length);
    expect(first.receipt.beforeMetrics).toHaveLength(1);
    expect(first.receipt.afterMetrics).toHaveLength(1);
    expect(first.receipt.beforeMetrics[0]?.metricId).toBe('scc-count');
    const parsed = parseArchitectureClosureReceipt(first.serialized);
    expect(parsed.receiptId).toBe(first.receipt.receiptId);
  });

  it('changes receipt identity when an input byte changes', () => {
    const original = generateArchitectureClosure(capture(), qualifiedManifest(), []);
    const mutated = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'quality-1554'
          ? receipt(stageId, { conclusion: 'quality-changed' })
          : receipt(stageId)
      )),
    });
    const next = generateArchitectureClosure(capture(), mutated, []);
    expect(next.receipt.receiptId).not.toBe(original.receipt.receiptId);
    expect(next.digest).not.toBe(original.digest);
  });

  it('fails closed for dirty, mixed, drifted, schema, producer, and stale terminals', () => {
    const manifest = qualifiedManifest();
    expect(generateArchitectureClosure(capture({ dirty: true }), manifest, []).receipt.status).toBe('unresolved');
    expect(generateArchitectureClosure(capture({ mixedWorktree: true }), manifest, []).receipt.status).toBe('unresolved');
    expect(generateArchitectureClosure(captureFromFlags('c'.repeat(40), TREE), manifest, []).receipt.status).toBe('unresolved');
    expect(generateArchitectureClosure(capture(), { ...manifest, schemaVersion: 'wrong' as typeof manifest.schemaVersion }, []).receipt.status).toBe('unresolved');
    const stale = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'governance-1548' ? receipt(stageId, { current: false }) : receipt(stageId)
      )),
    });
    const staleResult = generateArchitectureClosure(capture(), stale, []);
    expect(staleResult.receipt.status).toBe('unresolved');
    expect(staleResult.receipt.terminalCoverage.stale).toEqual(['governance-1548']);
    const producer = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'toolchain-1559' ? receipt(stageId, { producerRevision: '' }) : receipt(stageId)
      )),
    });
    expect(generateArchitectureClosure(capture(), producer, []).failures.some((item) => item.code === 'invalid-receipt-identity')).toBe(true);
    expect(generateArchitectureClosure(capture(), producer, []).receipt.status).toBe('unresolved');
  });

  it('preserves missing, duplicate, excluded, unresolved, and isolated/main path conflicts in the denominator', () => {
    const missing = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.filter((stageId) => stageId !== 'practice-1602').map((stageId) => receipt(stageId)),
    });
    const missingResult = generateArchitectureClosure(capture(), missing, []);
    expect(missingResult.receipt.terminalCoverage.missing).toEqual(['practice-1602']);
    expect(missingResult.receipt.status).toBe('unresolved');

    const duplicate = qualifiedManifest({
      terminals: [...REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => receipt(stageId)), receipt('quality-1554')],
    });
    expect(generateArchitectureClosure(capture(), duplicate, []).receipt.terminalCoverage.duplicate).toEqual(['quality-1554']);

    const mixed = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => {
        if (stageId !== 'course-classroom-1576') return receipt(stageId);
        return receipt(stageId, {
          observations: [
            {
              identity: 'main:src/app/legacy.ts:aaa',
              classification: 'unresolved',
              worktreeRole: 'main',
              path: 'src/app/legacy.ts',
              contentDigest: 'aaa',
            },
            {
              identity: 'isolated:src/app/legacy.ts:bbb',
              classification: 'unresolved',
              worktreeRole: 'isolated',
              path: 'src/app/legacy.ts',
              contentDigest: 'bbb',
            },
          ],
          totals: { discovered: 2, included: 0, excluded: 0, duplicate: 0, unresolved: 2 },
        });
      }),
    });
    const mixedResult = generateArchitectureClosure(capture(), mixed, []);
    expect(mixedResult.receipt.status).toBe('unresolved');
    expect(mixedResult.receipt.totals.unresolved).toBeGreaterThan(0);

    const incomplete = qualifiedManifest({
      inputs: {
        ...qualifiedManifest().inputs,
        baseline: receipt('baseline', {
          observations: [observation('baseline:item')],
          totals: { discovered: 2, included: 1, excluded: 0, duplicate: 0, unresolved: 0 },
        }),
      },
    });
    expect(generateArchitectureClosure(capture(), incomplete, []).failures.some((item) => item.code === 'denominator-mismatch')).toBe(true);

    const duplicateMetric = qualifiedManifest({
      inputs: {
        ...qualifiedManifest().inputs,
        fitness: receipt('fitness', {
          metrics: [
            {
              metricId: 'scc-count',
              scope: 'production',
              unit: 'count',
              value: 1,
              sourceField: 'totals.scc',
              phase: 'after',
              status: 'qualified',
            },
            {
              metricId: 'scc-count',
              scope: 'production',
              unit: 'count',
              value: 2,
              sourceField: 'totals.scc',
              phase: 'after',
              status: 'qualified',
            },
          ],
        }),
      },
    });
    expect(generateArchitectureClosure(capture(), duplicateMetric, []).failures.some((item) => item.code === 'duplicate-metric' || item.code === 'missing-metric-pair')).toBe(true);
  });

  it('uses status precedence blocked, unresolved, observed, then qualified', () => {
    const blocked = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'assignment-retirement-1607'
          ? receipt(stageId, {
            status: 'blocked',
            blockedRecords: [{
              identity: 'legacy-document-grading',
              owner: 'assignment',
              sourceReceiptId: 'receipt:assignment-retirement-1607',
              reason: 'blocking-compatibility',
              resolutionCondition: 'delete-legacy-bridge-after-zero-caller-proof',
            }],
          })
          : receipt(stageId)
      )),
    });
    const blockedResult = generateArchitectureClosure(capture(), blocked, []);
    expect(blockedResult.receipt.status).toBe('blocked');
    expect(blockedResult.receipt.blockedRecords.some((item) => item.identity === 'legacy-document-grading')).toBe(true);

    const observed = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'generated-content-reconciliation-1608' ? receipt(stageId, { status: 'observed' }) : receipt(stageId)
      )),
    });
    expect(generateArchitectureClosure(capture(), observed, []).receipt.status).toBe('observed');

    const compatibility = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'knowledge-resource-1592'
          ? receipt(stageId, {
            compatibilityRecords: [{
              identity: 'compat:old-registry',
              owner: 'knowledge',
              inClosureScope: true,
              deletionProof: null,
              reason: 'still-present',
              resolutionCondition: 'delete-after-zero-caller',
            }],
          })
          : receipt(stageId)
      )),
    });
    expect(generateArchitectureClosure(capture(), compatibility, []).receipt.status).toBe('blocked');
  });

  it('rejects proposal, issue, task, archive substitutes and privacy leaks', () => {
    const proposal = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'toolchain-1557' ? receipt(stageId, { evidenceClass: 'proposal', current: true }) : receipt(stageId)
      )),
    });
    expect(generateArchitectureClosure(capture(), proposal, []).receipt.terminalCoverage.unresolved).toContain('toolchain-1557');

    const issue = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'toolchain-1558' ? receipt(stageId, { evidenceClass: 'issue' }) : receipt(stageId)
      )),
    });
    expect(generateArchitectureClosure(capture(), issue, []).receipt.status).toBe('unresolved');

    const leak = qualifiedManifest({
      terminals: REQUIRED_TERMINAL_STAGE_IDS.map((stageId) => (
        stageId === 'qa'
          ? receipt(stageId)
          : stageId === 'quality-1554'
            ? receipt(stageId, {
              compatibilityRecords: [{
                identity: 'qa-raw',
                owner: 'platform',
                inClosureScope: false,
                deletionProof: 'kept',
                reason: 'copied /Users/me/secret.log',
                resolutionCondition: 'drop-raw-path',
              }],
            })
            : receipt(stageId)
      )),
    });
    const leaked = generateArchitectureClosure(capture(), leak, []);
    expect(leaked.receipt.status).toBe('unresolved');
    expect(leaked.serialized).not.toContain('/Users/me/secret.log');
    expect(leaked.failures.some((item) => item.code === 'privacy-violation')).toBe(true);
  });

  it('records competing aggregators and keeps census/charter/fitness as non-substitutes', () => {
    const competing = characterizeSources(
      {
        [CANONICAL_CLOSURE_COMMAND]: 'tsx ./scripts/architecture-closure.ts',
        'census:architecture': 'tsx ./scripts/architecture-census.ts',
        'closure:global': 'node ./scripts/global-closure.ts',
      },
      [{ path: 'scripts/global-closure.ts', content: 'export const summary = 1;\n' }],
    );
    expect(competing.some((item) => item.identity === 'script:closure:global')).toBe(true);
    const result = generateArchitectureClosure(capture(), qualifiedManifest(), competing);
    expect(result.receipt.status).toBe('unresolved');
    expect(result.failures.some((item) => item.code === 'competing-aggregator')).toBe(true);
  });

  it('writes a derived receipt through the command and rolls back only that artifact', () => {
    const dir = mkdtempSync(join(tmpdir(), 'architecture-closure-'));
    try {
      const upstream = join(dir, 'upstream.json');
      writeFileSync(upstream, '{"keep":true}\n');
      const before = readFileSync(upstream, 'utf8');
      writeFileSync(join(dir, 'manifest.json'), serializeDeterministic(qualifiedManifest()));
      const out = join(dir, 'out');
      const result = runArchitectureClosureCommand({
        argv: ['--manifest', 'manifest.json', '--out', 'out'],
        cwd: dir,
        capture: capture(),
        competing: [],
      });
      expect(result.status).toBe('qualified');
      const written = readFileSync(join(out, 'architecture-closure-receipt.json'), 'utf8');
      expect(sha256Text(written).trim()).toBe(readFileSync(join(out, 'architecture-closure-receipt.sha256'), 'utf8').trim());
      rmSync(out, { recursive: true, force: true });
      expect(readFileSync(upstream, 'utf8')).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the canonical command and reader as the only closure consumer in product trees', () => {
    const findings = characterizeRepository(process.cwd());
    expect(findings.filter((item) => item.reason === 'forbidden-closure-consumer')).toEqual([]);
    expect(findings.filter((item) => item.reason === 'unbounded-closure-reexport')).toEqual([]);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts[CANONICAL_CLOSURE_COMMAND]).toContain('scripts/architecture-closure.ts');
    expect(pkg.scripts[CANONICAL_CLOSURE_COMMAND]).not.toMatch(/prisma|deploy|selector/);
  });
});

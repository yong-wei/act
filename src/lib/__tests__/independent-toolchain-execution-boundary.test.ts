import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { checkToolchainBoundary } from '../../../tools/boundary/check';
import { classifyPath } from '../../../tools/boundary/classify';
import { digestPaths } from '../../../tools/boundary/denominator';
import { findProductToolEdges, findProductToolPathReads } from '../../../tools/boundary/product-imports';
import { captureSourceIdentity, worktreeIsClean } from '../../../tools/boundary/git-source';
import { buildCommandReceipt, digestRegistry, validateReceipt } from '../../../tools/boundary/receipt';
import { buildToolRegistry, validateRegistry } from '../../../tools/boundary/registry';
import { DOWNSTREAM_CHANGES, TOOLCHAIN_BOUNDARY_SCHEMA_VERSION } from '../../../tools/boundary/types';
import type { ClassifiedEntry, SourceDenominator } from '../../../tools/boundary/types';

describe('independent toolchain execution boundary', () => {
  it('classifies frozen tracked families and excludes bytecode', () => {
    expect(classifyPath('course-content/scripts/export-runtime.sh', 'course-content-scripts')).toMatchObject({
      toolClass: 'content-export-review',
      owner: 'course',
    });
    expect(classifyPath('scripts/tests/__pycache__/x.pyc', 'scripts-tests')).toEqual({
      unresolved: true,
      path: 'scripts/tests/__pycache__/x.pyc',
    });
    expect(classifyPath('tools/mystery.ts', 'tools')).toEqual({
      unresolved: true,
      path: 'tools/mystery.ts',
    });
  });

  it('fails qualification for duplicate command owners and incomplete denominators', () => {
    const denominator = stubDenominator();
    const left = stubEntry({ owner: 'knowledge', toolClass: 'knowledge-release' });
    const right = stubEntry({ owner: 'platform', toolClass: 'knowledge-release', path: 'scripts/knowledge-cutover/other.ts' });
    const registry = buildToolRegistry(denominator, [left, right]);
    expect(validateRegistry(registry).some((item) => item.startsWith('duplicate-command:'))).toBe(true);
    expect(validateRegistry(buildToolRegistry(denominator, [])).some((item) => item.startsWith('empty-denominator:'))).toBe(false);
    const emptyRecord = buildToolRegistry(denominator, [left]);
    expect(validateRegistry({
      ...emptyRecord,
      records: emptyRecord.records.map((record) => ({ ...record, paths: [] })),
    }).some((item) => item.startsWith('empty-denominator:'))).toBe(true);
  });

  it('rejects receipts that embed absolute paths or secrets', () => {
    const receipt = buildCommandReceipt({
      commandId: 'toolchain:boundary-check',
      sourceRevision: 'abc',
      sourceTree: 'def',
      inputDigest: '1',
      outputDigest: '2',
      validatorVersion: TOOLCHAIN_BOUNDARY_SCHEMA_VERSION,
      exitStatus: 0,
      graphId: 'tools',
      privacyClass: 'none',
      safetyMode: 'read-only',
    });
    expect(validateReceipt(receipt)).toEqual([]);
    expect(validateReceipt({
      ...receipt,
      outputDigest: '/Users/YW/secret/NEXTAUTH_SECRET',
    }).length).toBeGreaterThan(0);
  });

  it('keeps generated-input records from changing the source denominator digest of tracked families', () => {
    const paths = ['scripts/db/a.ts', 'scripts/db/b.ts'];
    const digest = digestPaths(paths);
    const generated = [{
      producer: 'tmp',
      version: 'v1',
      pathClass: 'generated-input',
      digest: 'abc',
      sourceRevision: 'rev',
      path: '/tmp/generated.json',
    }];
    expect(digestPaths(paths)).toBe(digest);
    expect(generated[0]?.pathClass).toBe('generated-input');
    expect(digest).not.toContain('generated.json');
  });

  it('fail-closes a production module that imports a tool implementation', () => {
    const root = mkdtempSync(join(tmpdir(), 'toolchain-boundary-'));
    mkdirSync(join(root, 'src/app'), { recursive: true });
    mkdirSync(join(root, 'scripts/db'), { recursive: true });
    writeFileSync(join(root, 'scripts/db/backfill.ts'), 'export const x = 1;\n');
    writeFileSync(join(root, 'src/app/page.ts'), 'import { x } from "../../scripts/db/backfill";\n');
    const edges = findProductToolEdges(root, ['src/app/page.ts', 'scripts/db/backfill.ts']);
    expect(edges).toEqual([expect.objectContaining({
      from: 'src/app/page.ts',
      to: 'scripts/db/backfill.ts',
    })]);
  });

  it('fail-closes a worker module that imports a tool implementation', () => {
    const root = mkdtempSync(join(tmpdir(), 'toolchain-boundary-worker-'));
    mkdirSync(join(root, 'scripts/workers'), { recursive: true });
    mkdirSync(join(root, 'scripts/db'), { recursive: true });
    writeFileSync(join(root, 'scripts/db/backfill.ts'), 'export const x = 1;\n');
    writeFileSync(join(root, 'scripts/workers/job.ts'), 'import { x } from "../db/backfill";\n');
    const edges = findProductToolEdges(root, ['scripts/workers/job.ts', 'scripts/db/backfill.ts']);
    expect(edges).toEqual([expect.objectContaining({
      from: 'scripts/workers/job.ts',
      to: 'scripts/db/backfill.ts',
    })]);
  });

  it('fail-closes a dirty worktree before binding a source receipt', () => {
    const root = mkdtempSync(join(tmpdir(), 'toolchain-boundary-dirty-'));
    execFileSync('git', ['init'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'boundary@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'boundary'], { cwd: root });
    writeFileSync(join(root, 'README'), 'init\n');
    execFileSync('git', ['add', 'README'], { cwd: root });
    execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], { cwd: root });
    writeFileSync(join(root, 'dirty.txt'), 'unstaged\n');
    const result = checkToolchainBoundary(root);
    expect(result.failures.some((item) => item.code === 'dirty-worktree')).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('fail-closes a mixed worktree with staged and unstaged changes', () => {
    const root = mkdtempSync(join(tmpdir(), 'toolchain-boundary-mixed-'));
    execFileSync('git', ['init'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'boundary@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'boundary'], { cwd: root });
    writeFileSync(join(root, 'README'), 'init\n');
    execFileSync('git', ['add', 'README'], { cwd: root });
    execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], { cwd: root });
    writeFileSync(join(root, 'README'), 'staged edit\n');
    execFileSync('git', ['add', 'README'], { cwd: root });
    writeFileSync(join(root, 'unstaged.txt'), 'unstaged edit\n');
    const result = checkToolchainBoundary(root);
    expect(result.failures.some((item) => item.code === 'dirty-worktree')).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('fail-closes a stale inventory receipt through the real migration-backfill consumer', async () => {
    const { checkMigrationBackfillCompetition } = await import('../../../tools/migration-backfill/check');
    const root = mkdtempSync(join(tmpdir(), 'migration-backfill-stale-'));
    const foreignRoot = mkdtempSync(join(tmpdir(), 'migration-backfill-stale-foreign-'));
    for (const repo of [root, foreignRoot]) {
      execFileSync('git', ['init'], { cwd: repo });
      execFileSync('git', ['config', 'user.email', 'boundary@example.com'], { cwd: repo });
      execFileSync('git', ['config', 'user.name', 'boundary'], { cwd: repo });
    }
    // Distinct commit content per repo: identical trees + timestamps would make
    // git's deterministic commit SHAs collide across the two repositories.
    writeFileSync(join(root, 'README'), 'root init\n');
    writeFileSync(join(foreignRoot, 'README'), 'foreign init\n');
    for (const repo of [root, foreignRoot]) {
      execFileSync('git', ['add', 'README'], { cwd: repo });
      execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], { cwd: repo });
    }
    // The root repo also needs a minimal package.json for the package-script scan.
    writeFileSync(join(root, 'package.json'), '{"scripts":{}}\n');
    execFileSync('git', ['add', 'package.json'], { cwd: root });
    execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'pkg'], { cwd: root });
    const foreign = captureSourceIdentity(foreignRoot);
    const bound = captureSourceIdentity(root);
    const inventoryDir = join(root, 'docs/architecture/migration-backfill-competition');
    mkdirSync(inventoryDir, { recursive: true });

    // A receipt bound to a revision from a different history is rejected by the
    // real consumer as not-an-ancestor.
    writeFileSync(join(inventoryDir, 'inventory.json'), `${JSON.stringify({
      sourceRevision: foreign.sourceRevision,
      sourceTree: foreign.sourceTree,
      commands: [],
    })}\n`);
    const foreignResult = checkMigrationBackfillCompetition(root);
    expect(foreignResult.failures).toContain('inventory-revision-not-ancestor');
    expect(foreignResult.ok).toBe(false);

    // A receipt whose recorded tree no longer matches its own recorded revision
    // (tampered/stale capture) is rejected as a source-tree mismatch.
    writeFileSync(join(inventoryDir, 'inventory.json'), `${JSON.stringify({
      sourceRevision: bound.sourceRevision,
      sourceTree: foreign.sourceTree,
      commands: [],
    })}\n`);
    const mismatchResult = checkMigrationBackfillCompetition(root);
    expect(mismatchResult.failures).toContain('inventory-source-tree-mismatch');
    expect(mismatchResult.ok).toBe(false);
  });

  it('changes the receipt digest when a registry contract field changes', () => {
    const denominator = stubDenominator();
    const registry = buildToolRegistry(denominator, [stubEntry({})]);
    const mutated = {
      ...registry,
      records: registry.records.map((record) => ({ ...record, owner: 'other-owner', paths: [...record.paths, 'scripts/knowledge-cutover/extra.ts'] })),
    };
    expect(digestRegistry(mutated)).not.toBe(digestRegistry(registry));
  });

  it('fail-closes a new production path read that is not in the frozen allowlist', () => {
    const root = mkdtempSync(join(tmpdir(), 'toolchain-boundary-path-'));
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    mkdirSync(join(root, 'scripts/db'), { recursive: true });
    writeFileSync(join(root, 'scripts/db/backfill.ts'), 'export const x = 1;\n');
    writeFileSync(join(root, 'src/lib/run.ts'), "readFileSync('scripts/db/backfill.ts');\n");
    const reads = findProductToolPathReads(root, ['src/lib/run.ts', 'scripts/db/backfill.ts']);
    expect(reads).toEqual([expect.objectContaining({
      from: 'src/lib/run.ts',
      to: 'scripts/db/backfill.ts',
    })]);
  });

  it('fail-closes a statically joined process.cwd tool path read', () => {
    const root = mkdtempSync(join(tmpdir(), 'toolchain-boundary-join-'));
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    mkdirSync(join(root, 'scripts/db'), { recursive: true });
    writeFileSync(join(root, 'scripts/db/backfill.ts'), 'export const x = 1;\n');
    writeFileSync(
      join(root, 'src/lib/run.ts'),
      "import { join } from 'node:path';\nreadFileSync(join(process.cwd(), 'scripts', 'db', 'backfill.ts'));\n",
    );
    const reads = findProductToolPathReads(root, ['src/lib/run.ts', 'scripts/db/backfill.ts']);
    expect(reads).toEqual([expect.objectContaining({
      from: 'src/lib/run.ts',
      to: 'scripts/db/backfill.ts',
    })]);
  });

  it('qualifies the live captured Git denominator with independent tools mapping', () => {
    const result = checkToolchainBoundary(process.cwd());
    if (result.failures.some((item) => item.code === 'dirty-worktree')) {
      expect(worktreeIsClean(process.cwd())).toBe(false);
      return;
    }
    expect(result.failures.filter((item) => item.code === 'unclassified-entry')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.denominator.families.map((family) => family.id)).toContain('scripts-tests');
    expect(result.denominator.totalCount).toBeGreaterThan(400);
    expect(result.registry.records.some((record) => record.graphId === 'tools' && record.testCommand === 'typecheck:tools')).toBe(true);
    expect(result.registry.records.some((record) => record.followUpChange === 'extract-teaching-projection-publishing-cli' || DOWNSTREAM_CHANGES.includes(record.followUpChange as typeof DOWNSTREAM_CHANGES[number]))).toBe(true);
    expect(JSON.stringify(result.registry)).not.toMatch(/\/Users\//);
    expect(result.registry.records.some((record) => record.privacyClass === 'public-bundle')).toBe(true);
    expect(result.registry.records.some((record) => record.privacyClass === 'private-run-evidence')).toBe(true);
    expect(result.preexistingPathReads.some((item) => (
      item.from === 'src/lib/runtime-external-input-bundle.ts'
      && item.to.startsWith('scripts/release/')
    ))).toBe(true);
    const toolsCount = Number(execFileSync('git', ['ls-files', '--', 'tools'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length);
    expect(result.denominator.families.find((family) => family.id === 'tools')?.count).toBe(toolsCount);
  });
});

function stubDenominator(): SourceDenominator {
  return {
    schemaVersion: TOOLCHAIN_BOUNDARY_SCHEMA_VERSION,
    sourceRevision: 'rev',
    sourceTree: 'tree',
    families: [],
    totalCount: 0,
    digest: 'digest',
    generatedInputs: [],
  };
}

function stubEntry(overrides: Partial<ClassifiedEntry>): ClassifiedEntry {
  return {
    path: 'scripts/knowledge-cutover/a.ts',
    familyId: 'scripts-knowledge-cutover',
    toolClass: 'knowledge-release',
    owner: 'knowledge',
    privacyClass: 'public-bundle',
    safetyMode: 'read-only',
    retirementCondition: 'migrate-then-delete-product-caller',
    followUpChange: 'isolate-content-knowledge-runtime-release-toolchains',
    ...overrides,
  };
}

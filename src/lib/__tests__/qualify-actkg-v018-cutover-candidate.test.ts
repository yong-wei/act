import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareActKgV018CutoverQualification } from '../../../scripts/knowledge-cutover/qualify-actkg-v018-cutover-candidate';
import { reviewedNeighborhoodOverlaySha256 } from '../authority-domain-shards/v018-reviewed-neighborhood-labels';
import {
  assertV018ProductionPointersUnchanged,
  collectDeclaredCandidateHashes,
  snapshotCurrentPointers,
  V018_NAMED_CONSUMERS,
  verifyAbsoluteFileHash,
  verifyDeclaredCandidateHashes,
} from '../../../tools/teaching-projection-publishing/qualify/v018-qualify';

const roots: string[] = [];
const REPO_ROOT = path.resolve(__dirname, '../../..');

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('v0.18 cutover qualification', () => {
  it('qualifies the sealed compound candidate without moving production selectors', async () => {
    const before = snapshotCurrentPointers(REPO_ROOT);
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-qualify-'));
    roots.push(outputRoot);
    const result = await prepareActKgV018CutoverQualification([
      '--repo-root',
      REPO_ROOT,
      '--output-root',
      outputRoot,
    ]);
    expect(existsSync(path.join(outputRoot, 'qualification-readiness.json'))).toBe(true);
    const report = JSON.parse(readFileSync(path.join(outputRoot, 'qualification-readiness.json'), 'utf8')) as {
      publicationOnly: boolean;
      productionCutoverAuthorized: boolean;
      selectorConsumption: boolean;
      consumerResults: Array<{
        consumerId: string;
        status: string;
        presentationLeak: boolean;
        reads: Array<{ kind: string; ok: boolean }>;
      }>;
      isolatedRollback: {
        advanced: boolean;
        restored: boolean;
        realPointersUnchanged: boolean;
        selectors: Record<string, { advanced: boolean; restored: boolean }>;
      };
      dualRebuild: { byteEquivalent: boolean; comparedFiles: number };
      inputHashes: { reviewedNeighborhoodOverlay?: string };
    };
    expect(report.publicationOnly).toBe(true);
    expect(report.productionCutoverAuthorized).toBe(false);
    expect(report.selectorConsumption).toBe(false);
    expect(report.consumerResults.map((row) => row.consumerId).sort()).toEqual([...V018_NAMED_CONSUMERS].sort());
    expect(report.consumerResults.every((row) => row.reads.length > 0)).toBe(true);
    expect(report.consumerResults.every((row) => (
      row.status === 'READY' && row.presentationLeak === false && row.reads.every((read) => read.ok)
    ))).toBe(true);
    expect(report.isolatedRollback.restored).toBe(true);
    expect(report.isolatedRollback.realPointersUnchanged).toBe(true);
    expect(Object.keys(report.isolatedRollback.selectors).sort()).toEqual([
      'authority',
      'authority-domain-shards',
      'consumer-activation',
      'prerequisites',
      'projection',
    ]);
    expect(report.isolatedRollback.selectors.authority.advanced).toBe(true);
    expect(report.isolatedRollback.selectors.projection.advanced).toBe(true);
    expect(report.isolatedRollback.selectors.prerequisites.advanced).toBe(true);
    expect(report.isolatedRollback.selectors['authority-domain-shards'].advanced).toBe(true);
    expect(report.isolatedRollback.selectors['consumer-activation'].advanced).toBe(true);
    expect(Object.values(report.isolatedRollback.selectors).every((row) => row.restored)).toBe(true);
    expect(report.dualRebuild.comparedFiles).toBeGreaterThanOrEqual(3);
    expect(result.blockers).not.toContain('teaching-dual-replay-trees-absent');
    expect(report.dualRebuild.byteEquivalent).toBe(true);
    expect(result.blockers.some((row) => row.startsWith('isolated-shard:'))).toBe(false);
    expect(result.status).toBe('READY');
    expect(report.inputHashes.reviewedNeighborhoodOverlay).toBe(reviewedNeighborhoodOverlaySha256());
    const after = snapshotCurrentPointers(REPO_ROOT);
    expect(() => assertV018ProductionPointersUnchanged(before, after)).not.toThrow();
    const authority = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/authoring/knowledge/authority/current.json'), 'utf8')) as { releaseId: string };
    expect(authority.releaseId).toBe('ctr:release:control-theory-engineering-v0.37');
  }, 180_000);

  it('binds the authority receipt body hash without trusting the file self-hash', () => {
    const declared = collectDeclaredCandidateHashes(REPO_ROOT).find((row) => (
      row.path.endsWith('/candidate-receipt.json') && row.digestScope === 'receipt-body-without-outputs'
    ));
    expect(declared).toBeTruthy();
    const blockers = verifyDeclaredCandidateHashes(REPO_ROOT);
    expect(blockers.some((row) => row.includes('receipt-body-hash-mismatch'))).toBe(false);
  });

  it('binds the declared label index hash so a mutated row cannot stay READY', () => {
    const label = collectDeclaredCandidateHashes(REPO_ROOT).find((row) => (
      row.path.endsWith('multilingual-label-index.jsonl')
    ));
    expect(label).toBeTruthy();
    expect(verifyAbsoluteFileHash(path.join(REPO_ROOT, label!.path), label!.sha256)).toBeNull();
    const scratch = mkdtempSync(path.join(tmpdir(), 'act-v018-label-'));
    roots.push(scratch);
    const copy = path.join(scratch, 'multilingual-label-index.jsonl');
    copyFileSync(path.join(REPO_ROOT, label!.path), copy);
    const lines = readFileSync(copy, 'utf8').split('\n');
    const target = lines.findIndex((line) => line.trim());
    expect(target).toBeGreaterThanOrEqual(0);
    lines[target] = `${lines[target].slice(0, -1)}"mutated":true}`;
    writeFileSync(copy, lines.join('\n'));
    expect(verifyAbsoluteFileHash(copy, label!.sha256)).toMatch(/declared-hash-mismatch/);
  });

  it('refuses to write qualification output onto a runtime selector path', async () => {
    await expect(prepareActKgV018CutoverQualification([
      '--repo-root',
      REPO_ROOT,
      '--output-root',
      path.join(REPO_ROOT, 'course-content/runtime/knowledge/projection'),
    ])).rejects.toThrow('runtime selector');
  });
});

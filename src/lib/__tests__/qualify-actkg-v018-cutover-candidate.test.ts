import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareActKgV018CutoverQualification } from '../../../scripts/knowledge-cutover/qualify-actkg-v018-cutover-candidate';
import {
  assertV018ProductionPointersUnchanged,
  snapshotCurrentPointers,
  V018_NAMED_CONSUMERS,
} from '../teaching-projection/qualify/v018-qualify';

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
    expect(result.status).toBe('READY');
    expect(result.blockers).toEqual([]);
    expect(existsSync(path.join(outputRoot, 'qualification-readiness.json'))).toBe(true);
    const report = JSON.parse(readFileSync(path.join(outputRoot, 'qualification-readiness.json'), 'utf8')) as {
      publicationOnly: boolean;
      productionCutoverAuthorized: boolean;
      selectorConsumption: boolean;
      consumerResults: Array<{ consumerId: string; status: string; presentationLeak: boolean }>;
      isolatedRollback: { advanced: boolean; restored: boolean; realPointersUnchanged: boolean };
    };
    expect(report.publicationOnly).toBe(true);
    expect(report.productionCutoverAuthorized).toBe(false);
    expect(report.selectorConsumption).toBe(false);
    expect(report.consumerResults.map((row) => row.consumerId).sort()).toEqual([...V018_NAMED_CONSUMERS].sort());
    expect(report.consumerResults.every((row) => row.status === 'READY' && row.presentationLeak === false)).toBe(true);
    expect(report.isolatedRollback).toEqual({ advanced: true, restored: true, realPointersUnchanged: true });
    const after = snapshotCurrentPointers(REPO_ROOT);
    expect(() => assertV018ProductionPointersUnchanged(before, after)).not.toThrow();
    const authority = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/authoring/knowledge/authority/current.json'), 'utf8')) as { releaseId: string };
    expect(authority.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
  }, 180_000);

  it('refuses to write qualification output onto a runtime selector path', async () => {
    await expect(prepareActKgV018CutoverQualification([
      '--repo-root',
      REPO_ROOT,
      '--output-root',
      path.join(REPO_ROOT, 'course-content/runtime/knowledge/projection'),
    ])).rejects.toThrow('runtime selector');
  });
});

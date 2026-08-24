import { describe, expect, it } from 'vitest';

import {
  evidenceCaptureRevisionProblems,
  type EvidenceCaptureRevision,
} from '@/lib/evidence-capture-guard';

const revision: EvidenceCaptureRevision = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
};

describe('evidenceCaptureRevisionProblems', () => {
  it('accepts an unchanged clean capture revision', () => {
    expect(evidenceCaptureRevisionProblems(revision, revision, [])).toEqual([]);
  });

  it('rejects a changed head or tree', () => {
    expect(evidenceCaptureRevisionProblems(
      revision,
      { ...revision, commitSha: 'c'.repeat(40) },
      [],
    )).toContain('capture-revision:head-changed');
    expect(evidenceCaptureRevisionProblems(
      revision,
      { ...revision, treeSha: 'd'.repeat(40) },
      [],
    )).toContain('capture-revision:tree-changed');
  });

  it('allows only declared artifact output paths after capture', () => {
    expect(evidenceCaptureRevisionProblems(
      revision,
      revision,
      [
        'artifacts/knowledge-workspace-product-qa-489/browser-evidence.json',
        'src/app/knowledge/page.tsx',
      ],
      ['artifacts/knowledge-workspace-product-qa-489/'],
    )).toEqual(['capture-revision:unexpected-dirty:src/app/knowledge/page.tsx']);
  });
});

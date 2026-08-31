import { describe, expect, it } from 'vitest';

import { normalizeVisualEvidence, projectVisualEvidenceIntoDocument } from '../visual-evidence-contract';

const checksum = `sha256:${'a'.repeat(64)}`;

describe('visual evidence contract', () => {
  it('requires a complete, attributable, confident visual record before it is ready', () => {
    const evidence = normalizeVisualEvidence({
      id: 'visual-1', sourceKind: 'word-embedded-image', sourceChecksum: checksum, imageChecksum: checksum,
      questionId: 'T2-3', pageNumber: 2, bbox: [10, 20, 30, 40], description: '手绘曲线包含稳定收敛过程。',
      confidence: 0.9, processorVersion: 'visual-v1', limitations: [], createdAt: '2026-08-17T00:00:00.000Z',
    });

    expect(evidence.readiness).toBe('ready');
    expect(evidence.contentHash).toMatch(/^sha256:/);
  });

  it('requires teacher review when location or description is incomplete', () => {
    const evidence = normalizeVisualEvidence({
      id: 'visual-2', sourceKind: 'pdf-page-image', sourceChecksum: checksum, imageChecksum: checksum,
      questionId: null, pageNumber: 1, bbox: null, description: null,
      confidence: null, processorVersion: 'visual-v1', limitations: ['question-attribution-unresolved'], createdAt: '2026-08-17T00:00:00.000Z',
    });

    expect(evidence.readiness).toBe('review-required');
  });

  it('projects complete descriptions and preserves incomplete-evidence blocking', () => {
    const ready = normalizeVisualEvidence({
      id: 'visual-3', sourceKind: 'pdf-page-image', sourceChecksum: checksum, imageChecksum: checksum,
      questionId: 'T2-3', pageNumber: 1, bbox: null, description: 'The diagram shows a stable convergence path.',
      confidence: 0.9, processorVersion: 'visual-v1', limitations: [], createdAt: '2026-08-17T00:00:00.000Z',
    });
    const incomplete = normalizeVisualEvidence({
      id: 'visual-4', sourceKind: 'pdf-page-image', sourceChecksum: checksum, imageChecksum: `sha256:${'b'.repeat(64)}`,
      questionId: 'T2-3', pageNumber: 2, bbox: null, description: null,
      confidence: null, processorVersion: 'visual-v1', limitations: [], createdAt: '2026-08-17T00:00:00.000Z',
    });
    const projected = projectVisualEvidenceIntoDocument({ markdown: 'Original answer.', blocks: [{ id: 'text-1', text: 'Original answer.' }], visualEvidence: [ready, incomplete] });

    expect(projected.markdown).toContain('The diagram shows a stable convergence path.');
    expect(projected.blocks).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'visual-evidence:visual-3', pageNumber: 1 })]));
    expect(projected.limitations).toEqual(['visual-evidence-not-delivered']);
  });
});

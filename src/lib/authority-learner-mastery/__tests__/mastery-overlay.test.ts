import { describe, expect, it } from 'vitest';

import { buildLearningFactCrosswalkIndex } from '@/lib/canonical-learning-fact-identity/crosswalk-serving';

import {
  buildActiveAuthorityMasteryOverlay,
  masteryEvidenceScore,
  masteryStateFor,
  type MasteryEvidenceFact,
} from '..';

const EMPTY_CROSSWALK = buildLearningFactCrosswalkIndex([]);
const DOMAINS = [
  { visualRole: 'time-domain', memberIds: ['obj:a', 'obj:b'] },
  { visualRole: 'frequency-domain', memberIds: ['obj:c'] },
];

let sequence = 0;
function canonical(objectId: string, outcome: string, score: number | null = null, day = 1): MasteryEvidenceFact {
  sequence += 1;
  return {
    id: `fact-${sequence}`,
    knowledgeIdentityNamespace: 'CANONICAL',
    canonicalObjectId: objectId,
    outcome,
    score,
    startedAt: new Date(Date.UTC(2026, 0, day)),
  };
}

function legacy(legacyId: string, outcome: string, score: number | null = null): MasteryEvidenceFact {
  sequence += 1;
  return {
    id: `fact-${sequence}`,
    knowledgeIdentityNamespace: 'LEGACY',
    contextJson: { knowledgeNodeIds: [legacyId] },
    outcome,
    score,
    startedAt: new Date(Date.UTC(2026, 0, 1)),
  };
}

describe('mastery evidence scoring', () => {
  it('prefers a numeric score and falls back to the outcome', () => {
    expect(masteryEvidenceScore({ outcome: 'failure', score: 85 })).toBe(0.85);
    expect(masteryEvidenceScore({ outcome: 'success', score: null })).toBe(1);
    expect(masteryEvidenceScore({ outcome: 'partial', score: null })).toBe(0.5);
    expect(masteryEvidenceScore({ outcome: 'failure', score: null })).toBe(0);
    expect(masteryEvidenceScore({ outcome: 'abandoned', score: null })).toBeNull();
    expect(masteryEvidenceScore({ outcome: 'unknown', score: null })).toBeNull();
  });

  it('requires two pieces of evidence before judging a state', () => {
    expect(masteryStateFor(1, 1)).toBe('evidence-needed');
    expect(masteryStateFor(0.8, 2)).toBe('mastered');
    expect(masteryStateFor(0.5, 2)).toBe('developing');
    expect(masteryStateFor(0.49, 2)).toBe('weak');
    expect(masteryStateFor(null, 5)).toBe('evidence-needed');
  });
});

describe('buildActiveAuthorityMasteryOverlay', () => {
  it('reports an empty status with coverage counts when nothing maps', () => {
    const overlay = buildActiveAuthorityMasteryOverlay({
      facts: [canonical('obj:outside', 'success'), legacy('legacy:x', 'success')],
      crosswalk: EMPTY_CROSSWALK,
      domains: DOMAINS,
    });
    expect(overlay).toEqual({
      contract: 'active-authority-mastery-overlay.v1',
      status: 'empty',
      domains: [],
      objects: [],
      coverage: { mappedFactCount: 0, unresolvedFactCount: 2 },
    });
  });

  it('aggregates Canonical facts per object and per domain', () => {
    const overlay = buildActiveAuthorityMasteryOverlay({
      facts: [
        canonical('obj:a', 'success'),
        canonical('obj:a', 'partial', 90),
        canonical('obj:b', 'failure'),
        canonical('obj:c', 'abandoned'),
      ],
      crosswalk: EMPTY_CROSSWALK,
      domains: DOMAINS,
    });
    expect(overlay.status).toBe('ready');
    if (overlay.status !== 'ready') return;
    expect(overlay.objects).toEqual([
      { id: 'obj:a', state: 'mastered', score: 0.95, confidence: 0.4, evidenceCount: 2 },
      { id: 'obj:b', state: 'evidence-needed', score: 0, confidence: 0.2, evidenceCount: 1 },
    ]);
    expect(overlay.domains).toEqual([{
      visualRole: 'time-domain',
      state: 'weak',
      score: 0.475,
      confidence: 0.6,
      evidenceCount: 3,
      coveredCount: 2,
      memberCount: 2,
    }]);
    expect(overlay.coverage).toEqual({ mappedFactCount: 3, unresolvedFactCount: 0 });
    expect(JSON.stringify(overlay)).not.toContain('fact-');
  });

  it('resolves historical facts only through non-stale crosswalk rows', () => {
    const crosswalk = buildLearningFactCrosswalkIndex([
      { legacyId: 'legacy:a', canonicalId: 'obj:a', role: null, sourceEvidence: null, stale: false },
      { legacyId: 'legacy:old', canonicalId: 'obj:c', role: null, sourceEvidence: null, stale: true },
    ]);
    const overlay = buildActiveAuthorityMasteryOverlay({
      facts: [
        legacy('legacy:a', 'success'),
        legacy('legacy:a', 'success'),
        legacy('legacy:old', 'success'),
        legacy('legacy:unknown', 'success'),
      ],
      crosswalk,
      domains: DOMAINS,
    });
    expect(overlay.status).toBe('ready');
    if (overlay.status !== 'ready') return;
    expect(overlay.objects.map((item) => [item.id, item.state])).toEqual([['obj:a', 'mastered']]);
    expect(overlay.coverage).toEqual({ mappedFactCount: 2, unresolvedFactCount: 2 });
  });

  it('keeps only the latest twenty facts per object', () => {
    const facts = [
      ...Array.from({ length: 20 }, (_, index) => canonical('obj:c', 'success', null, index + 10)),
      ...Array.from({ length: 10 }, (_, index) => canonical('obj:c', 'failure', null, index + 1)),
    ];
    const overlay = buildActiveAuthorityMasteryOverlay({ facts, crosswalk: EMPTY_CROSSWALK, domains: DOMAINS });
    if (overlay.status !== 'ready') throw new Error('expected ready overlay');
    expect(overlay.objects[0]).toMatchObject({ id: 'obj:c', score: 1, evidenceCount: 20, confidence: 1 });
  });
});

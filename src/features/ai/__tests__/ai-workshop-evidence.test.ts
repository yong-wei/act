import { describe, expect, it } from 'vitest';
import { projectAiWorkshopEvidence } from '../ai-workshop-evidence';

function state(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-08-23T00:00:00.000Z',
    authority: 'server-owned' as const,
    primaryPortraitState: 'SNAPSHOT' as const,
    primaryPortraitAvailability: 'current',
    pathContext: {
      activePathCount: 1,
      bookmarkedPathCount: 0,
      recentPathIds: [],
      activeControlCorrectionPath: {
        state: 'active' as const,
        pathId: 'path-1',
        status: 'active',
        currentNodeId: 'node-1',
        terminalValidationState: null,
        lowConfidenceMarkers: [],
      },
      statusMarkers: ['available' as const],
    },
    evidence: {
      readState: 'ready' as const,
      evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 },
      sourceCounts: { learningFact: 2 },
      sourceCoverage: { assessment: 'available' as const },
      confidence: {
        level: 'medium' as const,
        score: 0.7,
        evidenceCount: 2,
        sourceCompleteness: 1,
      },
      statusMarkers: [],
    },
    missingEvidence: [],
    ...overrides,
  };
}

describe('AI Workshop evidence projection', () => {
  it('projects server-owned available evidence without exposing raw state', () => {
    const projection = projectAiWorkshopEvidence(state());

    expect(projection).toMatchObject({
      status: 'available',
      authority: 'server-owned',
      evidence: {
        count: 2,
        readState: 'ready',
        sourceCoverage: {
          learningActivity: 'available',
          competencySnapshot: 'missing',
          portraitSnapshot: 'missing',
          profileSummary: 'missing',
        },
        confidence: { level: 'medium', score: 0.7 },
      },
      portrait: { state: 'available' },
      path: { activeCount: 1, currentNodeId: 'node-1' },
    });
    expect(projection).not.toHaveProperty('sourceCounts');
    expect(projection).not.toHaveProperty('missingEvidence');
  });

  it('returns empty instead of fabricating a learner profile when evidence is absent', () => {
    const projection = projectAiWorkshopEvidence(state({
      primaryPortraitState: 'NO_EVIDENCE',
      primaryPortraitAvailability: 'no-evidence',
      pathContext: {
        activePathCount: 0,
        bookmarkedPathCount: 0,
        recentPathIds: [],
        activeControlCorrectionPath: {
          state: 'none',
          pathId: null,
          status: null,
          currentNodeId: null,
          terminalValidationState: null,
          lowConfidenceMarkers: [],
        },
        statusMarkers: ['missing' as const],
      },
      evidence: {
        readState: 'missing',
        evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 },
        sourceCounts: {},
        sourceCoverage: {},
        confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
        statusMarkers: [],
      },
      missingEvidence: ['recent learning evidence'],
    }));

    expect(projection).toMatchObject({
      status: 'empty',
      evidence: { count: 0, confidence: { level: 'none' } },
      portrait: { state: 'empty' },
      path: { activeCount: 0, currentNodeId: null },
    });
    expect(projection.limitations.length).toBeGreaterThan(0);
  });

  it('keeps missing evidence cache separate from an existing portrait', () => {
    const projection = projectAiWorkshopEvidence(state({
      evidence: {
        ...state().evidence,
        readState: 'missing',
        sourceCoverage: {},
        confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
      },
    }));

    expect(projection.status).toBe('available');
    expect(projection.evidence).toMatchObject({
      readState: 'missing',
      count: 0,
      sourceCoverage: {
        learningActivity: 'missing',
        competencySnapshot: 'missing',
        portraitSnapshot: 'missing',
        profileSummary: 'missing',
      },
    });
    expect(projection.limitations).toContain('当前学习证据缓存尚未建立，证据指标暂不能形成个人结论。');
  });

  it('preserves partial and stale limitations without treating them as complete', () => {
    const projection = projectAiWorkshopEvidence(state({
      evidence: {
        ...state().evidence,
        readState: 'stale',
        statusMarkers: ['stale', 'low-confidence'],
      },
    }));

    expect(projection.status).toBe('available');
    expect(projection.limitations).toEqual(expect.arrayContaining([
      '学习证据需要更新，当前个性化结果可能不完整。',
      '当前个性化置信度较低，建议继续完成相关学习活动。',
    ]));
  });

  it('fails closed when the learner-state portrait is unavailable', () => {
    const projection = projectAiWorkshopEvidence(state({
      primaryPortraitState: 'UNAVAILABLE',
      primaryPortraitAvailability: 'cumulative-portrait-fence-unavailable',
    }));

    expect(projection).toMatchObject({
      status: 'unavailable',
      portrait: { state: 'unavailable' },
    });
  });
});

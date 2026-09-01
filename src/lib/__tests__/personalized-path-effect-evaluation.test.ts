import { describe, expect, it } from 'vitest';

import type { PersonalizedPathDecisionEvidence } from '@/features/personalization/path-planning/adaptive-path-decision-evidence';
import {
  classifyPersonalizedPathEffectCohort,
  evaluatePersonalizedPathEffects,
  recordsFromPathAndBatchSources,
  type PersonalizedPathEffectRecord,
} from '@/lib/personalized-path-effect-evaluation';

function snapshot(overrides: Partial<PersonalizedPathDecisionEvidence['snapshot']> = {}): PersonalizedPathDecisionEvidence {
  return {
    snapshot: {
      version: 'personalized-path-decision-evidence.v1',
      capturedAt: '2026-08-26T00:00:00.000Z',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      learnerStateVersion: 'adaptive-learner-state.v1',
      learnerStateGeneratedAt: '2026-08-25T00:00:00.000Z',
      weakTargets: [],
      preferredModalities: ['video'],
      preferredModalityConfidence: 'high',
      evidenceWindow: null,
      freshness: 'current',
      sourceCoverage: {},
      missingEvidence: [],
      limitations: [],
      degradationReasons: [],
      ...overrides,
    },
    paths: [{
      optionId: 'path-option-1',
      styleId: 'preference-matched',
      impacts: [{ kind: 'resource-type', source: 'profile', reasonCode: 'preferred-modality', resourceType: 'video' }],
      explanations: [{ code: 'preferred-modality', studentText: '按已验证的视频偏好安排资源。' }],
    }],
  };
}

function record(overrides: Partial<PersonalizedPathEffectRecord> = {}): PersonalizedPathEffectRecord {
  return {
    pathId: 'path-1',
    userId: 'student-1',
    goalId: 'control-correction',
    pathStatus: 'completed',
    plannerVersion: 'adaptive-learning-path-planner.v1',
    policyFamily: 'preference-matched',
    nodeCount: 4,
    createdAt: '2026-08-26T00:00:00.000Z',
    decisionEvidence: snapshot(),
    pathImpacts: snapshot().paths[0]?.impacts,
    executions: [
      { nodeId: 'n1', status: 'completed', resourceType: 'video' },
      { nodeId: 'n2', status: 'completed', resourceType: 'quiz' },
    ],
    competencyLift: 0.2,
    ...overrides,
  };
}

function many(prefix: string, count: number, overrides: Partial<PersonalizedPathEffectRecord> = {}) {
  return Array.from({ length: count }, (_value, index) => record({
    pathId: `${prefix}-${index + 1}`,
    userId: `${prefix}-user-${index + 1}`,
    ...overrides,
  }));
}

describe('personalized path effect evaluation', () => {
  it('splits trusted personalized, baseline, and insufficient samples', () => {
    const personalized = record();
    const baseline = record({
      pathId: 'path-baseline',
      userId: 'student-baseline',
      policyFamily: 'rules-plus-graph-search',
      decisionEvidence: snapshot({ preferredModalities: [] }),
      pathImpacts: [],
    });
    const insufficient = record({
      pathId: 'path-cold',
      userId: 'student-cold',
      decisionEvidence: snapshot({
        freshness: 'missing',
        degradationReasons: ['insufficient-evidence'],
        limitations: ['当前没有足够的有效学习证据支持个性化判断。'],
      }),
    });

    expect(classifyPersonalizedPathEffectCohort(personalized)).toBe('personalized');
    expect(classifyPersonalizedPathEffectCohort({
      ...baseline,
      decisionEvidence: {
        snapshot: snapshot().snapshot,
        paths: [{ optionId: 'path-option-1', styleId: 'rules-plus-graph-search', impacts: [], explanations: [] }],
      },
      pathImpacts: [],
    })).toBe('baseline');
    expect(classifyPersonalizedPathEffectCohort(insufficient)).toBe('insufficient');
    expect(classifyPersonalizedPathEffectCohort(record({
      policyFamily: 'preference-matched',
      pathImpacts: [],
      decisionEvidence: {
        snapshot: snapshot().snapshot,
        paths: [{ optionId: 'path-option-1', styleId: 'preference-matched', impacts: [], explanations: [] }],
      },
    }))).toBe('baseline');
  });

  it('counts unique learners rather than repeated paths for the sample threshold', () => {
    const evaluation = evaluatePersonalizedPathEffects({
      classId: 'class-1',
      goalId: 'control-correction',
      evaluatedAt: '2026-08-28T00:00:00.000Z',
      records: [
        ...Array.from({ length: 5 }, (_value, index) => record({
          pathId: `same-learner-${index + 1}`,
          userId: 'student-1',
          createdAt: `2026-08-2${index + 1}T00:00:00.000Z`,
        })),
        ...many('b', 5, {
          policyFamily: 'rules-plus-graph-search',
          pathImpacts: [],
          decisionEvidence: {
            snapshot: snapshot().snapshot,
            paths: [{ optionId: 'path-option-1', styleId: 'rules-plus-graph-search', impacts: [], explanations: [] }],
          },
        }),
      ],
    });
    expect(evaluation.conclusion).toBe('insufficient-data');
    expect(evaluation.cohorts.find((cohort) => cohort.id === 'personalized')?.sampleSize).toBe(1);
  });

  it('does not claim a lift when either comparison cohort is below five samples', () => {
    const evaluation = evaluatePersonalizedPathEffects({
      classId: 'class-1',
      goalId: 'control-correction',
      evaluatedAt: '2026-08-28T00:00:00.000Z',
      records: [
        ...many('p', 4),
        ...many('b', 6, {
          policyFamily: 'rules-plus-graph-search',
          pathImpacts: [],
          decisionEvidence: {
            snapshot: snapshot().snapshot,
            paths: [{ optionId: 'path-option-1', styleId: 'rules-plus-graph-search', impacts: [], explanations: [] }],
          },
        }),
        record({
          pathId: 'cold-1',
          userId: 'cold-1',
          decisionEvidence: snapshot({
            freshness: 'stale',
            degradationReasons: ['stale-evidence'],
            limitations: ['部分学习证据已经过期。'],
          }),
        }),
      ],
    });

    expect(evaluation.conclusion).toBe('insufficient-data');
    expect(evaluation.cohorts.find((cohort) => cohort.id === 'insufficient')?.sampleSize).toBe(1);
    expect(evaluation.limitations[0]).toContain('不能给出个性化提升结论');
  });

  it('keeps frozen snapshot metrics stable when a later portrait is ignored', () => {
    const frozen = [
      ...many('p', 5),
      ...many('b', 5, {
        policyFamily: 'rules-plus-graph-search',
        pathImpacts: [],
        decisionEvidence: {
          snapshot: snapshot().snapshot,
          paths: [{ optionId: 'path-option-1', styleId: 'rules-plus-graph-search', impacts: [], explanations: [] }],
        },
      }),
    ];
    const first = evaluatePersonalizedPathEffects({
      classId: 'class-1',
      goalId: 'control-correction',
      evaluatedAt: '2026-08-28T00:00:00.000Z',
      records: frozen,
    });
    const laterPortrait = snapshot({
      capturedAt: '2026-08-28T12:00:00.000Z',
      freshness: 'stale',
      degradationReasons: ['stale-evidence'],
    });
    const second = evaluatePersonalizedPathEffects({
      classId: 'class-1',
      goalId: 'control-correction',
      evaluatedAt: '2026-08-28T12:00:00.000Z',
      records: frozen,
    });

    expect(laterPortrait.snapshot.freshness).toBe('stale');
    expect(first.conclusion).toBe('observational');
    expect(second.conclusion).toBe('observational');
    expect(second.cohorts.map((cohort) => [cohort.id, cohort.sampleSize])).toEqual(
      first.cohorts.map((cohort) => [cohort.id, cohort.sampleSize]),
    );
  });

  it('binds persisted candidate-batch decision evidence onto path records', () => {
    const records = recordsFromPathAndBatchSources({
      paths: [{
        id: 'path-1',
        userId: 'student-1',
        goalId: 'control-correction',
        pathStatus: 'active',
        plannerVersion: 'adaptive-learning-path-planner.v1',
        nodeIds: ['n1', 'n2'],
        pathPayload: { policyFamily: 'preference-matched', selectedOptionId: 'path-option-1' },
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        executions: [{
          nodeId: 'n1',
          status: 'completed',
          resourceType: 'video',
          completedAt: new Date('2026-08-27T12:00:00.000Z'),
        }],
      }],
      batches: [{
        id: 'batch-1',
        userId: 'student-1',
        goalId: 'control-correction',
        sourcePathId: 'path-1',
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        metadata: { decisionEvidence: snapshot() },
      }],
      competencySnapshots: [
        { userId: 'student-1', snapshotAt: '2026-08-28T00:00:00.000Z', competencyVector: { a: { score: 0.95 } } },
        { userId: 'student-1', snapshotAt: '2026-08-27T00:00:00.000Z', competencyVector: { a: { score: 0.8 } } },
        { userId: 'student-1', snapshotAt: '2026-08-20T00:00:00.000Z', competencyVector: { a: { score: 0.5 } } },
      ],
    });

    expect(records[0]?.decisionEvidence?.snapshot.version).toBe('personalized-path-decision-evidence.v1');
    expect(classifyPersonalizedPathEffectCohort(records[0]!)).toBe('personalized');
    expect(records[0]?.competencyLift).toBeCloseTo(0.3);
  });

  it('does not attach a newer batch snapshot to an unmatched historical path', () => {
    const records = recordsFromPathAndBatchSources({
      paths: [{
        id: 'path-old',
        userId: 'student-1',
        goalId: 'control-correction',
        pathStatus: 'completed',
        plannerVersion: 'adaptive-learning-path-planner.v1',
        nodeIds: ['n1'],
        pathPayload: { policyFamily: 'rules-plus-graph-search' },
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        executions: [],
      }],
      batches: [{
        id: 'batch-new',
        userId: 'student-1',
        goalId: 'control-correction',
        sourcePathId: 'path-new',
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        metadata: { decisionEvidence: snapshot() },
      }],
    });

    expect(records[0]?.decisionEvidence).toBeNull();
    expect(classifyPersonalizedPathEffectCohort(records[0]!)).toBe('insufficient');
  });

  it('classifies only the selected option impacts and ignores later competency snapshots', () => {
    const records = recordsFromPathAndBatchSources({
      paths: [{
        id: 'path-1',
        userId: 'student-1',
        goalId: 'control-correction',
        pathStatus: 'completed',
        plannerVersion: 'adaptive-learning-path-planner.v1',
        nodeIds: ['n1'],
        pathPayload: { selectedOptionId: 'path-option-baseline' },
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        executions: [{
          nodeId: 'n1',
          status: 'completed',
          resourceType: 'quiz',
          completedAt: new Date('2026-08-27T00:00:00.000Z'),
        }],
      }],
      batches: [{
        id: 'batch-1',
        userId: 'student-1',
        goalId: 'control-correction',
        sourcePathId: 'path-1',
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        metadata: { decisionEvidence: snapshot() },
        candidates: [
          { snapshot: { optionId: 'path-option-1', decisionEvidence: { impacts: [{ source: 'profile', kind: 'resource-type', reasonCode: 'preferred-modality' }] } } },
          { snapshot: { optionId: 'path-option-baseline', decisionEvidence: { impacts: [] } } },
        ],
      }],
      competencySnapshots: [
        { userId: 'student-1', snapshotAt: '2026-08-29T00:00:00.000Z', competencyVector: { a: { score: 0.99 } } },
        { userId: 'student-1', snapshotAt: '2026-08-26T12:00:00.000Z', competencyVector: { a: { score: 0.7 } } },
        { userId: 'student-1', snapshotAt: '2026-08-20T00:00:00.000Z', competencyVector: { a: { score: 0.4 } } },
      ],
    });

    expect(classifyPersonalizedPathEffectCohort(records[0]!)).toBe('baseline');
    expect(records[0]?.competencyLift).toBeCloseTo(0.3);
  });
});

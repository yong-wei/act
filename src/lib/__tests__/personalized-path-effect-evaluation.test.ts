import { describe, expect, it } from 'vitest';

import type { PersonalizedPathDecisionEvidence } from '@/lib/adaptive-path-decision-evidence';
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
        pathPayload: { policyFamily: 'preference-matched' },
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        executions: [],
      }],
      batches: [{
        id: 'batch-1',
        userId: 'student-1',
        goalId: 'control-correction',
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        metadata: { decisionEvidence: snapshot() },
      }],
    });

    expect(records[0]?.decisionEvidence?.snapshot.version).toBe('personalized-path-decision-evidence.v1');
    expect(classifyPersonalizedPathEffectCohort(records[0]!)).toBe('personalized');
  });
});

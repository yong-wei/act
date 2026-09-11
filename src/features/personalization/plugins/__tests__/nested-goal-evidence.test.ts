import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { isLearningFactEligibleForPersonalization } from '@/lib/data-governance/learning-fact-quality-weight';
import {
  ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
  CONTROL_CORRECTION_GOAL_DIMENSIONS,
  reduceLearnerState,
  resolveAdaptiveGoalSliceDefinition,
} from '@/features/personalization/learner-state/public-api';
import type { LearnerStateReducerInput } from '@/features/personalization/learner-state/reducer';
import { readControlCorrectionLearningFacts } from '../control-correction/db-evidence';
import {
  buildExplicitControlCorrectionLearningFactWhere,
  CONTROL_CORRECTION_NESTED_LEARNING_GOAL_IDS_PATH,
  hasExplicitAdaptiveGoal,
  isControlCorrectionFact,
  isLegacyControlCorrectionFact,
} from '../control-correction/evidence-match';
import { CONTROL_CORRECTION_GOAL_ID } from '../control-correction/mappings';

const OTHER_GOAL_ID = 'other-learning-goal';
const USER_ID = 'student-1';

function eligibleGovernance(): Record<string, unknown> {
  return {
    evidenceQuality: 'rich',
    profileWeight: 1,
    skipProfileContribution: false,
    policyReason: 'adaptive_assessment_evidence',
  };
}

function nestedContext(
  learningGoalIds: string[] | undefined,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    evidenceGovernance: eligibleGovernance(),
    adaptiveAssessment: {
      kaqQuizEvidence: learningGoalIds ? { learningGoalIds } : {},
    },
    ...extra,
  };
}

function fact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'fact-nested',
    userId: USER_ID,
    factType: 'question',
    startedAt: '2026-06-19T06:00:00.000Z',
    contextJson: nestedContext([CONTROL_CORRECTION_GOAL_ID]),
    ...overrides,
  };
}

function readJsonPath(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function matchesPrismaWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  if (where.userId && row.userId !== where.userId) return false;
  const clauses = where.OR as Array<Record<string, unknown>> | undefined;
  if (!clauses) return true;
  return clauses.some((clause) => {
    for (const field of ['courseId', 'lessonId', 'moduleId'] as const) {
      const filter = clause[field] as { in?: string[] } | undefined;
      if (filter?.in) return filter.in.includes(String(row[field] ?? ''));
    }
    const json = clause.contextJson as {
      path?: string[];
      equals?: string;
      array_contains?: string[];
    } | undefined;
    if (!json?.path) return false;
    const value = readJsonPath(row.contextJson, json.path);
    if (json.equals !== undefined) return value === json.equals;
    return Array.isArray(value)
      && Array.isArray(json.array_contains)
      && json.array_contains.every((item) => value.includes(item));
  });
}

function attributedByMemory(facts: Array<Record<string, unknown>>): string[] {
  return facts.filter(isControlCorrectionFact).map((row) => String(row.id));
}

function attributedByQuery(facts: Array<Record<string, unknown>>): string[] {
  const explicitWhere = buildExplicitControlCorrectionLearningFactWhere(USER_ID);
  return facts.filter((row) => {
    const explicitHit = matchesPrismaWhere(row, explicitWhere);
    const legacyHit = !hasExplicitAdaptiveGoal(row) && isLegacyControlCorrectionFact(row);
    return (explicitHit || legacyHit) && isControlCorrectionFact(row);
  }).map((row) => String(row.id));
}

function emptyFeatureRead(): LearnerStateReducerInput['featureRead'] {
  return {
    state: 'missing',
    cache: null,
    rawReadExceptions: ['audit', 'debug', 'drilldown', 'migration'],
  };
}

function reducerInput(
  overrides: Partial<LearnerStateReducerInput> = {},
): LearnerStateReducerInput {
  const now = new Date('2026-06-19T06:00:00.000Z');
  return {
    userId: USER_ID,
    role: 'student',
    now,
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    featureFlagEnabled: true,
    requestedGoal: CONTROL_CORRECTION_GOAL_ID,
    requestedGoalDefinition: resolveAdaptiveGoalSliceDefinition(CONTROL_CORRECTION_GOAL_ID),
    goalPluginAvailable: true,
    featureRead: emptyFeatureRead(),
    featureCache: {},
    latestSnapshot: null,
    profileSummary: null,
    personalizationFacts: [],
    masteryFacts: [],
    masteryUpdates: [],
    latestAbility: null,
    riskFlags: [],
    paths: [],
    activeControlCorrectionPaths: [],
    controlCorrectionFacts: [],
    controlCorrectionArenaSubmissions: [],
    controlCorrectionAgentToolRuns: [],
    portraitResolution: {
      primaryPortrait: null,
      primaryPortraitState: 'UNAVAILABLE',
      primaryPortraitAvailability: 'cumulative-portrait-fence-unavailable',
      legacyCompatibility: {
        authority: 'legacy-compatibility-only',
        source: 'fallback-empty',
        vector: {
          controlModeling: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: now.toISOString() },
          parameterDesign: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: now.toISOString() },
          crossDomainTransfer: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: now.toISOString() },
          engineeringDecision: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: now.toISOString() },
          inquiryReflection: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: now.toISOString() },
          selfDirectedLearning: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: now.toISOString() },
        },
        snapshotId: null,
        snapshotAt: now.toISOString(),
      },
      limitations: ['cumulative-portrait-fence-unavailable'],
    },
    ...overrides,
  };
}

describe('nested formal-assessment goal evidence', () => {
  it('attributes nested control-correction goals and rejects top-level conflicts', () => {
    expect(isControlCorrectionFact(fact())).toBe(true);
    expect(isControlCorrectionFact(fact({
      contextJson: nestedContext([CONTROL_CORRECTION_GOAL_ID, OTHER_GOAL_ID]),
    }))).toBe(true);
    expect(isControlCorrectionFact(fact({
      contextJson: nestedContext([CONTROL_CORRECTION_GOAL_ID], { goalId: OTHER_GOAL_ID }),
    }))).toBe(false);
  });

  it('keeps database where and in-memory attribution on the same result set', () => {
    const where = buildExplicitControlCorrectionLearningFactWhere(USER_ID);
    expect(where.OR).toEqual(expect.arrayContaining([{
      contextJson: {
        path: [...CONTROL_CORRECTION_NESTED_LEARNING_GOAL_IDS_PATH],
        array_contains: [CONTROL_CORRECTION_GOAL_ID],
      },
    }]));

    const facts = [
      fact({ id: 'nested-cc' }),
      fact({
        id: 'nested-mixed',
        contextJson: nestedContext([CONTROL_CORRECTION_GOAL_ID, OTHER_GOAL_ID]),
      }),
      fact({
        id: 'conflict',
        contextJson: nestedContext([CONTROL_CORRECTION_GOAL_ID], { goalId: OTHER_GOAL_ID }),
      }),
      fact({
        id: 'nested-other',
        contextJson: nestedContext([OTHER_GOAL_ID]),
      }),
      fact({
        id: 'top-level-cc',
        contextJson: { evidenceGovernance: eligibleGovernance(), goalId: CONTROL_CORRECTION_GOAL_ID },
      }),
      fact({
        id: 'no-goal',
        contextJson: { evidenceGovernance: eligibleGovernance() },
      }),
      fact({
        id: 'legacy-course',
        courseId: '3-6',
        contextJson: { evidenceGovernance: eligibleGovernance() },
      }),
    ];

    expect(attributedByQuery(facts)).toEqual(attributedByMemory(facts));
    expect(attributedByMemory(facts)).toEqual(['nested-cc', 'nested-mixed', 'top-level-cc', 'legacy-course']);
  });

  it('admits eligible nested facts into learner-state dimensions and capability refs', async () => {
    const incoming = [
      fact({ id: 'assess-1', factType: 'question' }),
      fact({ id: 'sim-1', factType: 'simulation' }),
      fact({ id: 'arena-1', factType: 'arena' }),
      fact({ id: 'reflect-1', factType: 'reflection' }),
      fact({
        id: 'ai-1',
        factType: 'ai_intervention',
        contextJson: nestedContext([CONTROL_CORRECTION_GOAL_ID], { reviewerState: 'approved' }),
      }),
    ];
    const admitted = incoming.filter((row) =>
      isControlCorrectionFact(row)
      && isLearningFactEligibleForPersonalization(row.contextJson));
    expect(admitted).toHaveLength(5);

    const findMany = async ({ where }: { where: Record<string, unknown> }) => (
      incoming.filter((row) => matchesPrismaWhere(row, where))
    );
    const fromDb = await readControlCorrectionLearningFacts({
      learningFact: { findMany },
    }, USER_ID);
    expect(fromDb.map((row) => row.id)).toEqual(admitted.map((row) => row.id));

    const state = reduceLearnerState(reducerInput({
      controlCorrectionFacts: admitted,
    }));
    const slice = state.goalSlices?.controlCorrection;
    expect(slice?.dimensions).toHaveLength(CONTROL_CORRECTION_GOAL_DIMENSIONS.length);
    expect(slice?.dimensions.every((dimension) => dimension.evidenceCount > 0)).toBe(true);
    expect(slice?.capabilityTargets
      .filter((target) => target.target.observableEvidenceType !== 'arena-official-evaluation')
      .every((target) => (target.observedEvidence.supportingEvidenceRefs?.length ?? 0) > 0)).toBe(true);
  });

  it('keeps no-goal, unreviewed, incomplete-governance and mismatched-goal facts rejected', async () => {
    const rejected = [
      fact({
        id: 'no-goal',
        contextJson: { evidenceGovernance: eligibleGovernance() },
      }),
      fact({
        id: 'unreviewed',
        contextJson: nestedContext([CONTROL_CORRECTION_GOAL_ID], {
          evidenceGovernance: {
            evidenceQuality: 'partial',
            profileWeight: 0,
            skipProfileContribution: true,
            policyReason: 'adaptive_assessment_provisional_context_only',
          },
        }),
      }),
      fact({
        id: 'version-incomplete',
        contextJson: nestedContext([CONTROL_CORRECTION_GOAL_ID], {
          evidenceGovernance: {
            evidenceQuality: 'partial',
            skipProfileContribution: true,
            policyReason: 'adaptive_assessment_missing_kaq_context_only',
          },
        }),
      }),
      fact({
        id: 'goal-mismatch',
        contextJson: nestedContext([OTHER_GOAL_ID]),
      }),
    ];

    expect(isControlCorrectionFact(rejected[0]!)).toBe(false);
    expect(isLearningFactEligibleForPersonalization(rejected[1]!.contextJson)).toBe(false);
    expect(isLearningFactEligibleForPersonalization(rejected[2]!.contextJson)).toBe(false);
    expect(isControlCorrectionFact(rejected[3]!)).toBe(false);

    const fromDb = await readControlCorrectionLearningFacts({
      learningFact: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => (
          rejected.filter((row) => matchesPrismaWhere(row, where))
        ),
      },
    }, USER_ID);
    expect(fromDb).toEqual([]);
  });

  it('filters personalization eligibility after attribution in the plugin read path', () => {
    const source = readFileSync('src/features/personalization/plugins/control-correction/db-evidence.ts', 'utf8');
    expect(source).toMatch(/input\.filter\(fact\) && isLearningFactEligibleForPersonalization\(fact\.contextJson\)/);
  });
});

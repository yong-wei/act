import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { reduceLearnerState, type LearnerStateReducerInput } from '../reducer';
import {
  ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
  CONTROL_CORRECTION_GOAL_ID,
} from '../internal';
import { resolveAdaptiveGoalSliceDefinition } from '@/features/personalization/plugins/public-api';
import { createDbLearnerStateRuntime } from '../adapters/db-runtime';
import { readLearnerState } from '../application/read-learner-state';

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
    userId: 'student-1',
    role: 'student',
    now,
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    featureFlagEnabled: true,
    requestedGoal: null,
    requestedGoalDefinition: null,
    goalPluginAvailable: false,
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

describe('learner-state reducer', () => {
  it('returns the same projection for the same governed input', () => {
    const input = reducerInput({
      clientHints: { preferredModality: 'simulation' },
    });
    const first = reduceLearnerState(input);
    const second = reduceLearnerState(input);
    expect(second).toEqual(first);
    expect(first.clientHints).toEqual({
      received: true,
      authoritative: false,
      reason: 'client-hints-non-authoritative',
    });
    expect(first.knowledgeMastery.coverage).toBe('missing');
    expect(first.missingEvidence).toContain('AdaptiveMasteryUpdate');
  });

  it('does not treat client hints as mastery authority', () => {
    const withHints = reduceLearnerState(reducerInput({
      clientHints: { mastery: { 'tag-1': 0.99 } },
    }));
    expect(withHints.knowledgeMastery.tags).toEqual({});
    expect(withHints.clientHints.authoritative).toBe(false);
  });

  it('returns unsupported when a registered goal has no plugin context', () => {
    const state = reduceLearnerState(reducerInput({
      requestedGoal: CONTROL_CORRECTION_GOAL_ID,
      requestedGoalDefinition: resolveAdaptiveGoalSliceDefinition(CONTROL_CORRECTION_GOAL_ID),
      supportedGoalIds: [CONTROL_CORRECTION_GOAL_ID],
      goalPluginAvailable: false,
    }));
    expect(state.goalSlices?.unsupported).toEqual({
      goalId: CONTROL_CORRECTION_GOAL_ID,
      state: 'unsupported-goal',
      fallbackReason: 'goal-plugin-unavailable',
      supportedGoalIds: [CONTROL_CORRECTION_GOAL_ID],
    });
    expect(state.goalSlices?.controlCorrection).toBeUndefined();
  });

  it('reads mastery and ability only through the Assessment read port', async () => {
    const now = new Date('2026-06-19T06:00:00.000Z');
    const listMasteryUpdates = vi.fn(async () => [{
      id: 'mastery-1',
      knowledgeTag: 'tag-1',
      posteriorMastery: 0.7,
      confidence: 0.8,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      createdAt: now,
      answerId: 'answer-1',
    }]);
    const readLatestAbilityEstimate = vi.fn(async () => ({
      theta: 0.4,
      confidenceLow: -0.1,
      confidenceHigh: 0.9,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      estimatedAt: now,
    }));
    const runtime = createDbLearnerStateRuntime({}, {
      assessment: {
        listMasteryUpdates,
        readLatestAbilityEstimate,
      },
      controlCorrectionPlugin: null,
      isFeatureFlagEnabled: () => true,
    });

    const state = await readLearnerState(runtime, {
      userId: 'student-1',
      role: 'student',
      now,
    });

    expect(listMasteryUpdates).toHaveBeenCalledWith('student-1');
    expect(readLatestAbilityEstimate).toHaveBeenCalledWith('student-1');
    expect(state.knowledgeMastery.tags['tag-1']?.source).toBe('adaptive-assessment');
    expect(state.assessmentState.latestAbilityEstimate?.theta).toBe(0.4);
  });

  it('keeps learner-state available when a plugin evidence source is unreadable', async () => {
    const now = new Date('2026-06-19T06:00:00.000Z');
    const state = await readLearnerState(createDbLearnerStateRuntime({}, {
      isFeatureFlagEnabled: () => true,
      controlCorrectionPlugin: {
        readFacts: async () => [],
        readArenaSubmissions: async () => {
          throw new Error('arena-unavailable');
        },
        readAgentToolRuns: async () => [],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });

    expect(state.goalSlices?.controlCorrection).toBeDefined();
    expect(state.goalSlices?.unsupported).toBeUndefined();
    expect(state.goalSlices?.controlCorrection?.dimensions.every((dimension) => (
      dimension.confidence.level !== 'high'
    ))).toBe(true);
  });
});

describe('personalization learner-state boundary', () => {
  const productionCallers = [
    'src/app/api/adaptive/learner-state/route.ts',
    'src/app/api/ai/konling-context/route.ts',
    'src/app/ai/page.tsx',
    'src/lib/konling-agent-runtime.ts',
    'src/lib/evidence-copilot-context.ts',
    'src/features/personalization/recommendations/engine.ts',
    'src/lib/data-governance/graph-center-sources.ts',
    'src/lib/data-governance/control-correction-demo-package.ts',
  ];

  it('keeps the reducer module free of Prisma, Next and React', () => {
    const source = readFileSync('src/features/personalization/learner-state/reducer.ts', 'utf8');
    expect(source).not.toMatch(/from ['"]prisma['"]|from ['"]@prisma\/client['"]|from ['"]next(?:\/|['"])|from ['"]react(?:\/|['"])/);
  });

  it('keeps production callers on the personalization public API', () => {
    for (const file of productionCallers) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain("from '@/features/personalization/learner-state/public-api'");
      expect(source, file).not.toContain("from '@/lib/data-governance/adaptive-learner-state-service'");
      expect(source, file).not.toContain("from './adaptive-learner-state-service'");
      expect(source, file).not.toContain('CONTROL_CORRECTION_COURSE_ID_VALUES');
    }
  });

  it('keeps production callers off the db-injected mastery tables', () => {
    for (const file of productionCallers) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('readAdaptiveLearnerState(');
      expect(source, file).not.toContain('readPathPlannerLearnerState(');
    }
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
  citePersonalizationPlugin,
  createControlCorrectionPersonalizationPlugin,
  createIdempotentPluginWritePort,
  createPersonalizationPluginRegistry,
  getRegisteredPersonalizationGoalPlugin,
  isControlCorrectionFact,
  listRegisteredPersonalizationGoalIds,
  personalizationPluginRegistry,
  resolvePersonalizationGoalContext,
  resolvePersonalizationGoalId,
} from '../public-api';
import {
  ADAPTIVE_GOAL_SLICE_REGISTRY,
  reduceLearnerState,
  resolveAdaptiveGoalSliceDefinition,
} from '@/features/personalization/learner-state/public-api';
import type { LearnerStateReducerInput } from '@/features/personalization/learner-state/reducer';
import { ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION } from '@/features/personalization/learner-state/internal';

const GENERIC_PERSONALIZATION_FILES = [
  'src/features/personalization/learner-state/internal.ts',
  'src/features/personalization/learner-state/public-api.ts',
  'src/features/personalization/learner-state/adapters/db-runtime.ts',
  'src/features/personalization/learner-state/application/read-learner-state.ts',
  'src/features/personalization/path-planning/application/plan-learning-path.ts',
  'src/features/personalization/path-planning/ports.ts',
  'src/features/personalization/path-planning/contracts.ts',
  'src/lib/data-governance/recommendation-engine.ts',
];

const RETIRED_CONCRETE_IDS = [
  'unit-3-6-zero-design-workshop',
  'unit-3-6-zero-design-workshop-v1',
  'task-second-order-lead-pid',
  'CONTROL_CORRECTION_COURSE_ID_VALUES',
  'CONTROL_CORRECTION_ARENA_TASK_ID_VALUES',
];

const PLUGIN_SOURCE_FILES = [
  'src/features/personalization/plugins/registry.ts',
  'src/features/personalization/plugins/types.ts',
  'src/features/personalization/plugins/default-registry.ts',
  'src/features/personalization/plugins/public-api.ts',
  'src/features/personalization/plugins/adapters/write-port.ts',
  'src/features/personalization/plugins/control-correction/plugin.ts',
  'src/features/personalization/plugins/control-correction/mappings.ts',
  'src/features/personalization/plugins/control-correction/evidence-match.ts',
  'src/features/personalization/plugins/control-correction/db-evidence.ts',
  'src/features/personalization/plugins/control-correction/slice-contract.ts',
  'src/features/personalization/plugins/control-correction/capability-targets.ts',
];

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

describe('personalization plugin registry', () => {
  it('registers one control-correction plugin version and slice identity', () => {
    const plugin = getRegisteredPersonalizationGoalPlugin(CONTROL_CORRECTION_GOAL_ID);
    expect(plugin?.pluginId).toBe(CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID);
    expect(plugin?.version).toBe(CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION);
    expect(plugin?.sliceDefinition).toBe(ADAPTIVE_GOAL_SLICE_REGISTRY[CONTROL_CORRECTION_GOAL_ID]);
    expect(plugin?.sliceDefinition).toBe(resolveAdaptiveGoalSliceDefinition(CONTROL_CORRECTION_GOAL_ID));
    expect(listRegisteredPersonalizationGoalIds()).toEqual([CONTROL_CORRECTION_GOAL_ID]);
    expect(personalizationPluginRegistry.list()).toHaveLength(1);
  });

  it('rejects duplicate goalId and conflicting course mappings', () => {
    const registry = createPersonalizationPluginRegistry();
    const plugin = createControlCorrectionPersonalizationPlugin();
    registry.register(plugin);
    expect(() => registry.register(plugin)).toThrow(/duplicate-goal/);
    expect(() => registry.register({
      ...plugin,
      goalId: 'other-goal',
      pluginId: 'other-plugin',
    })).toThrow(/conflicting-course/);
  });

  it('resolves known course, lesson and Arena mappings with parity', () => {
    for (const courseId of CONTROL_CORRECTION_COURSE_ID_VALUES) {
      expect(resolvePersonalizationGoalContext({ courseId })).toMatchObject({
        status: 'resolved',
        context: {
          goalId: CONTROL_CORRECTION_GOAL_ID,
          pluginVersion: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
        },
      });
    }
    expect(resolvePersonalizationGoalContext({
      lessonId: 'unit-3-6-zero-design-workshop',
    }).status).toBe('resolved');
    expect(resolvePersonalizationGoalContext({
      taskId: CONTROL_CORRECTION_ARENA_TASK_ID_VALUES[0],
    })).toMatchObject({
      status: 'resolved',
      context: { goalId: CONTROL_CORRECTION_GOAL_ID, matchedBy: ['taskId'] },
    });
    expect(resolvePersonalizationGoalId('3-6', 'task-second-order-lead-pid')).toBe(
      CONTROL_CORRECTION_GOAL_ID,
    );
    expect(resolvePersonalizationGoalContext({
      courseId: CONTROL_CORRECTION_ARENA_TASK_ID_VALUES[0],
    })).toMatchObject({
      status: 'unsupported',
      reason: 'unknown-mapping',
    });
    expect(resolvePersonalizationGoalContext({
      taskId: CONTROL_CORRECTION_ARENA_TASK_ID_VALUES[0],
    }).status).toBe('resolved');
  });

  it('returns unsupported for unknown, conflicting, retired and version-drifted plugins', () => {
    expect(resolvePersonalizationGoalContext({ courseId: 'unknown-course' })).toEqual({
      status: 'unsupported',
      reason: 'unknown-mapping',
      goalId: null,
      limitation: 'unsupported-goal',
    });
    expect(resolvePersonalizationGoalContext({
      goalId: CONTROL_CORRECTION_GOAL_ID,
      courseId: 'unknown-course',
    })).toEqual({
      status: 'unsupported',
      reason: 'unknown-mapping',
      goalId: CONTROL_CORRECTION_GOAL_ID,
      limitation: 'unsupported-goal',
    });

    const registry = createPersonalizationPluginRegistry();
    registry.register(createControlCorrectionPersonalizationPlugin());
    registry.register({
      ...createControlCorrectionPersonalizationPlugin(),
      goalId: 'other-goal',
      pluginId: 'other-plugin',
      courseIds: ['other-course'],
      lessonIds: ['other-lesson'],
      arenaTaskIds: ['other-task'],
    });
    expect(registry.resolve({
      courseId: '3-6',
      taskId: 'other-task',
    })).toMatchObject({
      status: 'unsupported',
      reason: 'conflicting-mapping',
      limitation: 'unsupported-goal',
    });

    const retired = createPersonalizationPluginRegistry();
    retired.register(createControlCorrectionPersonalizationPlugin('retired'));
    expect(retired.resolve({ goalId: CONTROL_CORRECTION_GOAL_ID })).toMatchObject({
      status: 'unsupported',
      reason: 'plugin-retired',
    });

    expect(resolvePersonalizationGoalContext({
      goalId: CONTROL_CORRECTION_GOAL_ID,
      pluginVersion: 'control-correction-personalization-plugin.v0',
    })).toMatchObject({
      status: 'unsupported',
      reason: 'version-unavailable',
    });
  });

  it('keeps plugin persistence on an idempotent write port without Prisma', async () => {
    const store = new Map();
    const port = createIdempotentPluginWritePort(store);
    const request = {
      pluginId: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
      pluginVersion: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
      subjectUserId: 'student-1',
      idempotencyKey: 'decision-1',
      evidenceRevision: 'rev-1',
      sourceCoverage: 'partial',
      confidence: 0.4,
      privacyClass: 'student-visible',
      evidenceRefs: ['fact:1'],
    };
    const first = await port.persist(request);
    const second = await port.persist(request);
    expect(first.accepted).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ ...first, duplicate: true });
    expect(second.identity).toBe(first.identity);

    for (const file of PLUGIN_SOURCE_FILES) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/from ['"]@?prisma(?:\/client)?['"]|from ['"]@\/lib\/prisma['"]/);
    }
  });

  it('does not treat course mapping as mastery or official Arena success', () => {
    expect(isControlCorrectionFact({
      courseId: '3-6',
      contextJson: {},
    })).toBe(true);

    const state = reduceLearnerState(reducerInput({
      requestedGoal: CONTROL_CORRECTION_GOAL_ID,
      requestedGoalDefinition: resolveAdaptiveGoalSliceDefinition(CONTROL_CORRECTION_GOAL_ID),
      goalPluginAvailable: true,
      clientHints: {
        courseId: '3-6',
        lessonId: 'unit-3-6-zero-design-workshop',
        taskId: 'task-second-order-lead-pid',
        mastery: { 'tag-1': 0.99 },
      },
    }));

    expect(state.knowledgeMastery.tags).toEqual({});
    expect(state.knowledgeMastery.coverage).toBe('missing');
    expect(state.goalSlices?.controlCorrection?.dimensions.every((dimension) => (
      dimension.confidence.level !== 'high'
      && dimension.fallbackMarkers.length > 0
    ))).toBe(true);
    expect(state.goalSlices?.controlCorrection?.pathContext.noActivePath).toBe(true);
    expect(citePersonalizationPlugin(CONTROL_CORRECTION_GOAL_ID)).toEqual({
      pluginId: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
      pluginVersion: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
      goalId: CONTROL_CORRECTION_GOAL_ID,
      sourceCategory: 'learning-record',
      privacySafe: true,
    });
  });

  it('keeps generic Personalization modules free of control-correction course and Arena IDs', () => {
    for (const file of GENERIC_PERSONALIZATION_FILES) {
      const source = readFileSync(file, 'utf8');
      for (const token of RETIRED_CONCRETE_IDS) {
        expect(source, `${file} contains ${token}`).not.toContain(token);
      }
      expect(source, file).not.toMatch(/['"]3-6['"]/);
    }
    expect(readFileSync('src/features/personalization/learner-state/internal.ts', 'utf8'))
      .not.toContain('ADAPTIVE_GOAL_SLICE_REGISTRY');
    expect(readFileSync('src/features/personalization/plugins/control-correction/slice-contract.ts', 'utf8'))
      .toContain('controlCorrectionGoalSliceDefinition');
  });

  it('moves Konling course alias resolution onto the plugin public contract', () => {
    for (const file of [
      'src/lib/konling-agent-runtime.ts',
      'src/lib/konling-kaq-graph-context.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain("from '@/features/personalization/plugins/public-api'");
      expect(source, file).not.toContain('CONTROL_CORRECTION_COURSE_ID_VALUES');
      expect(source, file).not.toContain('CONTROL_CORRECTION_ARENA_TASK_ID_VALUES');
    }
  });
});

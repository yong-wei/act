import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdaptiveLearnerState } from '@/features/personalization/learner-state/public-api';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import { PORTRAIT_V2_DIMENSION_IDS } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  createPortraitV2Payload,
  PORTRAIT_V2_CALCULATION_VERSION,
  projectPortraitV2ForConsumer,
} from '@/lib/data-governance/portrait-v2-model';
import {
  buildGovernedCopilotProfilePrompt,
  projectGovernedCopilotProfile,
  resolveCopilotPromptUser,
  resolveGovernedCopilotProfile,
} from '@/lib/governed-copilot-profile-context';
import type { PageContext, UserProfile } from '@/types/ai-context';

const mocks = vi.hoisted(() => ({
  isAdaptiveLearnerStateServiceEnabled: vi.fn(() => true),
  readLearnerState: vi.fn(),
}));

vi.mock('@/features/personalization/learner-state/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/personalization/learner-state/public-api')>(
    '@/features/personalization/learner-state/public-api',
  );
  return {
    ...actual,
    isAdaptiveLearnerStateServiceEnabled: mocks.isAdaptiveLearnerStateServiceEnabled,
    readLearnerState: mocks.readLearnerState,
  };
});

const now = '2026-08-29T00:00:00.000Z';

function learnerState(overrides: Partial<AdaptiveLearnerState> = {}): AdaptiveLearnerState {
  return {
    userId: 'student-1',
    payloadVersion: 'adaptive-learner-state.v1',
    generatedAt: now,
    authority: 'server-owned',
    roleScope: { role: 'student', classId: null, privacyScopes: ['student-visible'] },
    featureFlag: { name: 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED', enabled: true, fallback: 'legacy' },
    clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
    primaryPortrait: null,
    primaryPortraitState: 'NO_EVIDENCE',
    primaryPortraitAvailability: 'unavailable',
    primaryCompetencies: {
      authority: 'legacy-compatibility-only',
      source: 'fallback-empty',
      vector: {} as AdaptiveLearnerState['primaryCompetencies']['vector'],
    },
    secondaryDimensions: {},
    knowledgeMastery: { coverage: 'available', tags: {} },
    resourcePreference: { preferredModalities: [], sourceCounts: {}, confidence: 'none' },
    mediaAbsorption: { mediaFactCount: 0, averageCompletion: null, confidence: 'none' },
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
      statusMarkers: ['missing'],
    },
    risks: { riskLevel: 'low', activeFlags: [] },
    assessmentState: { latestAbilityEstimate: null },
    evidence: {
      readState: 'ready',
      evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 },
      sourceCounts: {},
      sourceCoverage: { LearningFact: 'available' },
      confidence: { level: 'medium', score: 0.7, evidenceCount: 4, sourceCompleteness: 0.7 },
      statusMarkers: [],
    },
    prerequisiteFeatureGroups: { simulationArena: null, pathExecution: null },
    fieldContracts: {} as AdaptiveLearnerState['fieldContracts'],
    missingEvidence: [],
    ...overrides,
  } as AdaptiveLearnerState;
}

function trustedPortraitState(): AdaptiveLearnerState {
  const portrait = projectPortraitV2ForConsumer(createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: now,
    now,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => ({
      id,
      score: 90,
      confidence: 0.8,
      trend: 'stable' as const,
      freshness: { state: 'current' as const, asOf: now, evidenceAgeDays: 0 },
      evidenceSummary: { totalCount: 1, sourceFamilyCounts: { LearningFact: 1 } },
      lastPositiveEvidenceAt: now,
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [{
        kind: 'evidence-family' as const,
        ref: 'LearningFact',
        privacyScope: 'student-visible' as const,
      }],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
    derivation: { kind: 'native', limitations: [] },
  }), 'konling');
  return learnerState({
    primaryPortraitState: 'SNAPSHOT',
    primaryPortraitAvailability: 'available',
    primaryPortrait: portrait,
    primaryCompetencies: {
      authority: 'legacy-compatibility-only',
      source: 'portrait-v2-derived',
      vector: {
        controlModeling: { score: 88, confidence: 0.8, evidenceCount: 4, lastUpdated: now },
        parameterDesign: { score: 72, confidence: 0.8, evidenceCount: 4, lastUpdated: now },
        crossDomainTransfer: { score: 70, confidence: 0.8, evidenceCount: 4, lastUpdated: now },
        engineeringDecision: { score: 68, confidence: 0.8, evidenceCount: 4, lastUpdated: now },
        inquiryReflection: { score: 66, confidence: 0.8, evidenceCount: 4, lastUpdated: now },
        selfDirectedLearning: { score: 64, confidence: 0.8, evidenceCount: 4, lastUpdated: now },
      } as AdaptiveLearnerState['primaryCompetencies']['vector'],
    },
  });
}

const page: PageContext = {
  courseId: 'general',
  courseTitle: '自动控制原理',
  pageType: 'workspace',
  stepId: 'default',
  topic: 'PID',
  learningObjectives: ['理解反馈'],
  knowledgeType: 'C',
};

describe('governed copilot profile context', () => {
  beforeEach(() => {
    mocks.isAdaptiveLearnerStateServiceEnabled.mockReturnValue(true);
    mocks.readLearnerState.mockReset();
  });

  it('ignores forged client identity, style, level, and ability values', () => {
    const governed = projectGovernedCopilotProfile(trustedPortraitState(), {
      authenticatedUserId: 'student-1',
      displayName: '张三',
    });
    const forged: UserProfile = {
      id: 'other-student',
      name: '伪造姓名',
      learningStyle: 'LOGICAL',
      cognitiveLevel: 5,
      abilityVector: {
        computational: 1,
        crossDomain: 1,
        design: 1,
        analysis: 1,
        evaluation: 1,
      },
    };
    const user = resolveCopilotPromptUser({
      authenticatedUserId: 'student-1',
      authenticatedDisplayName: '张三',
      clientUserProfile: forged,
      governedProfile: governed,
    });
    const prompt = `${buildKonlingSystemPrompt({ page, user })}\n${buildGovernedCopilotProfilePrompt(governed)}`;
    expect(user.id).toBe('student-1');
    expect(prompt).toContain('张三');
    expect(prompt).not.toContain('other-student');
    expect(prompt).not.toContain('伪造姓名');
    expect(prompt).not.toContain('逻辑型');
    expect(prompt).not.toContain('LOGICAL');
  });

  it('resolves a missing profile without a client default payload', async () => {
    mocks.readLearnerState.mockResolvedValueOnce(learnerState());
    const projection = await resolveGovernedCopilotProfile({
      userId: 'student-1',
      role: 'student',
      displayName: '张三',
    });
    const prompt = buildKonlingSystemPrompt({
      page,
      user: resolveCopilotPromptUser({
        authenticatedUserId: 'student-1',
        authenticatedDisplayName: '张三',
        governedProfile: projection,
      }),
    });
    expect(projection.status).toBe('missing');
    expect(prompt).toContain('个性化状态: 缺失');
    expect(prompt).not.toContain('视觉型');
    expect(prompt).not.toContain('综合能力均衡发展');
    expect(prompt).not.toContain('L3');
  });

  it('does not turn unknown values into personal zeroes or default abilities', () => {
    const missing = projectGovernedCopilotProfile(learnerState(), {
      authenticatedUserId: 'student-1',
      displayName: '张三',
    });
    const unavailable = projectGovernedCopilotProfile(null, {
      authenticatedUserId: 'student-1',
      displayName: '张三',
      unavailable: true,
    });
    const staleState = trustedPortraitState();
    staleState.primaryPortrait = {
      ...staleState.primaryPortrait!,
      dimensions: staleState.primaryPortrait!.dimensions.map((dimension, index) => (
        index === 0
          ? { ...dimension, freshness: { state: 'stale' as const, asOf: now, evidenceAgeDays: 40 } }
          : dimension
      )),
    };
    const staleProjection = projectGovernedCopilotProfile(staleState, {
      authenticatedUserId: 'student-1',
      displayName: '张三',
    });
    expect(missing.status).toBe('missing');
    expect(missing.abilityVector).toBeUndefined();
    expect(missing.cognitiveLevel).toBeUndefined();
    expect(unavailable.status).toBe('unavailable');
    expect(staleProjection.status).toBe('stale');
    expect(staleProjection.abilityVector).toBeUndefined();

    const lowConfidenceState = trustedPortraitState();
    lowConfidenceState.primaryPortrait = {
      ...lowConfidenceState.primaryPortrait!,
      dimensions: lowConfidenceState.primaryPortrait!.dimensions.map((dimension) => ({
        ...dimension,
        evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
      })),
    };
    const lowConfidence = projectGovernedCopilotProfile(lowConfidenceState, {
      authenticatedUserId: 'student-1',
      displayName: '张三',
    });
    expect(lowConfidence.status).toBe('low-confidence');
    expect(lowConfidence.abilityVector).toBeUndefined();
    expect(lowConfidence.cognitiveLevel).toBeUndefined();
    expect(JSON.stringify(missing)).not.toContain('0.5');
    expect(JSON.stringify(unavailable)).not.toContain('0.5');
    expect(JSON.stringify(lowConfidence)).not.toContain('0.5');
  });

  it('injects a trusted portrait and keeps course help when profile is missing', () => {
    const available = projectGovernedCopilotProfile(trustedPortraitState(), {
      authenticatedUserId: 'student-1',
      displayName: '张三',
    });
    expect(available.status).toBe('available');
    expect(available.cognitiveLevel).toBe(5);
    expect(available.abilityVector?.computational).toBeCloseTo(0.88);
    const availablePrompt = buildKonlingSystemPrompt({
      page,
      user: resolveCopilotPromptUser({
        authenticatedUserId: 'student-1',
        authenticatedDisplayName: '张三',
        governedProfile: available,
      }),
    });
    expect(availablePrompt).toContain('主画像模型');
    expect(availablePrompt).toContain('自动控制原理');

    const missingPrompt = buildKonlingSystemPrompt({
      page,
      user: resolveCopilotPromptUser({
        authenticatedUserId: 'student-1',
        authenticatedDisplayName: '张三',
        governedProfile: projectGovernedCopilotProfile(learnerState(), {
          authenticatedUserId: 'student-1',
          displayName: '张三',
        }),
      }),
    });
    expect(missingPrompt).toContain('通用辅导');
    expect(missingPrompt).toContain('自动控制原理');
  });
});

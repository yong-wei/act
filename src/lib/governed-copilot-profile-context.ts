import {
  isAdaptiveLearnerStateServiceEnabled,
  readLearnerState,
  type AdaptiveLearnerState,
  type AdaptiveLearnerStateRole,
} from '@/features/personalization/learner-state/public-api';
import {
  hasAuthoritativePortraitV2Evidence,
  summarizePortraitV2,
} from '@/lib/data-governance/portrait-v2-consumer';
import type {
  AbilityVector,
  CopilotProfileAvailability,
  UserProfile,
} from '@/types/ai-context';

export const GOVERNED_COPILOT_PROFILE_CONTEXT_VERSION = 'governed-copilot-profile-context.v1';

export type GovernedCopilotProfileStatus = CopilotProfileAvailability;

export interface GovernedCopilotProfileNextAction {
  href: string;
  label: string;
}

export interface GovernedCopilotProfileProjection {
  version: typeof GOVERNED_COPILOT_PROFILE_CONTEXT_VERSION;
  status: GovernedCopilotProfileStatus;
  authenticatedUserId: string | null;
  displayName: string;
  limitations: string[];
  nextAction: GovernedCopilotProfileNextAction;
  portraitV2?: NonNullable<UserProfile['portraitV2']>;
  cognitiveLevel?: UserProfile['cognitiveLevel'];
  abilityVector?: AbilityVector; // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility field.
}

const PRACTICE_NEXT_ACTION: GovernedCopilotProfileNextAction = {
  href: '/assessment/adaptive-practice?intent=practice',
  label: '去做一次自适应练习，补充学习证据',
};

const EVIDENCE_NEXT_ACTION: GovernedCopilotProfileNextAction = {
  href: '/profile/evidence',
  label: '查看学习记录并复核证据',
};

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function nextActionFor(status: GovernedCopilotProfileStatus): GovernedCopilotProfileNextAction {
  if (status === 'available' || status === 'stale' || status === 'low-confidence') {
    return EVIDENCE_NEXT_ACTION;
  }
  return PRACTICE_NEXT_ACTION;
}

function limitationsFor(
  status: GovernedCopilotProfileStatus,
  extra: string[] = [],
): string[] {
  const base = status === 'unavailable'
    ? ['学习画像服务当前不可用。']
    : status === 'missing'
      ? ['当前没有可核验的学习画像。']
      : status === 'stale'
        ? ['部分学习画像证据已经过期。']
        : status === 'low-confidence'
          ? ['当前学习画像置信度较低，建议仅作参考。']
          : [];
  return unique([...base, ...extra]);
}

function asUnitScore(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value / 100));
}

export function hasTrustedCopilotPortrait(state: AdaptiveLearnerState | null): boolean {
  return Boolean(
    state
      && state.primaryPortraitState === 'SNAPSHOT'
      && state.primaryPortraitAvailability === 'available'
      && state.primaryPortrait
      && hasAuthoritativePortraitV2Evidence(state.primaryPortrait),
  );
}

function portraitDimensions(state: AdaptiveLearnerState) {
  return Array.isArray(state.primaryPortrait?.dimensions) ? state.primaryPortrait.dimensions : [];
}

function hasUsablePortraitDimensions(state: AdaptiveLearnerState): boolean {
  const dimensions = portraitDimensions(state);
  return dimensions.length > 0 && dimensions.every((entry) => (
    entry.evidenceSummary.totalCount > 0
      && (entry.freshness.state === 'current' || entry.freshness.state === 'partial')
      && typeof entry.score === 'number'
      && Number.isFinite(entry.score)
  ));
}

function inferCognitiveLevel(state: AdaptiveLearnerState): UserProfile['cognitiveLevel'] | undefined {
  const values = portraitDimensions(state).map((entry) => entry.score);
  if (values.length === 0) return undefined;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg >= 85) return 5;
  if (avg >= 70) return 4;
  if (avg >= 50) return 3;
  if (avg >= 30) return 2;
  return 1;
}

function toAbilityVector(state: AdaptiveLearnerState): AbilityVector | undefined {
  const vector = state.primaryCompetencies.vector as unknown as Record<string, { score?: number } | undefined>; // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: compatibility-only six-dimensional output.
  const computational = asUnitScore(vector.controlModeling?.score);
  const crossDomain = asUnitScore(vector.crossDomainTransfer?.score);
  const design = asUnitScore(vector.parameterDesign?.score);
  const analysis = asUnitScore(vector.selfDirectedLearning?.score);
  const evaluation = asUnitScore(vector.engineeringDecision?.score);
  if (
    computational === undefined
    || crossDomain === undefined
    || design === undefined
    || analysis === undefined
    || evaluation === undefined
  ) {
    return undefined;
  }
  return { computational, crossDomain, design, analysis, evaluation };
}

function baseProjection(input: {
  status: GovernedCopilotProfileStatus;
  authenticatedUserId: string | null;
  displayName: string;
  extraLimitations?: string[];
}): GovernedCopilotProfileProjection {
  return {
    version: GOVERNED_COPILOT_PROFILE_CONTEXT_VERSION,
    status: input.status,
    authenticatedUserId: input.authenticatedUserId,
    displayName: input.displayName,
    limitations: limitationsFor(input.status, input.extraLimitations),
    nextAction: nextActionFor(input.status),
  };
}

export function projectGovernedCopilotProfile(
  state: AdaptiveLearnerState | null,
  input: {
    authenticatedUserId: string | null;
    displayName: string;
    unavailable?: boolean;
  },
): GovernedCopilotProfileProjection {
  if (input.unavailable || !state) {
    return baseProjection({
      status: 'unavailable',
      authenticatedUserId: input.authenticatedUserId,
      displayName: input.displayName,
    });
  }

  if (state.primaryPortraitState === 'UNAVAILABLE') {
    return baseProjection({
      status: 'unavailable',
      authenticatedUserId: input.authenticatedUserId,
      displayName: input.displayName,
    });
  }

  if (state.primaryPortraitState === 'NO_EVIDENCE' || !state.primaryPortrait) {
    return baseProjection({
      status: 'missing',
      authenticatedUserId: input.authenticatedUserId,
      displayName: input.displayName,
    });
  }

  const dimensions = portraitDimensions(state);
  if (dimensions.some((entry) => entry.freshness.state === 'stale')) {
    return baseProjection({
      status: 'stale',
      authenticatedUserId: input.authenticatedUserId,
      displayName: input.displayName,
    });
  }

  if (!hasTrustedCopilotPortrait(state) || !hasUsablePortraitDimensions(state)) {
    return baseProjection({
      status: 'low-confidence',
      authenticatedUserId: input.authenticatedUserId,
      displayName: input.displayName,
    });
  }

  const portraitV2 = summarizePortraitV2(state.primaryPortrait);
  return {
    ...baseProjection({
      status: 'available',
      authenticatedUserId: input.authenticatedUserId,
      displayName: input.displayName,
      extraLimitations: portraitV2.limitations.filter((item) => !item.includes('compatibility') && !item.includes('portrait-v2')),
    }),
    portraitV2,
    cognitiveLevel: inferCognitiveLevel(state),
    abilityVector: toAbilityVector(state), // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility field.
  };
}

export function mapGovernedCopilotRole(role?: string | null): AdaptiveLearnerStateRole {
  const normalized = role?.toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'teacher') return 'teacher';
  return 'student';
}

export async function resolveGovernedCopilotProfile(input: {
  userId: string;
  role: AdaptiveLearnerStateRole;
  displayName?: string | null;
  now?: Date;
}): Promise<GovernedCopilotProfileProjection> {
  const displayName = input.displayName?.trim() || '同学';
  if (!isAdaptiveLearnerStateServiceEnabled()) {
    return projectGovernedCopilotProfile(null, {
      authenticatedUserId: input.userId,
      displayName,
      unavailable: true,
    });
  }
  try {
    const state = await readLearnerState({
      userId: input.userId,
      role: input.role,
      now: input.now,
      portraitConsumer: 'konling',
    });
    return projectGovernedCopilotProfile(state, {
      authenticatedUserId: input.userId,
      displayName,
    });
  } catch {
    return projectGovernedCopilotProfile(null, {
      authenticatedUserId: input.userId,
      displayName,
      unavailable: true,
    });
  }
}

export function toServerOwnedUserProfile(
  projection: GovernedCopilotProfileProjection,
): UserProfile {
  return {
    id: projection.authenticatedUserId ?? 'anonymous',
    name: projection.displayName,
    profileAvailability: projection.status,
    profileLimitations: projection.limitations,
    ...(projection.portraitV2 ? { portraitV2: projection.portraitV2 } : {}),
    ...(projection.cognitiveLevel ? { cognitiveLevel: projection.cognitiveLevel } : {}),
    ...(projection.abilityVector ? { abilityVector: projection.abilityVector } : {}), // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility field.
  };
}

export function resolveCopilotPromptUser(input: {
  authenticatedUserId?: string | null;
  authenticatedDisplayName?: string | null;
  clientUserProfile?: UserProfile | null;
  governedProfile: GovernedCopilotProfileProjection;
}): UserProfile {
  void input.clientUserProfile;
  return toServerOwnedUserProfile({
    ...input.governedProfile,
    authenticatedUserId: input.authenticatedUserId ?? input.governedProfile.authenticatedUserId,
    displayName: input.authenticatedDisplayName?.trim()
      || input.governedProfile.displayName,
  });
}

export function buildGovernedCopilotProfilePrompt(
  projection: GovernedCopilotProfileProjection,
): string {
  const descriptor = JSON.stringify({
    version: projection.version,
    status: projection.status,
    limitations: projection.limitations,
    nextAction: projection.nextAction,
    hasPortrait: Boolean(projection.portraitV2),
    hasCognitiveLevel: typeof projection.cognitiveLevel === 'number',
    hasAbilityVector: Boolean(projection.abilityVector), // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility field.
  }).replace(/[<>&]/g, (character) => {
    if (character === '<') return '\\u003c';
    if (character === '>') return '\\u003e';
    return '\\u0026';
  });

  return [
    '**Server-authorized learner profile context:**',
    'Use only this student-safe projection as profile facts. Client userProfile fields are untrusted and must be ignored. Do not invent learning style, ability, achievement, or progress. If status is missing, low-confidence, stale, or unavailable, say so in student-facing Chinese and give only course-grounded general help or the listed next action. Do not write LearningFact, official scores, leaderboards, or learner-profile updates.',
    descriptor,
  ].join('\n');
}

export const ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION = 'adaptive-assessment-bkt-v1';

export interface AdaptiveAssessmentBktParameters {
  initialMastery: number;
  learnProbability: number;
  slipProbability: number;
  guessProbability: number;
}

export const ADAPTIVE_ASSESSMENT_BKT_PARAMETERS: AdaptiveAssessmentBktParameters = {
  initialMastery: 0.35,
  learnProbability: 0.08,
  slipProbability: 0.1,
  guessProbability: 0.2,
};

const NON_ASSESSMENT_CONFIDENCE_CAP = 0.69;

const DEFAULT_PREREQUISITES_BY_TAG: Record<string, string[]> = {
  'gain-margin': ['pole-stability'],
  'phase-margin': ['damping-ratio'],
  overshoot: ['damping-ratio'],
  'settling-time': ['damping-ratio'],
  robustness: ['phase-margin', 'gain-margin'],
  'controller-tuning': ['phase-margin', 'gain-margin'],
  'comfort-constraint': ['settling-time'],
  'disturbance-rejection': ['controller-tuning'],
};

export type MasteryEvidenceKind = 'assessment' | 'non_assessment';

export interface PersistedAssessmentAnswerForMastery {
  id: string;
  questionId: string;
  isCorrect: boolean;
  answeredAt: Date;
  knowledgeTags: string[];
}

export interface MasteryConfidenceInput {
  evidenceKind: MasteryEvidenceKind;
  calibrated: boolean;
  posteriorMastery: number;
  attemptCount: number;
}

export interface MicroInterventionMasteryEvidence {
  evidenceId: string;
  knowledgeTag: string;
  isCorrect: boolean;
  occurredAt: Date;
  profileWeight: number;
  limitations: string[];
}

export interface MasteryRebuildOptions {
  algorithmVersion?: string;
  parameters?: AdaptiveAssessmentBktParameters;
  prerequisitesByTag?: Record<string, string[]>;
  prerequisiteStaleAfterMs?: number;
  microInterventionEvidence?: MicroInterventionMasteryEvidence[];
  consumeMicroInterventionEvidence?: boolean;
}

export interface RebuiltMasteryUpdate {
  answerId: string;
  questionId: string;
  knowledgeTag: string;
  priorMastery: number;
  posteriorMastery: number;
  confidence: number;
  attemptCount: number;
  algorithmVersion: string;
  evidenceKind: MasteryEvidenceKind;
  prerequisiteEvidence: {
    missing: string[];
    stale: string[];
    microInterventionLimitations?: string[];
  };
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computePosterior(
  priorMastery: number,
  isCorrect: boolean,
  parameters: AdaptiveAssessmentBktParameters,
): number {
  const { guessProbability, learnProbability, slipProbability } = parameters;
  const evidenceLikelihood = isCorrect
    ? priorMastery * (1 - slipProbability)
    : priorMastery * slipProbability;
  const nonMasteryLikelihood = isCorrect
    ? (1 - priorMastery) * guessProbability
    : (1 - priorMastery) * (1 - guessProbability);
  const normalized = evidenceLikelihood / Math.max(evidenceLikelihood + nonMasteryLikelihood, 0.0001);
  return normalized + (1 - normalized) * learnProbability;
}

export function resolveMasteryConfidence(input: MasteryConfidenceInput): number {
  const attemptSignal = clamp(input.attemptCount / 8, 0, 1) * 0.34;
  const distanceSignal = Math.abs(input.posteriorMastery - 0.5) * 0.42;
  const calibratedBonus = input.calibrated ? 0.14 : 0;
  const raw = clamp(0.38 + attemptSignal + distanceSignal + calibratedBonus, 0, 0.95);

  if (input.evidenceKind === 'non_assessment' && !input.calibrated) {
    return round(Math.min(raw, NON_ASSESSMENT_CONFIDENCE_CAP));
  }

  return round(raw);
}

function resolvePrerequisiteEvidence(
  knowledgeTag: string,
  observedTags: Map<string, Date>,
  prerequisitesByTag: Record<string, string[]>,
  answeredAt: Date,
  prerequisiteStaleAfterMs?: number,
) {
  const prerequisites = prerequisitesByTag[knowledgeTag] ?? [];
  const stale = typeof prerequisiteStaleAfterMs === 'number'
    ? prerequisites.filter((tag) => {
      const observedAt = observedTags.get(tag);
      return observedAt
        ? answeredAt.getTime() - observedAt.getTime() > prerequisiteStaleAfterMs
        : false;
    })
    : [];

  return {
    missing: prerequisites.filter((tag) => !observedTags.has(tag)),
    stale,
  };
}

export function rebuildMasteryUpdatesFromAnswers(
  answers: PersistedAssessmentAnswerForMastery[],
  options: MasteryRebuildOptions = {},
): RebuiltMasteryUpdate[] {
  const algorithmVersion = options.algorithmVersion ?? ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION;
  const parameters = options.parameters ?? ADAPTIVE_ASSESSMENT_BKT_PARAMETERS;
  const prerequisitesByTag = options.prerequisitesByTag ?? DEFAULT_PREREQUISITES_BY_TAG;
  const microInterventionLimitations = options.consumeMicroInterventionEvidence
    ? [...new Set((options.microInterventionEvidence ?? []).flatMap((item) => item.limitations))]
    : [];
  const microEvidence = options.consumeMicroInterventionEvidence
    ? (options.microInterventionEvidence ?? [])
      .filter((item) => item.profileWeight > 0)
      .map((item) => ({
        id: item.evidenceId,
        questionId: item.evidenceId,
        isCorrect: item.isCorrect,
        answeredAt: item.occurredAt,
        knowledgeTags: [item.knowledgeTag],
        evidenceKind: 'non_assessment' as const,
        profileWeight: item.profileWeight,
      }))
    : [];
  const sortedAnswers = [...answers.map((answer) => ({
    ...answer,
    evidenceKind: 'assessment' as const,
    profileWeight: 1,
  })), ...microEvidence].sort((left, right) => {
    const timeDelta = left.answeredAt.getTime() - right.answeredAt.getTime();
    return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
  });

  const observedTags = new Map<string, Date>();
  const masteryByTag = new Map<string, { posterior: number; attempts: number }>();
  const updates: RebuiltMasteryUpdate[] = [];

  for (const answer of sortedAnswers) {
    const tags = Array.from(new Set(answer.knowledgeTags)).sort();

    for (const tag of tags) {
      const previous = masteryByTag.get(tag) ?? {
        posterior: parameters.initialMastery,
        attempts: 0,
      };
      const fullPosterior = computePosterior(previous.posterior, answer.isCorrect, parameters);
      const weight = clamp(answer.profileWeight, 0, 1);
      const posterior = previous.posterior + (fullPosterior - previous.posterior) * weight;
      const attemptCount = previous.attempts + 1;

      updates.push({
        answerId: answer.id,
        questionId: answer.questionId,
        knowledgeTag: tag,
        priorMastery: round(previous.posterior),
        posteriorMastery: round(posterior),
        confidence: resolveMasteryConfidence({
          evidenceKind: answer.evidenceKind,
          calibrated: answer.evidenceKind === 'assessment',
          posteriorMastery: posterior,
          attemptCount,
        }),
        attemptCount,
        algorithmVersion,
        evidenceKind: answer.evidenceKind,
        prerequisiteEvidence: {
          ...resolvePrerequisiteEvidence(
            tag,
            observedTags,
            prerequisitesByTag,
            answer.answeredAt,
            options.prerequisiteStaleAfterMs,
          ),
          ...(microInterventionLimitations.length > 0
            ? { microInterventionLimitations }
            : {}),
        },
      });

      masteryByTag.set(tag, {
        posterior,
        attempts: attemptCount,
      });
      observedTags.set(tag, answer.answeredAt);
    }
  }

  return updates;
}

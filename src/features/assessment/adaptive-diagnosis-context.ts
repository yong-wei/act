import {
  readAdaptiveAttemptContext,
  type AdaptiveAttemptContext,
  type AdaptiveAttemptContextDb,
} from './adaptive-attempt-context';
import {
  attributeWrongAnswerEvidence,
  type WrongAnswerAttributionDb,
  type WrongAnswerAttributionProjection,
} from './wrong-answer-attribution';

export interface AdaptiveDiagnosisContext {
  adaptiveAttempt: AdaptiveAttemptContext;
  wrongAnswerAttribution: WrongAnswerAttributionProjection | null;
}

export interface AdaptiveDiagnosisContextDb {
  adaptiveAssessmentAnswer: any;
  wrongAnswerAttribution?: any;
}

export async function resolveAdaptiveDiagnosisContext(input: {
  db: AdaptiveDiagnosisContextDb;
  authenticatedUserId: string;
  answerId: string;
}): Promise<AdaptiveDiagnosisContext | null> {
  const adaptiveAttempt = await readAdaptiveAttemptContext({
    db: input.db as AdaptiveAttemptContextDb,
    authenticatedUserId: input.authenticatedUserId,
    answerId: input.answerId,
  });
  if (!adaptiveAttempt) return null;

  const wrongAnswerAttribution = input.db.wrongAnswerAttribution
    ? await attributeWrongAnswerEvidence({
      db: input.db as WrongAnswerAttributionDb,
      authenticatedUserId: input.authenticatedUserId,
      answerId: input.answerId,
    })
    : null;

  return {
    adaptiveAttempt,
    wrongAnswerAttribution,
  };
}

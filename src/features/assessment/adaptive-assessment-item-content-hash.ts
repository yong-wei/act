import { createHash } from 'node:crypto';

export interface AdaptiveAssessmentItemContentHashInput {
  source: string;
  questionType: string;
  domains: string[];
  knowledgeTags: string[];
  difficulty: number;
  optionCount: number;
  kaqImmutableContentHash: string;
  adaptiveAssessmentItemRef: unknown;
  questionSnapshot: unknown;
}

export function adaptiveAssessmentItemContentHash(
  input: AdaptiveAssessmentItemContentHashInput,
): string {
  const snapshot = {
    source: input.source,
    questionType: input.questionType,
    domains: [...input.domains].sort(),
    knowledgeTags: [...input.knowledgeTags].sort(),
    difficulty: Number(input.difficulty.toFixed(6)),
    optionCount: input.optionCount,
    kaq: input.kaqImmutableContentHash,
    adaptiveAssessmentItemRef: input.adaptiveAssessmentItemRef,
    questionSnapshot: input.questionSnapshot,
  };

  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

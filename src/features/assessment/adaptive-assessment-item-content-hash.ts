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

function canonicalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJsonValue);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entryValue]) => [key, canonicalizeJsonValue(entryValue)]),
  );
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
    adaptiveAssessmentItemRef: canonicalizeJsonValue(input.adaptiveAssessmentItemRef),
    questionSnapshot: canonicalizeJsonValue(input.questionSnapshot),
  };

  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

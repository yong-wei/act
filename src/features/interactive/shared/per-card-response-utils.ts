type AnswerMap = Record<string, string> | undefined;

function hasOwnAnswer(answers: AnswerMap, key: string) {
  return Boolean(answers) && Object.prototype.hasOwnProperty.call(answers, key);
}

export function buildPerCardSubmissionAnswers({
  savedAnswers,
  currentDraft,
  targetKey,
}: {
  savedAnswers?: Record<string, string>;
  currentDraft?: Record<string, string>;
  targetKey: string;
}) {
  return {
    ...(savedAnswers ?? {}),
    [targetKey]: currentDraft?.[targetKey] ?? '',
  };
}

export function mergeSavedAnswersIntoDraft({
  savedAnswers,
  currentDraft,
  keys,
}: {
  savedAnswers?: Record<string, string>;
  currentDraft?: Record<string, string>;
  keys: readonly string[];
}) {
  const next: Record<string, string> = {};
  for (const key of keys) {
    if (hasOwnAnswer(savedAnswers, key)) {
      next[key] = savedAnswers?.[key] ?? '';
      continue;
    }
    next[key] = currentDraft?.[key] ?? '';
  }
  return next;
}

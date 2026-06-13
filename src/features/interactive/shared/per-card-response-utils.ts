type AnswerMap = Record<string, string> | undefined;

export type StudentCardDraftEnvelope = {
  identity: string;
  draftAnswers: Record<string, string>;
  touchedKeys: ReadonlySet<string>;
  localSubmittedKeys: ReadonlySet<string>;
};

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

export function mergeSavedAnswersIntoTouchedDraft({
  savedAnswers,
  currentDraft,
  keys,
  touchedKeys,
}: {
  savedAnswers?: Record<string, string>;
  currentDraft?: Record<string, string>;
  keys: readonly string[];
  touchedKeys: ReadonlySet<string>;
}) {
  const next = mergeSavedAnswersIntoDraft({ savedAnswers, currentDraft, keys });
  for (const key of keys) {
    if (touchedKeys.has(key) && hasOwnAnswer(currentDraft, key)) {
      next[key] = currentDraft?.[key] ?? '';
    }
  }
  return next;
}

export function buildStepActivityIdentity(stepId: string, cardKeys: readonly string[]) {
  return `${stepId}:${cardKeys.join('|')}`;
}

export function resolveStudentCardDraftEnvelope({
  identity,
  savedAnswers,
  cardKeys,
  envelope,
}: {
  identity: string;
  savedAnswers?: Record<string, string>;
  cardKeys: readonly string[];
  envelope: StudentCardDraftEnvelope;
}) {
  if (envelope.identity !== identity) {
    const draftAnswers = mergeSavedAnswersIntoDraft({
      savedAnswers,
      currentDraft: {},
      keys: cardKeys,
    });
    const touchedKeys = new Set<string>();
    const localSubmittedKeys = new Set<string>();
    return {
      identityChanged: true,
      nextEnvelope: {
        identity,
        draftAnswers,
        touchedKeys,
        localSubmittedKeys,
      },
      mergedDraftAnswers: draftAnswers,
    };
  }

  return {
    identityChanged: false,
    nextEnvelope: envelope,
    mergedDraftAnswers: mergeSavedAnswersIntoTouchedDraft({
      savedAnswers,
      currentDraft: envelope.draftAnswers,
      keys: cardKeys,
      touchedKeys: envelope.touchedKeys,
    }),
  };
}

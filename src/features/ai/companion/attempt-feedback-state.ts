export type AttemptOutcome = 'success' | 'failure' | null;

export type FeedbackSubmissionState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export function canRecordAttempt(outcome: AttemptOutcome): outcome is Exclude<AttemptOutcome, null> {
  return outcome === 'success' || outcome === 'failure';
}

export function attemptOutcomeToSuccess(outcome: AttemptOutcome): boolean | null {
  if (outcome === 'success') return true;
  if (outcome === 'failure') return false;
  return null;
}

export function getFeedbackStatusMessage(state: FeedbackSubmissionState): string | null {
  if (state.status === 'submitting') return '正在提交反馈...';
  if (state.status === 'success') return '反馈已提交';
  if (state.status === 'error') return state.message;
  return null;
}

export interface PromptAssessmentSessionRecord {
  sessionId: string;
  version: number;
}

export function selectPromptAssessmentSessionHistory<T extends PromptAssessmentSessionRecord>(
  history: readonly T[],
  sessionId: string,
): T[] {
  return history.filter((record) => record.sessionId === sessionId);
}

export function nextPromptAssessmentSessionVersion(
  history: readonly PromptAssessmentSessionRecord[],
  sessionId: string,
): number {
  const latestVersion = selectPromptAssessmentSessionHistory(history, sessionId)
    .reduce((maxVersion, record) => Math.max(maxVersion, record.version), 0);
  return latestVersion + 1;
}

export function parseStructuredSubmissionAnswer(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function collectStructuredSubmissionAnswers(
  answers: Record<string, string>,
  includeKey: (key: string) => boolean,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(answers)
      .filter(([key]) => includeKey(key))
      .map(([key, value]) => [key, parseStructuredSubmissionAnswer(value)]),
  );
}

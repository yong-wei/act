type PendingSubmission = {
  status: 'pending';
  retryAfterMs: number;
};

const isPendingSubmission = (value: unknown): value is PendingSubmission =>
  Boolean(
    value
    && typeof value === 'object'
    && 'status' in value
    && value.status === 'pending'
    && 'retryAfterMs' in value
    && typeof value.retryAfterMs === 'number',
  );

export async function submitWithPendingRecovery<T>(
  submit: () => Promise<T>,
  options: {
    maxAttempts?: number;
    wait?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 40;
  const wait = options.wait ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let result: T | undefined;
  let lastNetworkError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      result = await submit();
      lastNetworkError = undefined;
    } catch (error) {
      lastNetworkError = error;
      if (attempt < maxAttempts - 1) {
        await wait(Math.min(2_000, 250 * (attempt + 1)));
        continue;
      }
    }
    if (!isPendingSubmission(result)) break;
    if (attempt < maxAttempts - 1) {
      await wait(Math.min(2_000, Math.max(250, result.retryAfterMs)));
    }
  }

  if (lastNetworkError) throw lastNetworkError;
  return result as T;
}

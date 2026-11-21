/** The server can request up to 14 s plus 1.799 s of queue-position jitter. */
export function admissionRetryDelay(retryAfterMs: number): number {
  const delay = Number.isFinite(retryAfterMs) ? Math.max(250, Math.min(16_000, retryAfterMs)) : 2500;
  return delay + Math.random() * 350;
}

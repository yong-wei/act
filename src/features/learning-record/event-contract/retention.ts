export type RetentionKind =
  | 'transport-replay'
  | 'successful-payload'
  | 'failure-receipt'
  | 'restricted-raw'
  | 'public-audit'
  | 'learning-fact';

const DEFAULT_MS: Record<RetentionKind, number> = {
  'transport-replay': 72 * 60 * 60 * 1000,
  'successful-payload': 24 * 60 * 60 * 1000,
  'failure-receipt': 30 * 24 * 60 * 60 * 1000,
  'restricted-raw': 24 * 60 * 60 * 1000,
  'public-audit': 90 * 24 * 60 * 60 * 1000,
  'learning-fact': 365 * 24 * 60 * 60 * 1000,
};

const MAX_MS: Record<RetentionKind, number> = {
  'transport-replay': 7 * 24 * 60 * 60 * 1000,
  'successful-payload': 24 * 60 * 60 * 1000,
  'failure-receipt': 90 * 24 * 60 * 60 * 1000,
  'restricted-raw': 7 * 24 * 60 * 60 * 1000,
  'public-audit': 90 * 24 * 60 * 60 * 1000,
  'learning-fact': 2 * 365 * 24 * 60 * 60 * 1000,
};

export function retentionCapMs(kind: RetentionKind, requestedMs?: number): number {
  const max = MAX_MS[kind];
  const fallback = DEFAULT_MS[kind];
  if (requestedMs == null) return fallback;
  return Math.min(requestedMs, max);
}

export function isRetentionExpired(kind: RetentionKind, ageMs: number, requestedMs?: number): boolean {
  return ageMs > retentionCapMs(kind, requestedMs);
}

export function canDeleteTransport(input: { terminalReceipt: boolean; terminalizationInProgress: boolean }): boolean {
  if (input.terminalizationInProgress) return false;
  return input.terminalReceipt;
}

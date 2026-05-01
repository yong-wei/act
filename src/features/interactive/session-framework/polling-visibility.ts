'use client';

export const HIDDEN_DOCUMENT_POLL_INTERVAL_MS = 30_000;

export function getDocumentVisibilityState(): DocumentVisibilityState | null {
  return typeof document !== 'undefined' ? document.visibilityState : null;
}

export function shouldRunHiddenAwarePoll({
  now,
  lastHiddenPollAt,
  hiddenPollIntervalMs = HIDDEN_DOCUMENT_POLL_INTERVAL_MS,
}: {
  now: number;
  lastHiddenPollAt: number;
  hiddenPollIntervalMs?: number;
}) {
  if (getDocumentVisibilityState() !== 'hidden') {
    return {
      shouldRun: true,
      lastHiddenPollAt,
    };
  }

  if (lastHiddenPollAt > 0 && now - lastHiddenPollAt < hiddenPollIntervalMs) {
    return {
      shouldRun: false,
      lastHiddenPollAt,
    };
  }

  return {
    shouldRun: true,
    lastHiddenPollAt: now,
  };
}

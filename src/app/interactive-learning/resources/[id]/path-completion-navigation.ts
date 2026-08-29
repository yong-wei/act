import { parseAdaptivePathJourneyResponse } from '@/features/adaptive/adaptive-path-journey-control';
import { canonicalizeAdaptivePathInternalHref } from '@/features/adaptive/adaptive-path-journey-contracts';

export function resolveAdaptivePathCompletionContinueHref(input: {
  payload: unknown;
  currentHref: string;
  fallbackHref: string;
}): string {
  const fallbackHref = canonicalizeAdaptivePathInternalHref(input.fallbackHref);
  if (!fallbackHref) {
    throw new Error('路径完成回退地址不受平台支持');
  }

  const currentKey = comparableInternalHref(input.currentHref);
  const journey = parseAdaptivePathJourneyResponse(input.payload);
  const nextState = journey?.nextAction.state;
  const nextHref = nextState === 'ready' || nextState === 'path-complete'
    ? canonicalizeAdaptivePathInternalHref(journey?.nextAction.href ?? '')
    : null;
  const nextKey = nextHref ? comparableInternalHref(nextHref) : null;

  if (nextHref && nextKey && nextKey !== currentKey) {
    return nextHref;
  }

  return fallbackHref;
}

function comparableInternalHref(href: string): string | null {
  const canonical = canonicalizeAdaptivePathInternalHref(href);
  if (!canonical) return null;
  const parsed = new URL(canonical, 'https://act.local');
  parsed.searchParams.sort();
  const search = parsed.searchParams.toString();
  return search ? `${parsed.pathname}?${search}` : parsed.pathname;
}

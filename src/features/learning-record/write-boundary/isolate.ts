import { shouldMaterializeLearningFact } from '@/lib/data-governance/learning-fact-materialization';

export type SecondaryWorkerClaimClass = 'ingest' | 'isolated-duplicate' | 'invalid';

export function classifySecondaryWorkerClaim(
  event: { actionType: string; payload?: unknown } | null,
): SecondaryWorkerClaimClass {
  if (!event) return 'invalid';
  const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
    ? event.payload as Record<string, unknown>
    : {};
  if (shouldMaterializeLearningFact(event.actionType, payload)) {
    return 'isolated-duplicate';
  }
  return 'ingest';
}

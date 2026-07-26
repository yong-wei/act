import type { KonlingAssignedCitation } from '@/lib/konling-citation-protocol';
import type {
  TextbookV2OptimizationResult,
  TextbookV2ToolResult,
} from '@/lib/source-pack/textbook-v2-adapter';

export interface KonlingTextbookOptimization {
  toolCallId: string;
  foreground: TextbookV2ToolResult;
  continuation: Promise<TextbookV2OptimizationResult>;
}

export interface KonlingTextbookOptimizationDecision {
  material: boolean;
  finalResults: Array<{
    toolCallId: string;
    result: TextbookV2ToolResult;
  }>;
  finalTextbookCitations: KonlingAssignedCitation[];
}

export async function resolveKonlingTextbookOptimizations(input: {
  optimizations: readonly KonlingTextbookOptimization[];
  assignedCitations: () => KonlingAssignedCitation[];
  usedTextbookCanonicalKeys: readonly string[];
}): Promise<KonlingTextbookOptimizationDecision> {
  const settled = await Promise.all(input.optimizations.map(async (optimization) => ({
    optimization,
    outcome: await optimization.continuation.catch(
      (): TextbookV2OptimizationResult => ({ status: 'failed' }),
    ),
  })));
  const assigned = input.assignedCitations();
  const byNumber = new Map(assigned.map((citation) => [
    citation.displayNumber,
    citation,
  ]));
  const finalKeys = new Set<string>();
  let preferredChanged = false;

  let completedCount = 0;
  const finalResults = settled
    .sort((left, right) =>
      left.optimization.toolCallId.localeCompare(right.optimization.toolCallId))
    .map(({ optimization, outcome }) => {
      const result = outcome.status === 'complete'
        ? outcome.result
        : optimization.foreground;
      if (outcome.status === 'complete') completedCount += 1;
      const foregroundPreferred = citationKey(
        optimization.foreground.candidates[0]?.displayNumber,
        byNumber,
      );
      const finalPreferred = citationKey(
        result.candidates[0]?.displayNumber,
        byNumber,
      );
      if (outcome.status === 'complete' && foregroundPreferred !== finalPreferred) {
        preferredChanged = true;
      }
      for (const candidate of result.candidates) {
        const key = citationKey(candidate.displayNumber, byNumber);
        if (key) finalKeys.add(key);
      }
      return {
        toolCallId: optimization.toolCallId,
        result,
      };
    });
  const usedEvidenceDisappeared = input.usedTextbookCanonicalKeys.some(
    (key) => !finalKeys.has(key),
  );
  return {
    material: completedCount > 0
      && (preferredChanged || usedEvidenceDisappeared),
    finalResults,
    finalTextbookCitations: assigned.filter((citation) =>
      citation.sourceType === 'textbook' && finalKeys.has(citation.canonicalKey)),
  };
}

function citationKey(
  displayNumber: number | undefined,
  byNumber: ReadonlyMap<number, KonlingAssignedCitation>,
): string | null {
  if (!displayNumber) return null;
  const citation = byNumber.get(displayNumber);
  return citation?.sourceType === 'textbook' ? citation.canonicalKey : null;
}

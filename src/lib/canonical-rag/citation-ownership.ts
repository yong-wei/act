import type {
  ActStructuralCitationTarget,
  CrosswalkResolutionDiagnostic,
  FinalEvidenceCandidate,
  NumberedCitation,
} from './contracts';

/**
 * Graph summaries, relations, unresolved upstream references, and Legacy
 * fallback candidates can never become final answer evidence or citations.
 */
export function evaluateFinalEvidenceCandidate(
  candidate: FinalEvidenceCandidate,
): {
  accepted: boolean;
  diagnostics: CrosswalkResolutionDiagnostic[];
} {
  if (candidate.kind === 'act-structural-unit') {
    if (!candidate.structuralTarget?.readable) {
      return {
        accepted: false,
        diagnostics: [{
          code: 'unreadable-structural-unit',
          canonicalId: candidate.canonicalId ?? null,
          message: 'ACT structural unit is not readable and cannot be cited',
        }],
      };
    }
    return { accepted: true, diagnostics: [] };
  }

  if (candidate.kind === 'ungated-crosswalk-seed') {
    return {
      accepted: false,
      diagnostics: [{
        code: 'unresolved-upstream-rejected',
        canonicalId: candidate.canonicalId ?? null,
        message:
          'Governed Crosswalk structural seed is not a final citation until Source Pack adjudication',
      }],
    };
  }

  if (candidate.kind === 'graph-summary') {
    return {
      accepted: false,
      diagnostics: [{
        code: 'graph-summary-rejected',
        canonicalId: candidate.canonicalId ?? null,
        message: 'Canonical object summary is not final answer evidence',
      }],
    };
  }

  if (candidate.kind === 'graph-relation') {
    return {
      accepted: false,
      diagnostics: [{
        code: 'relation-rejected',
        canonicalId: candidate.canonicalId ?? null,
        message: 'Graph relation is not final answer evidence',
      }],
    };
  }

  if (candidate.kind === 'unresolved-upstream') {
    return {
      accepted: false,
      diagnostics: [{
        code: 'unresolved-upstream-rejected',
        publishedEntityId: candidate.upstream?.publishedEntityId ?? null,
        retrievalChunkId: candidate.upstream?.retrievalChunkId ?? null,
        citationTargetId: candidate.upstream?.citationTargetId ?? null,
        message: 'Unresolved upstream RAG reference cannot be cited',
      }],
    };
  }

  return {
    accepted: false,
    diagnostics: [{
      code: 'legacy-fallback-forbidden',
      message: 'Legacy fallback cannot supply Canonical RAG final evidence',
    }],
  };
}

/**
 * Emit standard numbered citations targeting the most specific available
 * textbook structure. Prefer paragraph/subunit locators over broad chapter ids.
 */
export function emitNumberedCitations(
  targets: readonly ActStructuralCitationTarget[],
  options: { max?: number } = {},
): NumberedCitation[] {
  const max = Math.min(Math.max(options.max ?? 12, 1), 24);
  const unique = new Map<string, ActStructuralCitationTarget>();

  for (const target of targets) {
    if (!target.readable) continue;
    const key = [
      target.structuralUnitId,
      target.retrievalChunkId,
      target.citationTargetId,
      target.locator ?? '',
    ].join('\u001f');
    const existing = unique.get(key);
    if (!existing || specificityRank(target) < specificityRank(existing)) {
      unique.set(key, target);
    }
  }

  const ordered = [...unique.values()].sort((left, right) => (
    specificityRank(left) - specificityRank(right)
    || left.structuralUnitId.localeCompare(right.structuralUnitId)
    || left.citationTargetId.localeCompare(right.citationTargetId)
  ));

  return ordered.slice(0, max).map((target, index) => ({
    number: index + 1,
    structuralUnitId: target.structuralUnitId,
    retrievalChunkId: target.retrievalChunkId,
    citationTargetId: target.citationTargetId,
    displayTitle: target.displayTitle,
    locator: target.locator,
    href: target.href,
    sourceEditionId: target.sourceEditionId,
  }));
}

function specificityRank(target: ActStructuralCitationTarget): number {
  const locator = target.locator?.trim() ?? '';
  if (!locator) return 40;
  // Paragraph / numbered subunit markers rank ahead of coarse section/chapter ids.
  if (/(?:^|[-_:.#])(?:p|para|paragraph|§)\d+/iu.test(locator)) return 0;
  if (/\b\d+\.\d+\.\d+\b/u.test(locator)) return 5;
  if (/\b\d+\.\d+\b/u.test(locator)) return 10;
  if (/(?:section|sec|subsection)/iu.test(locator)) return 20;
  if (/(?:chapter|ch)\b/iu.test(locator)) return 30;
  return 15;
}

export function rejectGraphOwnedEvidence(input: {
  summaries?: ReadonlyArray<{ canonicalId: string; summary: string }>;
  relations?: ReadonlyArray<{ relationId: string }>;
  unresolvedUpstream?: ReadonlyArray<{
    publishedEntityId: string;
    retrievalChunkId: string;
    citationTargetId: string;
  }>;
}): FinalEvidenceCandidate[] {
  const rejected: FinalEvidenceCandidate[] = [];
  for (const summary of input.summaries ?? []) {
    rejected.push({
      kind: 'graph-summary',
      id: `summary:${summary.canonicalId}`,
      citable: false,
      canonicalId: summary.canonicalId,
      summary: summary.summary,
    });
  }
  for (const relation of input.relations ?? []) {
    rejected.push({
      kind: 'graph-relation',
      id: `relation:${relation.relationId}`,
      citable: false,
    });
  }
  for (const upstream of input.unresolvedUpstream ?? []) {
    rejected.push({
      kind: 'unresolved-upstream',
      id: `upstream:${upstream.publishedEntityId}:${upstream.retrievalChunkId}:${upstream.citationTargetId}`,
      citable: false,
      // Partial seed for rejection diagnostics only (not executable resolution).
      upstream: upstream as FinalEvidenceCandidate['upstream'],
    });
  }
  return rejected.filter((candidate) => !evaluateFinalEvidenceCandidate(candidate).accepted);
}

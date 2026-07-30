import {
  includesTermBounded,
  normalizeEvidenceText,
} from '@/lib/aggregate-governance/term-match';

import {
  RAG_SUPPORTED_OBJECT_TYPES,
  type CanonicalRagCoverageEntry,
  type CanonicalRagObject,
  type CanonicalRagReleaseContext,
  type EntityAlignmentHit,
  type EntityAlignmentMatchKind,
} from './contracts';

/** Latin terms shorter than this never match in-query (blocks "ai" ⊆ "gain"). */
const MIN_LATIN_TERM_LENGTH = 3;
/** CJK terms shorter than this never match in-query. */
const MIN_CJK_TERM_LENGTH = 2;

function isActiveCoverageRole(
  role: CanonicalRagCoverageEntry['role'],
): role is Exclude<CanonicalRagCoverageEntry['role'], 'excluded_with_rationale'> {
  return role !== 'excluded_with_rationale';
}

function isSupportedObjectType(canonicalType: string): boolean {
  return (RAG_SUPPORTED_OBJECT_TYPES as readonly string[]).includes(canonicalType);
}

function termMeetsLengthFloor(term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  if (/[\u4e00-\u9fff]/u.test(t)) return t.length >= MIN_CJK_TERM_LENGTH;
  return t.length >= MIN_LATIN_TERM_LENGTH;
}

interface AlignmentCandidate {
  object: CanonicalRagObject;
  coverageRole: Exclude<CanonicalRagCoverageEntry['role'], 'excluded_with_rationale'>;
  matchKind: EntityAlignmentMatchKind;
  matchedTerm: string;
  rank: number;
}

/**
 * Align a query to Canonical Objects by ID, name, or alias inside the
 * version-consistent current candidate ReleaseSet and admitted CourseCoverage.
 *
 * Matches whole-query equality and bounded in-query term occurrence so a real
 * question containing an entity name/alias can align without requiring the
 * entire query to equal the term. Short-token false positives are rejected.
 */
export function alignCanonicalEntities(input: {
  query: string;
  objects: readonly CanonicalRagObject[];
  coverage: readonly CanonicalRagCoverageEntry[];
  release: CanonicalRagReleaseContext;
  limit?: number;
}): EntityAlignmentHit[] {
  const query = input.query.trim();
  if (!query) return [];

  const release = input.release;
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 16);
  const coverageById = new Map(
    input.coverage.map((entry) => [entry.canonicalId, entry.role] as const),
  );
  const normalizedQuery = normalizeEvidenceText(query);
  const candidates: AlignmentCandidate[] = [];

  for (const object of input.objects) {
    if (!isSupportedObjectType(object.canonicalType)) continue;
    const role = coverageById.get(object.canonicalId);
    if (!role || !isActiveCoverageRole(role)) continue;

    const match = matchObject(query, normalizedQuery, object);
    if (!match) continue;
    candidates.push({
      object,
      coverageRole: role,
      matchKind: match.kind,
      matchedTerm: match.term,
      rank: match.rank,
    });
  }

  candidates.sort((left, right) => (
    left.rank - right.rank
    || right.matchedTerm.length - left.matchedTerm.length
    || left.object.canonicalId.localeCompare(right.object.canonicalId)
  ));

  const seen = new Set<string>();
  const hits: EntityAlignmentHit[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.object.canonicalId)) continue;
    seen.add(candidate.object.canonicalId);
    hits.push({
      canonicalId: candidate.object.canonicalId,
      canonicalType: candidate.object.canonicalType,
      label: candidate.object.label,
      matchKind: candidate.matchKind,
      matchedTerm: candidate.matchedTerm,
      coverageRole: candidate.coverageRole,
      releaseSetId: release.releaseSetId,
      releaseId: release.releaseId,
      contextDigest: release.contextDigest,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

function matchObject(
  query: string,
  normalizedQuery: string,
  object: CanonicalRagObject,
): { kind: EntityAlignmentMatchKind; term: string; rank: number } | null {
  if (
    object.canonicalId === query
    || object.canonicalId.toLocaleLowerCase() === query.toLocaleLowerCase()
  ) {
    return { kind: 'canonical-id', term: object.canonicalId, rank: 0 };
  }

  const names = [object.label, ...object.aliases]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  for (const name of names) {
    if (name === query) {
      return {
        kind: name === object.label ? 'exact-name' : 'exact-alias',
        term: name,
        rank: name === object.label ? 1 : 2,
      };
    }
  }

  // Whole-query normalized equality (spacing/punctuation insensitive).
  for (const name of names) {
    const normalizedName = normalizeEvidenceText(name);
    if (normalizedName && normalizedName === normalizedQuery) {
      return {
        kind: name === object.label ? 'normalized-name' : 'normalized-alias',
        term: name,
        rank: name === object.label ? 3 : 4,
      };
    }
  }

  // In-query bounded occurrence for real questions containing the entity term.
  for (const name of names) {
    if (!termMeetsLengthFloor(name)) continue;
    if (includesTermBounded(query, name) || includesTermBounded(normalizedQuery, normalizeEvidenceText(name))) {
      return {
        kind: name === object.label ? 'in-query-name' : 'in-query-alias',
        term: name,
        rank: name === object.label ? 5 : 6,
      };
    }
  }

  return null;
}

export function admittedCoverageIds(
  coverage: readonly CanonicalRagCoverageEntry[],
): Set<string> {
  const admitted = new Set<string>();
  for (const entry of coverage) {
    if (isActiveCoverageRole(entry.role)) admitted.add(entry.canonicalId);
  }
  return admitted;
}

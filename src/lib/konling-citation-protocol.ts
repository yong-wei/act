export type KonlingCitationSourceType =
  | 'content'
  | 'textbook'
  | 'learner-state'
  | 'path-execution'
  | 'simulation'
  | 'arena'
  | 'intervention'
  | 'memory';

export type KonlingCitationIdentity =
  | {
      kind: 'textbook';
      bookId: string;
      edition: string;
      sourceRevision: string;
      unitId: string;
      fragmentId?: string | null;
    }
  | {
      kind: 'evidence';
      sourceType: Exclude<KonlingCitationSourceType, 'content' | 'textbook'>;
      evidenceId: string;
      timeSemantic?: string | null;
    }
  | {
      kind: 'content';
      sourceType: 'content';
      contentId: string;
      sourceRevision?: string | null;
    };

export type KonlingAssignedCitation = {
  id: string;
  sourceType: KonlingCitationSourceType;
  displayTitle: string;
  readonly displayNumber: number;
  readonly canonicalKey: string;
  href: string | null;
  identity: KonlingCitationIdentity;
  confidence?: 'none' | 'low' | 'medium' | 'high';
  evidenceBasis?: string;
  limitation?: string | null;
};

export type KonlingAssignableCitation = Omit<
  KonlingAssignedCitation,
  'displayNumber' | 'canonicalKey'
>;

function keyPart(value: string | null | undefined) {
  return encodeURIComponent(String(value ?? '').normalize('NFKC').trim());
}

export function buildKonlingCitationCanonicalKey(identity: KonlingCitationIdentity) {
  if (identity.kind === 'textbook') {
    return [
      'textbook',
      keyPart(identity.bookId),
      keyPart(identity.edition),
      keyPart(identity.sourceRevision),
      keyPart(identity.unitId),
      keyPart(identity.fragmentId || 'unit'),
    ].join(':');
  }
  if (identity.kind === 'content') {
    return [
      'content',
      keyPart(identity.contentId),
      keyPart(identity.sourceRevision || 'current'),
    ].join(':');
  }
  return [
    identity.sourceType,
    keyPart(identity.evidenceId),
    keyPart(identity.timeSemantic || 'stable'),
  ].join(':');
}

export function assignKonlingCitationDisplayNumbers(
  citations: readonly KonlingAssignableCitation[],
  startAt = 1,
): KonlingAssignedCitation[] {
  const assigned: KonlingAssignedCitation[] = [];
  const byKey = new Map<string, KonlingAssignedCitation>();
  let nextDisplayNumber = Math.max(1, Math.floor(startAt));

  for (const citation of citations) {
    const canonicalKey = buildKonlingCitationCanonicalKey(citation.identity);
    if (byKey.has(canonicalKey)) continue;
    const item: KonlingAssignedCitation = Object.freeze({
      ...citation,
      canonicalKey,
      displayNumber: nextDisplayNumber,
    });
    nextDisplayNumber += 1;
    byKey.set(canonicalKey, item);
    assigned.push(item);
  }
  return assigned;
}

export function createKonlingCitationAllocator(
  initial: readonly KonlingAssignableCitation[] = [],
) {
  const assigned = assignKonlingCitationDisplayNumbers(initial);
  const byKey = new Map(assigned.map((citation) => [citation.canonicalKey, citation]));
  let nextDisplayNumber = assigned.length + 1;

  return {
    assigned: () => [...byKey.values()],
    assign(citation: KonlingAssignableCitation): KonlingAssignedCitation {
      const canonicalKey = buildKonlingCitationCanonicalKey(citation.identity);
      const existing = byKey.get(canonicalKey);
      if (existing) return existing;
      const item: KonlingAssignedCitation = Object.freeze({
        ...citation,
        canonicalKey,
        displayNumber: nextDisplayNumber,
      });
      nextDisplayNumber += 1;
      byKey.set(canonicalKey, item);
      return item;
    },
  };
}

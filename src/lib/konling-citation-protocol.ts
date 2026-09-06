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
  readonly verifiable: boolean;
  href: string | null;
  identity: KonlingCitationIdentity;
  confidence?: 'none' | 'low' | 'medium' | 'high';
  evidenceBasis?: string;
  limitation?: string | null;
};

export type KonlingAssignableCitation = Omit<
  KonlingAssignedCitation,
  'displayNumber' | 'canonicalKey' | 'verifiable'
> & {
  /** 服务器声明该条目具备稳定来源身份与有效目标锚点；缺省视为可核验（#1949）。 */
  verifiable?: boolean;
};

/**
 * 直接支撑的答案相关性证据分级白名单（生产 hybrid-retriever 的 basis）：
 * 显式引用（selected-node-ref / capability-target-ref / resource-ref /
 * learner-context-ref）与查询词直接命中（query-exact / query-lexical）。
 * 纯语义相似（semantic-score）只是检索级相关；缺失或未知 basis 一律不算
 * 直接支撑（#1992 review P1）。审计（citation-audit）、白名单执行
 * （#2017）与逐单元证据分配（#2039）共用同一判据。
 */
export const DIRECT_SUPPORT_RELEVANCE_BASES: ReadonlySet<string> = new Set([
  'selected-node-ref',
  'capability-target-ref',
  'resource-ref',
  'learner-context-ref',
  'query-exact',
  'query-lexical',
]);

/** 直接支撑判据：已核验 + 有锚点 + href 可访问 + 相关性分级在白名单内。 */
export function isDirectVerifiedSupportCitation(citation: {
  citationTargetId: string | null;
  verified: boolean;
  href: string | null;
  answerRelevanceBasis?: string | null;
}): boolean {
  return citation.verified === true
    && Boolean(citation.citationTargetId)
    && Boolean(citation.href)
    && DIRECT_SUPPORT_RELEVANCE_BASES.has(citation.answerRelevanceBasis ?? '');
}

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
      verifiable: citation.verifiable !== false,
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
        verifiable: citation.verifiable !== false,
        canonicalKey,
        displayNumber: nextDisplayNumber,
      });
      nextDisplayNumber += 1;
      byKey.set(canonicalKey, item);
      return item;
    },
  };
}

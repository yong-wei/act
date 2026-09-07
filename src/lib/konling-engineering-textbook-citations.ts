/**
 * 工程节点 → 教材引用（#2047，消费 Change 2 engineering-graph-textbook-coverage）。
 *
 * 只读消费治理映射台账（candidates + append-only reviews 的 approved 判定）：
 * 每个工程节点取最高 rank 的 approved 结构单元坐标，经统一 reader 的单元
 * 索引解析（等价于 v2 runtime manifest 存在性校验）后签发带 vbh 句柄的
 * 教材引用；无 approved 映射或坐标漂移时降级为无出处状态，不伪造教材。
 */

import {
  candidateKeyOf,
  effectiveVerdicts,
  loadCandidates,
  loadReviewLedger,
  mappingArtifactPath,
  type MappingCandidateRow,
} from '@/lib/engineering-textbook-mapping';
import type { KonlingAssignableCitation } from '@/lib/konling-citation-protocol';
import { issueTextbookVersionBoundHref } from '@/lib/textbook-resource-coach/navigation-handle';
import { hashTextbookMarkdown } from '@/lib/textbook-resource-coach/identity';
import { STRUCTURED_TEXTBOOK_UNIT_KIND } from '@/lib/textbook-resource-coach/types';
import { buildTextbookReaderHref, loadTextbookCitationUnits } from '@/lib/textbook-reader';

interface ApprovedMappingCache {
  byCanonicalId: Map<string, MappingCandidateRow[]>;
}

const cacheByRepoRoot = new Map<string, ApprovedMappingCache>();

/** 每节点引用上限：取最高 rank 的 approved 单元，1 条足够支撑出处引用。 */
const CITATIONS_PER_NODE = 1;

function loadApprovedMappings(repoRoot: string): ApprovedMappingCache {
  const cached = cacheByRepoRoot.get(repoRoot);
  if (cached) return cached;

  const candidates = loadCandidates(repoRoot);
  const reviews = loadReviewLedger({
    filePath: mappingArtifactPath(repoRoot, 'reviews.jsonl'),
  });
  const verdicts = effectiveVerdicts(reviews);
  const byCanonicalId = new Map<string, MappingCandidateRow[]>();
  for (const row of candidates.rows) {
    if (verdicts.get(candidateKeyOf(row))?.verdict !== 'approved') continue;
    const list = byCanonicalId.get(row.canonicalId) ?? [];
    list.push(row);
    byCanonicalId.set(row.canonicalId, list);
  }
  for (const list of byCanonicalId.values()) {
    list.sort((left, right) => left.rank - right.rank);
  }
  const cache: ApprovedMappingCache = { byCanonicalId };
  cacheByRepoRoot.set(repoRoot, cache);
  return cache;
}

export interface KonlingEngineeringTextbookCitationResolution {
  citations: KonlingAssignableCitation[];
  /** 无 approved 映射或坐标不可解析的节点：保持无出处，不伪造教材。 */
  unmappedCanonicalIds: string[];
}

export async function resolveKonlingEngineeringTextbookCitations(input: {
  canonicalIds: readonly string[];
  repoRoot?: string;
}): Promise<KonlingEngineeringTextbookCitationResolution> {
  const repoRoot = input.repoRoot ?? process.cwd();
  const citations: KonlingAssignableCitation[] = [];
  const unmappedCanonicalIds: string[] = [];

  let approved: ApprovedMappingCache;
  try {
    approved = loadApprovedMappings(repoRoot);
  } catch {
    // 映射工件缺失/损坏时整体降级为无出处状态（Change 2 未交付语义）。
    return { citations: [], unmappedCanonicalIds: [...input.canonicalIds] };
  }

  const requestsByBook = new Map<string, { bookId: string; rows: MappingCandidateRow[] }>();
  for (const canonicalId of input.canonicalIds) {
    const rows = approved.byCanonicalId.get(canonicalId)?.slice(0, CITATIONS_PER_NODE) ?? [];
    if (rows.length === 0) {
      unmappedCanonicalIds.push(canonicalId);
      continue;
    }
    for (const row of rows) {
      const entry = requestsByBook.get(row.bookId) ?? { bookId: row.bookId, rows: [] };
      entry.rows.push(row);
      requestsByBook.set(row.bookId, entry);
    }
  }

  const unitByUnitId = new Map<string, Awaited<ReturnType<typeof loadTextbookCitationUnits>>[number]>();
  for (const request of requestsByBook.values()) {
    try {
      const units = await loadTextbookCitationUnits({
        requests: [{ bookId: request.bookId, unitIds: request.rows.map((row) => row.structuralUnitId) }],
      });
      for (const unit of units) unitByUnitId.set(unit.id, unit);
    } catch {
      // 单元不再存在于 reader manifests（坐标漂移）：该批行整体降级为无出处。
    }
  }

  const seen = new Set<string>();
  const resolvedCanonicalIds = new Set<string>();
  for (const canonicalId of input.canonicalIds) {
    const rows = approved.byCanonicalId.get(canonicalId)?.slice(0, CITATIONS_PER_NODE) ?? [];
    for (const row of rows) {
      if (seen.has(row.structuralUnitId)) {
        resolvedCanonicalIds.add(canonicalId);
        continue;
      }
      const unit = unitByUnitId.get(row.structuralUnitId);
      if (!unit) {
        continue;
      }
      seen.add(row.structuralUnitId);
      resolvedCanonicalIds.add(canonicalId);
      const identity = {
        resourceKind: STRUCTURED_TEXTBOOK_UNIT_KIND,
        resourceId: unit.id,
        bookId: unit.bookId,
        edition: unit.edition,
        sourceRevision: unit.sourceRevision,
        unitId: unit.id,
        contentHash: hashTextbookMarkdown(unit.markdown),
        anchorId: null,
      };
      const vbhHref = issueTextbookVersionBoundHref(identity, unit.structuralPath);
      citations.push({
        id: `eng-textbook:${canonicalId}:${unit.id}`,
        sourceType: 'textbook',
        displayTitle: `${row.unitTitle}（${row.bookId}）`,
        href: vbhHref ?? buildTextbookReaderHref({
          bookId: unit.bookId,
          edition: unit.edition,
          unitPath: unit.structuralPath,
        }),
        verifiable: true,
        confidence: 'medium',
        evidenceBasis: 'engineering-textbook-mapping:approved',
        identity: {
          kind: 'textbook',
          bookId: unit.bookId,
          edition: unit.edition,
          sourceRevision: unit.sourceRevision,
          unitId: unit.id,
          fragmentId: null,
        },
      });
    }
  }

  return {
    citations,
    unmappedCanonicalIds: input.canonicalIds.filter((id) => !resolvedCanonicalIds.has(id)),
  };
}

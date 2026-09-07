/**
 * 控灵工程图谱邻域消费（#2047）。
 *
 * 以教学投影焦点 canonicalIds 为白名单种子，从分层 payload 的工程层提取
 * 有界邻域摘要；谓词限定在 canonical RAG 治理谓词白名单内（先后修
 * prerequisite 谓词属 #2059 独立消费线，不在本白名单）。只读：不写回、
 * 不锻造跨域边，工程 provenance 与教学投影证据分域保留。
 */

import { RAG_SUPPORTED_PREDICATES } from '@/lib/canonical-rag/predicate-adapters';
import type { LayeredGraphPayload } from '@/lib/layered-graph/contracts';

/** canonical RAG 治理谓词集合（is_a/part_of/has_component/…/association）。 */
export const KONLING_ENGINEERING_RAG_PREDICATE_ALLOWLIST: readonly string[] =
  RAG_SUPPORTED_PREDICATES;

export const KONLING_ENGINEERING_NEIGHBORHOOD_MAX_ENTRIES = 12;

export interface KonlingEngineeringNeighborhoodEntry {
  relationId: string;
  predicate: string;
  /** outgoing = 焦点节点 → 邻居；incoming = 邻居 → 焦点节点。 */
  direction: 'outgoing' | 'incoming';
  focusCanonicalId: string;
  neighborCanonicalId: string;
  neighborLabel: string | null;
}

export interface KonlingEngineeringNeighborhood {
  status: 'ready' | 'unavailable';
  /** 工程域 provenance：与教学投影 projectionId 分域。 */
  authorityReleaseId: string | null;
  entries: KonlingEngineeringNeighborhoodEntry[];
  truncatedCount: number;
  predicateAllowlist: readonly string[];
  reasons: string[];
}

export function buildKonlingEngineeringNeighborhood(input: {
  payload: LayeredGraphPayload | null | undefined;
  focusCanonicalIds: readonly string[];
  maxEntries?: number;
  predicateAllowlist?: readonly string[];
}): KonlingEngineeringNeighborhood {
  const allowlist = input.predicateAllowlist ?? KONLING_ENGINEERING_RAG_PREDICATE_ALLOWLIST;
  const allowed = new Set(allowlist);
  const maxEntries = input.maxEntries ?? KONLING_ENGINEERING_NEIGHBORHOOD_MAX_ENTRIES;
  const payload = input.payload;

  if (!payload || payload.engineering.identity.status !== 'ready') {
    return {
      status: 'unavailable',
      authorityReleaseId: payload?.engineering.identity.authorityReleaseId ?? null,
      entries: [],
      truncatedCount: 0,
      predicateAllowlist: allowlist,
      reasons: [
        !payload
          ? 'engineering-layer-payload-missing'
          : `engineering-layer-${payload.engineering.identity.status}`,
      ],
    };
  }

  const focus = new Set(input.focusCanonicalIds);
  if (focus.size === 0) {
    return {
      status: 'unavailable',
      authorityReleaseId: payload.engineering.identity.authorityReleaseId,
      entries: [],
      truncatedCount: 0,
      predicateAllowlist: allowlist,
      reasons: ['engineering-focus-canonical-ids-empty'],
    };
  }

  const labels = new Map(
    payload.engineering.nodes.map((node) => [node.canonicalId, node.semanticName]),
  );
  const entries: KonlingEngineeringNeighborhoodEntry[] = [];
  for (const relation of payload.engineering.relations) {
    if (!allowed.has(relation.relationType)) continue;
    const sourceFocused = focus.has(relation.sourceId);
    const targetFocused = focus.has(relation.targetId);
    if (!sourceFocused && !targetFocused) continue;
    // 自环仅在显式允许的谓词上保留一次（outgoing 视角）。
    if (sourceFocused && relation.sourceId === relation.targetId) {
      entries.push({
        relationId: relation.relationId,
        predicate: relation.relationType,
        direction: 'outgoing',
        focusCanonicalId: relation.sourceId,
        neighborCanonicalId: relation.targetId,
        neighborLabel: labels.get(relation.targetId) ?? null,
      });
      continue;
    }
    if (sourceFocused) {
      entries.push({
        relationId: relation.relationId,
        predicate: relation.relationType,
        direction: 'outgoing',
        focusCanonicalId: relation.sourceId,
        neighborCanonicalId: relation.targetId,
        neighborLabel: labels.get(relation.targetId) ?? null,
      });
    }
    if (targetFocused) {
      entries.push({
        relationId: relation.relationId,
        predicate: relation.relationType,
        direction: 'incoming',
        focusCanonicalId: relation.targetId,
        neighborCanonicalId: relation.sourceId,
        neighborLabel: labels.get(relation.sourceId) ?? null,
      });
    }
  }

  entries.sort((left, right) => (
    left.relationId < right.relationId ? -1 : left.relationId > right.relationId ? 1 : 0
  ));
  const truncatedCount = Math.max(0, entries.length - maxEntries);

  return {
    status: 'ready',
    authorityReleaseId: payload.engineering.identity.authorityReleaseId,
    entries: entries.slice(0, maxEntries),
    truncatedCount,
    predicateAllowlist: allowlist,
    reasons: entries.length > 0 ? ['engineering-neighborhood-entries'] : ['engineering-neighborhood-empty'],
  };
}

/** 有界工程邻域 grounding 行（工程域自证，不与教学投影证据混排）。 */
export function buildKonlingEngineeringNeighborhoodGroundingLines(
  neighborhood: KonlingEngineeringNeighborhood | null | undefined,
  maxLines = KONLING_ENGINEERING_NEIGHBORHOOD_MAX_ENTRIES,
): string[] {
  if (!neighborhood) return [];
  if (neighborhood.status !== 'ready') {
    return [
      `engineering-graph:status=unavailable reason=${neighborhood.reasons[0] ?? 'unknown'}`,
    ];
  }
  const lines = [
    `engineering-graph:status=ready authorityReleaseId=${neighborhood.authorityReleaseId ?? 'unknown'} entries=${neighborhood.entries.length} truncated=${neighborhood.truncatedCount}`,
  ];
  for (const entry of neighborhood.entries.slice(0, maxLines)) {
    const arrow = entry.direction === 'outgoing' ? '-->' : '<--';
    lines.push(
      `${entry.focusCanonicalId} ${arrow}[${entry.predicate}] ${entry.neighborCanonicalId}${entry.neighborLabel ? ` (${entry.neighborLabel})` : ''} rel=${entry.relationId}`,
    );
  }
  return lines;
}

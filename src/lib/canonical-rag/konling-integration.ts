/**
 * Konling composed RAG shadow diagnostic (#2047).
 *
 * The Legacy TextbookV2 retrieval keeps serving the answer foreground. The
 * composed canonical RAG (engineering + teaching-resource domains over the
 * layered payload corpora) runs alongside as a REAL data path: under the
 * composed production dial its citations merge into the answer; under the
 * legacy dial it stays shadow-only and records comparison metrics.
 *
 * The previous #1112 shadow entry (KonlingCanonicalRagShadowContext +
 * runKonlingCanonicalRagShadowDiagnostic) required the version-bound
 * crosswalk evidence set that no production caller could supply — dead code.
 * It was removed in #2047 and replaced by this composed path; the offline
 * harness (`runLegacyProductionWithCanonicalShadow`) stays for fixture
 * tests and must not drive the live runtime.
 */

import type { TextbookV2ToolResult } from '@/lib/source-pack/textbook-v2-adapter';

import type { RagAuthoritySelector } from './contracts';
import type { ComposedRagResult } from './domain-composition';

export interface ProductionForegroundIdentity {
  structuralUnitIds: string[];
  citationKeys: string[];
}

/**
 * Extract stable production identities from the real TextbookV2 foreground.
 * These are the only production IDs allowed in the diagnostic comparison.
 */
export function extractProductionForegroundIdentities(
  foreground: TextbookV2ToolResult,
): ProductionForegroundIdentity {
  const structuralUnitIds = uniqueSorted(
    foreground.candidates.map((candidate) => candidate.identity.unitId),
  );
  const citationKeys = uniqueSorted(
    foreground.candidates.map((candidate) => [
      candidate.identity.kind,
      candidate.identity.unitId,
      candidate.identity.fragmentId ?? '',
    ].join(':')),
  );
  return { structuralUnitIds, citationKeys };
}

export interface KonlingComposedRagShadowDiagnostic {
  enabled: true;
  /** 生产权威拨盘快照（切换/回滚态随样本记录）。 */
  productionChannel: 'legacy' | 'canonical-composed';
  productionAuthorityMode: 'LEGACY' | 'CANONICAL';
  /** LEGACY 前台结构单元身份（影子运行不得改动生产结果）。 */
  productionStructuralUnitIds: string[];
  /** composed 教学域命中且与教学投影 linkedResources 相交的资源（召回面）。 */
  sharedTeachingResourceIds: string[];
  /** composed 命中但不在 linkedResources 中的资源（检索扩展面）。 */
  onlyInComposedResourceIds: string[];
  teaching: {
    availability: string;
    hitCount: number;
    reasons: string[];
  };
  engineering: {
    availability: string;
    hitCount: number;
    reasons: string[];
  };
  /** composed 教学域命中经服务端解析为安全 href 的比例（引用可验证率）。 */
  teachingCitationVerifiableRate: number | null;
  latencyMs: number;
}

/**
 * Compare the composed canonical RAG result with the actual production
 * foreground identities and the teaching projection link set. Pure: never
 * re-runs production retrieval and never mutates any input.
 */
export function runKonlingComposedRagShadowDiagnostic(input: {
  productionForeground: TextbookV2ToolResult;
  composed: ComposedRagResult;
  linkedResourceIds: readonly string[];
  productionAuthority: RagAuthoritySelector;
  resolvedTeachingCitationIds?: readonly string[] | null;
  now?: () => number;
}): KonlingComposedRagShadowDiagnostic {
  const now = input.now ?? (() => performance.now());
  const started = now();

  const production = extractProductionForegroundIdentities(input.productionForeground);
  const linked = new Set(input.linkedResourceIds);
  const teachingHits = input.composed.teaching.hits;
  const hitResourceIds = uniqueSorted(teachingHits.map((hit) => hit.resourceId));
  const sharedTeachingResourceIds = hitResourceIds.filter((id) => linked.has(id));
  const onlyInComposedResourceIds = hitResourceIds.filter((id) => !linked.has(id));

  const resolvedIds = new Set(input.resolvedTeachingCitationIds ?? []);
  const resolvable = teachingHits.filter((hit) => resolvedIds.has(hit.resourceId));

  const totalMs = Math.max(0, Math.round((now() - started) * 1000) / 1000);

  return {
    enabled: true,
    productionChannel: input.productionAuthority.consumer === 'PRODUCTION_ANSWER'
      && input.productionAuthority.authority === 'CANONICAL'
      ? 'canonical-composed'
      : 'legacy',
    productionAuthorityMode: input.productionAuthority.authority === 'CANONICAL'
      ? 'CANONICAL'
      : 'LEGACY',
    productionStructuralUnitIds: production.structuralUnitIds,
    sharedTeachingResourceIds,
    onlyInComposedResourceIds,
    teaching: {
      availability: input.composed.teaching.metadata.availability,
      hitCount: input.composed.teaching.metadata.hitCount,
      reasons: input.composed.teaching.metadata.reasons,
    },
    engineering: {
      availability: input.composed.engineering.metadata.availability,
      hitCount: input.composed.engineering.metadata.hitCount,
      reasons: input.composed.engineering.metadata.reasons,
    },
    teachingCitationVerifiableRate: teachingHits.length > 0
      ? Math.round((resolvable.length / teachingHits.length) * 1000) / 1000
      : null,
    latencyMs: totalMs,
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

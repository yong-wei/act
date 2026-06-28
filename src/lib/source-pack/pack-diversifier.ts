import type {
  SourcePackItem,
  SourcePackLimitation,
  SourcePackModality,
  SourcePackSourceKind,
} from './types';
import type { RankedSourcePackCandidate } from './pack-ranker';
import type { SourcePackRetrievalProfile } from './retrieval-profiles';

export interface DiversifySourcePackInput {
  ranked: readonly RankedSourcePackCandidate[];
  profile: SourcePackRetrievalProfile;
  topK?: number;
}

export interface DiversifySourcePackResult {
  items: SourcePackItem[];
  limitations: SourcePackLimitation[];
  omittedCount: number;
}

export function diversifyRankedSourcePackItems(input: DiversifySourcePackInput): DiversifySourcePackResult {
  const limit = Math.min(input.topK ?? input.profile.budgets.maxItems, input.profile.budgets.maxItems);
  const sourceKindCounts = new Map<SourcePackSourceKind, number>();
  const modalityCounts = new Map<SourcePackModality, number>();
  const resourceCounts = new Map<string, number>();
  const citationCounts = new Map<string, number>();
  const items: SourcePackItem[] = [];
  const limitations: SourcePackLimitation[] = [];
  let omittedCount = 0;

  for (const candidate of input.ranked) {
    if (items.length >= limit) {
      omittedCount += 1;
      continue;
    }
    const item = truncateItemExcerpt(candidate.item, input.profile.budgets.maxExcerptChars, limitations);
    const resourceKey = item.resourceNodeId ?? item.planningUnitId ?? item.retrievalChunkId ?? item.id;
    const citationKey = item.citationTargetId ?? item.citation?.citationTargetId;
    const blockedReason = firstDiversityBlock({
      item,
      sourceKindCounts,
      modalityCounts,
      resourceCounts,
      citationCounts,
      resourceKey,
      citationKey,
      profile: input.profile,
    });
    if (blockedReason) {
      omittedCount += 1;
      limitations.push(buildLimitation(`diversity-${blockedReason}`, `Candidate ${item.id} was omitted by ${blockedReason} diversity budget.`));
      continue;
    }
    increment(sourceKindCounts, item.sourceKind);
    increment(modalityCounts, item.modality);
    increment(resourceCounts, resourceKey);
    if (citationKey) increment(citationCounts, citationKey);
    items.push(item);
  }

  if (omittedCount > 0) {
    limitations.push(buildLimitation('source-pack-omitted-candidates', `${omittedCount} eligible candidate(s) were omitted by pack size or diversity budgets.`));
  }
  return { items, limitations, omittedCount };
}

function firstDiversityBlock(input: {
  item: SourcePackItem;
  sourceKindCounts: Map<SourcePackSourceKind, number>;
  modalityCounts: Map<SourcePackModality, number>;
  resourceCounts: Map<string, number>;
  citationCounts: Map<string, number>;
  resourceKey: string;
  citationKey?: string;
  profile: SourcePackRetrievalProfile;
}): string | null {
  const budgets = input.profile.budgets;
  if ((input.sourceKindCounts.get(input.item.sourceKind) ?? 0) >= budgets.maxPerSourceKind) return 'source-kind';
  if ((input.modalityCounts.get(input.item.modality) ?? 0) >= budgets.maxPerModality) return 'modality';
  if ((input.resourceCounts.get(input.resourceKey) ?? 0) >= budgets.maxPerResource) return 'resource';
  if (input.citationKey && (input.citationCounts.get(input.citationKey) ?? 0) >= budgets.maxPerCitationTarget) return 'citation-target';
  return null;
}

function truncateItemExcerpt(
  item: SourcePackItem,
  maxExcerptChars: number,
  limitations: SourcePackLimitation[],
): SourcePackItem {
  if (item.excerpt.length <= maxExcerptChars) return item;
  limitations.push(buildLimitation('source-pack-excerpt-truncated', `Excerpt for ${item.id} was truncated to ${maxExcerptChars} characters.`));
  return {
    ...item,
    excerpt: `${item.excerpt.slice(0, Math.max(0, maxExcerptChars - 3)).trimEnd()}...`,
  };
}

function increment<TKey>(map: Map<TKey, number>, key: TKey): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildLimitation(code: string, message: string): SourcePackLimitation {
  return {
    code,
    severity: 'info',
    message,
    source: 'source-pack.diversifier',
    recoverable: true,
  };
}

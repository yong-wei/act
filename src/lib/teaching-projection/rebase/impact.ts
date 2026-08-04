/**
 * Deterministic ACT impact-set calculator from Delta change events (#1272).
 *
 * Rules:
 * - Unbound additions → zero teaching review
 * - Direct dependency expansion only (bindings/cards/prereqs/resources/textbook)
 * - Engineering relations without bound endpoints → ENGINEERING_ONLY
 * - Label/alias → INDEX_REBUILD
 * - Single compatible successor → AUTO_REBASE_CANDIDATE for ordinary bindings
 * - Split/merge/no-successor/type-incompatible → REVIEW_REQUIRED
 */

import type {
  TeachingBindingRuntime,
  TeachingCardIndexEntry,
  TeachingCoreNodeRuntime,
  TeachingPrerequisiteRuntime,
  TeachingProjectionArtifacts,
  TeachingResourceRuntime,
} from '../contracts';
import {
  ACT_TEACHING_PROJECTION_IMPACT_SET_CONTRACT,
  ACT_TEACHING_PROJECTION_REBASE_ENGINE_VERSION,
  type ActDeltaChangeEvent,
  type ActDeltaImpactCategory,
  type ActImpactDisposition,
  type ActImpactItem,
  type ActTeachingProjectionImpactSet,
  TeachingProjectionRebaseError,
} from './contracts';
import { digestActDeltaChangeEvents } from './delta-inventory';

export interface ImpactProjectionView {
  resources: readonly TeachingResourceRuntime[];
  bindings: readonly TeachingBindingRuntime[];
  prerequisites: readonly TeachingPrerequisiteRuntime[];
  coreNodes: readonly TeachingCoreNodeRuntime[];
  cards: readonly TeachingCardIndexEntry[];
  projectionId?: string | null;
  scopeId?: string | null;
}

export interface ComputeActImpactSetInput {
  changes: readonly ActDeltaChangeEvent[];
  projection: ImpactProjectionView;
  authorityReleaseId: string;
  baseAuthorityReleaseId?: string | null;
  /**
   * Delta output digest. When omitted, digests the change events
   * (fixtures / pure unit tests).
   */
  deltaOutputDigest?: string;
  /** Consumer package id for per-package REVIEW_REQUIRED. */
  packageId?: string;
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortItems(items: ActImpactItem[]): ActImpactItem[] {
  return [...items].sort((a, b) => {
    const byKind = compareCodePoint(a.subjectKind, b.subjectKind);
    if (byKind !== 0) return byKind;
    const byId = compareCodePoint(a.subjectId, b.subjectId);
    if (byId !== 0) return byId;
    const byCat = compareCodePoint(a.category, b.category);
    if (byCat !== 0) return byCat;
    return compareCodePoint(a.disposition, b.disposition);
  });
}

function itemKey(item: ActImpactItem): string {
  return [
    item.packageId,
    item.subjectKind,
    item.subjectId,
    item.category,
    item.disposition,
    item.deltaIdentity,
  ].join('\u001f');
}

/**
 * AUTO_REBASE requires proven type compatibility: both base and candidate
 * types must be present and equal. Missing type evidence fails closed to
 * REVIEW_REQUIRED (ReleaseSet Delta details only carry IDs by default).
 */
function isTypeCompatible(change: ActDeltaChangeEvent): boolean {
  const base = change.baseType ?? null;
  const cand = change.candidateType ?? null;
  if (base == null || cand == null) {
    return false;
  }
  return base === cand;
}

function isSuccessorAutoRebaseCategory(category: ActDeltaImpactCategory): boolean {
  return category === 'REPLACED_BY' || category === 'DEPRECATED';
}

function isHardReviewCategory(category: ActDeltaImpactCategory): boolean {
  return (
    category === 'SPLIT'
    || category === 'MERGED'
    || category === 'REMOVED_WITHOUT_SUCCESSOR'
    || category === 'TYPE_CHANGED'
  );
}

function isRelationCategory(category: ActDeltaImpactCategory): boolean {
  return (
    category === 'RELATION_ADDED'
    || category === 'RELATION_CHANGED'
    || category === 'RELATION_RETIRED'
  );
}

function isSourceCategory(category: ActDeltaImpactCategory): boolean {
  return category === 'SOURCE_ANCHOR_CHANGED' || category === 'SOURCE_DOCUMENT_CHANGED';
}

function isTextbookResource(resource: TeachingResourceRuntime): boolean {
  return resource.resourceType === 'textbook' || resource.resourceType === 'textbook-section';
}

function textbookMatchesSource(
  resource: TeachingResourceRuntime,
  change: ActDeltaChangeEvent,
): boolean {
  if (!isTextbookResource(resource)) return false;
  const doc = change.sourceDocumentId ?? change.identity;
  const section = change.sectionId ?? null;
  // Resource IDs: act:textbook:<doc> / act:textbook-section:<section>
  if (resource.resourceType === 'textbook') {
    return resource.resourceId === `act:textbook:${doc}` || resource.resourceId.endsWith(`:${doc}`);
  }
  if (section) {
    return (
      resource.resourceId === `act:textbook-section:${section}`
      || resource.resourceId.endsWith(`:${section}`)
    );
  }
  // Section without explicit sectionId: match source path / id contains document id.
  return (
    resource.resourceId.includes(doc)
    || (resource.sourcePath != null && resource.sourcePath.includes(doc))
  );
}

function pushUnique(items: ActImpactItem[], item: ActImpactItem, seen: Set<string>): void {
  const key = itemKey(item);
  if (seen.has(key)) return;
  seen.add(key);
  items.push(item);
}

function buildIndexes(projection: ImpactProjectionView) {
  const bindingsByCanonical = new Map<string, TeachingBindingRuntime[]>();
  const cardsByCanonical = new Map<string, TeachingCardIndexEntry[]>();
  const prereqsByCanonical = new Map<string, TeachingPrerequisiteRuntime[]>();
  const coreByCanonical = new Map<string, TeachingCoreNodeRuntime>();
  const resourcesById = new Map(projection.resources.map((r) => [r.resourceId, r]));

  for (const binding of projection.bindings) {
    const list = bindingsByCanonical.get(binding.canonicalId) ?? [];
    list.push(binding);
    bindingsByCanonical.set(binding.canonicalId, list);
  }
  for (const card of projection.cards) {
    const list = cardsByCanonical.get(card.canonicalId) ?? [];
    list.push(card);
    cardsByCanonical.set(card.canonicalId, list);
  }
  for (const edge of projection.prerequisites) {
    for (const canonicalId of [edge.sourceCanonicalId, edge.targetCanonicalId]) {
      const list = prereqsByCanonical.get(canonicalId) ?? [];
      list.push(edge);
      prereqsByCanonical.set(canonicalId, list);
    }
  }
  for (const core of projection.coreNodes) {
    coreByCanonical.set(core.canonicalId, core);
  }

  const boundCanonicalIds = new Set<string>([
    ...bindingsByCanonical.keys(),
    ...cardsByCanonical.keys(),
    ...prereqsByCanonical.keys(),
    ...coreByCanonical.keys(),
  ]);

  return {
    bindingsByCanonical,
    cardsByCanonical,
    prereqsByCanonical,
    coreByCanonical,
    resourcesById,
    boundCanonicalIds,
  };
}

function relatedIdsForCanonical(
  canonicalId: string,
  indexes: ReturnType<typeof buildIndexes>,
): {
  relatedResourceIds: string[];
  relatedBindingIds: string[];
  relatedCardIds: string[];
  relatedPrerequisiteIds: string[];
} {
  const bindings = indexes.bindingsByCanonical.get(canonicalId) ?? [];
  const cards = indexes.cardsByCanonical.get(canonicalId) ?? [];
  const prereqs = indexes.prereqsByCanonical.get(canonicalId) ?? [];
  const resourceIds = [
    ...new Set(bindings.map((b) => b.resourceId)),
    ...new Set(cards.map((c) => c.resourceId)),
  ].sort(compareCodePoint);
  return {
    relatedResourceIds: resourceIds,
    relatedBindingIds: bindings.map((b) => b.bindingId).sort(compareCodePoint),
    relatedCardIds: cards.map((c) => c.cardId).sort(compareCodePoint),
    relatedPrerequisiteIds: [
      ...new Set(prereqs.map((p) => p.prerequisiteId)),
    ].sort(compareCodePoint),
  };
}

/**
 * Compute the deterministic ACT impact set for one package/projection.
 */
export function computeActTeachingProjectionImpactSet(
  input: ComputeActImpactSetInput,
): ActTeachingProjectionImpactSet {
  if (!input.authorityReleaseId || input.authorityReleaseId.trim().length === 0) {
    throw new TeachingProjectionRebaseError(
      'schema-invalid',
      'authorityReleaseId is required for impact calculation',
    );
  }

  const packageId = input.packageId
    ?? input.projection.scopeId
    ?? 'default';
  const indexes = buildIndexes(input.projection);
  const items: ActImpactItem[] = [];
  const seen = new Set<string>();

  for (const change of input.changes) {
    // --- Relations: engineering-only unless endpoints are bound ---
    if (isRelationCategory(change.category)) {
      const endpoints = [
        change.relationSourceId,
        change.relationTargetId,
      ].filter((v): v is string => typeof v === 'string' && v.length > 0);
      const boundEndpoints = endpoints.filter((id) => indexes.boundCanonicalIds.has(id));
      if (boundEndpoints.length === 0) {
        pushUnique(items, {
          packageId,
          subjectKind: 'relation',
          subjectId: change.identity,
          canonicalId: null,
          category: change.category,
          disposition: 'ENGINEERING_ONLY',
          deltaIdentity: change.deltaIdentity,
          relatedResourceIds: [],
          relatedBindingIds: [],
          relatedCardIds: [],
          relatedPrerequisiteIds: [],
          successors: change.successors,
          predecessors: change.predecessors,
          detail: 'engineering relation with no ACT-bound endpoints',
        }, seen);
        continue;
      }
      // Bound endpoints: expand direct dependents only.
      for (const canonicalId of boundEndpoints) {
        expandCanonicalChange({
          change: { ...change, identity: canonicalId },
          packageId,
          indexes,
          items,
          seen,
          forceReview: change.category === 'RELATION_RETIRED' || change.category === 'RELATION_CHANGED',
        });
      }
      continue;
    }

    // --- Source / textbook locators ---
    if (isSourceCategory(change.category)) {
      const matched = input.projection.resources.filter((r) => textbookMatchesSource(r, change));
      if (matched.length === 0) {
        pushUnique(items, {
          packageId,
          subjectKind: 'textbook-locator',
          subjectId: change.identity,
          canonicalId: null,
          category: change.category,
          disposition: 'NO_REVIEW',
          deltaIdentity: change.deltaIdentity,
          relatedResourceIds: [],
          relatedBindingIds: [],
          relatedCardIds: [],
          relatedPrerequisiteIds: [],
          successors: change.successors,
          predecessors: change.predecessors,
          detail: 'source change with no matching textbook resource in projection',
        }, seen);
        continue;
      }
      for (const resource of matched) {
        const bindings = input.projection.bindings.filter((b) => b.resourceId === resource.resourceId);
        pushUnique(items, {
          packageId,
          subjectKind: 'textbook-locator',
          subjectId: resource.resourceId,
          canonicalId: bindings[0]?.canonicalId ?? null,
          category: change.category,
          disposition: 'REVIEW_REQUIRED',
          deltaIdentity: change.deltaIdentity,
          relatedResourceIds: [resource.resourceId],
          relatedBindingIds: bindings.map((b) => b.bindingId).sort(compareCodePoint),
          relatedCardIds: [],
          relatedPrerequisiteIds: [],
          successors: change.successors,
          predecessors: change.predecessors,
          detail: `textbook locator affected by ${change.category}`,
        }, seen);
        pushUnique(items, {
          packageId,
          subjectKind: 'resource',
          subjectId: resource.resourceId,
          canonicalId: bindings[0]?.canonicalId ?? null,
          category: change.category,
          disposition: 'REVIEW_REQUIRED',
          deltaIdentity: change.deltaIdentity,
          relatedResourceIds: [resource.resourceId],
          relatedBindingIds: bindings.map((b) => b.bindingId).sort(compareCodePoint),
          relatedCardIds: [],
          relatedPrerequisiteIds: [],
          successors: change.successors,
          predecessors: change.predecessors,
          detail: `resource impacted by ${change.category}`,
        }, seen);
      }
      continue;
    }

    // --- ADDED unbound engineering nodes ---
    if (change.category === 'ADDED') {
      if (!indexes.boundCanonicalIds.has(change.identity)) {
        pushUnique(items, {
          packageId,
          subjectKind: 'authority-node',
          subjectId: change.identity,
          canonicalId: change.identity,
          category: 'ADDED',
          disposition: 'NO_REVIEW',
          deltaIdentity: change.deltaIdentity,
          relatedResourceIds: [],
          relatedBindingIds: [],
          relatedCardIds: [],
          relatedPrerequisiteIds: [],
          successors: change.successors,
          predecessors: change.predecessors,
          detail: 'unbound engineering addition; zero ACT teaching review',
        }, seen);
        continue;
      }
      // Bound additions (unusual: same ID already projected) → metadata path
      expandCanonicalChange({
        change,
        packageId,
        indexes,
        items,
        seen,
        forceReview: false,
      });
      continue;
    }

    // --- Label / alias only ---
    if (change.category === 'LABEL_ALIAS_CHANGED' || change.labelAliasOnly === true) {
      if (!indexes.boundCanonicalIds.has(change.identity)) {
        pushUnique(items, {
          packageId,
          subjectKind: 'authority-node',
          subjectId: change.identity,
          canonicalId: change.identity,
          category: 'LABEL_ALIAS_CHANGED',
          disposition: 'NO_REVIEW',
          deltaIdentity: change.deltaIdentity,
          relatedResourceIds: [],
          relatedBindingIds: [],
          relatedCardIds: [],
          relatedPrerequisiteIds: [],
          successors: change.successors,
          predecessors: change.predecessors,
          detail: 'unbound label/alias change',
        }, seen);
        continue;
      }
      const related = relatedIdsForCanonical(change.identity, indexes);
      pushUnique(items, {
        packageId,
        subjectKind: 'authority-node',
        subjectId: change.identity,
        canonicalId: change.identity,
        category: 'LABEL_ALIAS_CHANGED',
        disposition: 'INDEX_REBUILD',
        deltaIdentity: change.deltaIdentity,
        ...related,
        successors: change.successors,
        predecessors: change.predecessors,
        detail: 'label/alias rebuild; binding identity unchanged',
      }, seen);
      for (const resourceId of related.relatedResourceIds) {
        pushUnique(items, {
          packageId,
          subjectKind: 'resource',
          subjectId: resourceId,
          canonicalId: change.identity,
          category: 'LABEL_ALIAS_CHANGED',
          disposition: 'INDEX_REBUILD',
          deltaIdentity: change.deltaIdentity,
          ...related,
          successors: change.successors,
          predecessors: change.predecessors,
          detail: 'resource display index rebuild',
        }, seen);
      }
      continue;
    }

    // --- Canonical node changes with direct expansion ---
    expandCanonicalChange({
      change,
      packageId,
      indexes,
      items,
      seen,
      forceReview: false,
    });
  }

  const sorted = sortItems(items);
  const teachingReviewItemCount = sorted.filter((i) =>
    i.disposition === 'REVIEW_REQUIRED'
    || i.disposition === 'LOCAL_CHECK'
    || i.disposition === 'AUTO_REBASE_CANDIDATE'
  ).length;

  return {
    contract: ACT_TEACHING_PROJECTION_IMPACT_SET_CONTRACT,
    engineVersion: ACT_TEACHING_PROJECTION_REBASE_ENGINE_VERSION,
    deltaOutputDigest: input.deltaOutputDigest ?? digestActDeltaChangeEvents(input.changes),
    authorityReleaseId: input.authorityReleaseId,
    baseAuthorityReleaseId: input.baseAuthorityReleaseId ?? null,
    projectionId: input.projection.projectionId ?? null,
    packageId,
    changes: [...input.changes],
    items: sorted,
    summary: {
      teachingReviewItemCount,
      unboundAdditionCount: sorted.filter((i) => i.disposition === 'NO_REVIEW' && i.category === 'ADDED').length,
      autoRebaseCandidateCount: sorted.filter((i) => i.disposition === 'AUTO_REBASE_CANDIDATE').length,
      reviewRequiredCount: sorted.filter((i) => i.disposition === 'REVIEW_REQUIRED').length,
      localCheckCount: sorted.filter((i) => i.disposition === 'LOCAL_CHECK').length,
      indexRebuildCount: sorted.filter((i) => i.disposition === 'INDEX_REBUILD').length,
      engineeringOnlyCount: sorted.filter((i) => i.disposition === 'ENGINEERING_ONLY').length,
      changeEventCount: input.changes.length,
    },
  };
}

function expandCanonicalChange(args: {
  change: ActDeltaChangeEvent;
  packageId: string;
  indexes: ReturnType<typeof buildIndexes>;
  items: ActImpactItem[];
  seen: Set<string>;
  forceReview: boolean;
}): void {
  const { change, packageId, indexes, items, seen, forceReview } = args;
  const canonicalId = change.identity;
  const bound = indexes.boundCanonicalIds.has(canonicalId);
  const related = relatedIdsForCanonical(canonicalId, indexes);

  if (!bound) {
    // Unbound non-added categories still produce no teaching review denominator.
    pushUnique(items, {
      packageId,
      subjectKind: 'authority-node',
      subjectId: canonicalId,
      canonicalId,
      category: change.category,
      disposition: 'NO_REVIEW',
      deltaIdentity: change.deltaIdentity,
      relatedResourceIds: [],
      relatedBindingIds: [],
      relatedCardIds: [],
      relatedPrerequisiteIds: [],
      successors: change.successors,
      predecessors: change.predecessors,
      detail: `unbound ${change.category}; outside ACT review denominator`,
    }, seen);
    return;
  }

  const singleSuccessor =
    change.successors.length === 1
    && isSuccessorAutoRebaseCategory(change.category)
    && isTypeCompatible(change)
    && !forceReview
    && !isHardReviewCategory(change.category);

  const hardReview =
    forceReview
    || isHardReviewCategory(change.category)
    || (isSuccessorAutoRebaseCategory(change.category) && (
      change.successors.length !== 1 || !isTypeCompatible(change)
    ))
    || change.category === 'METADATA_CHANGED';

  // METADATA_CHANGED on bound nodes: direct dependents enter impact for inspection.
  // Ordinary bindings with pure metadata (not type/successor) stay INDEX_REBUILD if
  // no semantic successor path; otherwise REVIEW when force/hard.

  let bindingDisposition: ActImpactDisposition;
  if (singleSuccessor) {
    bindingDisposition = 'AUTO_REBASE_CANDIDATE';
  } else if (change.category === 'METADATA_CHANGED' && !forceReview) {
    // Bound metadata without type/successor ambiguity → local rebuild of dependent display, not full re-author.
    bindingDisposition = 'INDEX_REBUILD';
  } else if (hardReview) {
    bindingDisposition = 'REVIEW_REQUIRED';
  } else {
    bindingDisposition = 'REVIEW_REQUIRED';
  }

  // Authority node diagnostic row
  pushUnique(items, {
    packageId,
    subjectKind: 'authority-node',
    subjectId: canonicalId,
    canonicalId,
    category: change.category,
    disposition: bindingDisposition === 'AUTO_REBASE_CANDIDATE'
      ? 'AUTO_REBASE_CANDIDATE'
      : hardReview
        ? 'REVIEW_REQUIRED'
        : bindingDisposition,
    deltaIdentity: change.deltaIdentity,
    ...related,
    successors: change.successors,
    predecessors: change.predecessors,
    detail: `bound authority node ${change.category}`,
  }, seen);

  const bindings = indexes.bindingsByCanonical.get(canonicalId) ?? [];
  for (const binding of bindings) {
    pushUnique(items, {
      packageId,
      subjectKind: 'binding',
      subjectId: binding.bindingId,
      canonicalId,
      category: change.category,
      disposition: bindingDisposition,
      deltaIdentity: change.deltaIdentity,
      ...related,
      successors: change.successors,
      predecessors: change.predecessors,
      detail: singleSuccessor
        ? `ordinary binding auto-rebase candidate → ${change.successors[0]}`
        : `binding impacted by ${change.category}`,
    }, seen);

    pushUnique(items, {
      packageId,
      subjectKind: 'resource',
      subjectId: binding.resourceId,
      canonicalId,
      category: change.category,
      disposition: bindingDisposition === 'AUTO_REBASE_CANDIDATE'
        ? 'AUTO_REBASE_CANDIDATE'
        : bindingDisposition,
      deltaIdentity: change.deltaIdentity,
      ...related,
      successors: change.successors,
      predecessors: change.predecessors,
      detail: `resource bound to ${canonicalId}`,
    }, seen);
  }

  const cards = indexes.cardsByCanonical.get(canonicalId) ?? [];
  for (const card of cards) {
    // Cards always get local inspection when successor moves; hard review otherwise.
    const cardDisposition: ActImpactDisposition = singleSuccessor
      ? 'LOCAL_CHECK'
      : 'REVIEW_REQUIRED';
    pushUnique(items, {
      packageId,
      subjectKind: 'card',
      subjectId: card.cardId,
      canonicalId,
      category: change.category,
      disposition: cardDisposition,
      deltaIdentity: change.deltaIdentity,
      ...related,
      successors: change.successors,
      predecessors: change.predecessors,
      detail: singleSuccessor
        ? 'card local check after successor rebase'
        : `card impacted by ${change.category}`,
    }, seen);
  }

  const prereqs = indexes.prereqsByCanonical.get(canonicalId) ?? [];
  const seenPrereq = new Set<string>();
  for (const edge of prereqs) {
    if (seenPrereq.has(edge.prerequisiteId)) continue;
    seenPrereq.add(edge.prerequisiteId);
    const prereqDisposition: ActImpactDisposition = singleSuccessor
      ? 'LOCAL_CHECK'
      : 'REVIEW_REQUIRED';
    pushUnique(items, {
      packageId,
      subjectKind: 'prerequisite',
      subjectId: edge.prerequisiteId,
      canonicalId,
      category: change.category,
      disposition: prereqDisposition,
      deltaIdentity: change.deltaIdentity,
      ...related,
      successors: change.successors,
      predecessors: change.predecessors,
      detail: singleSuccessor
        ? 'prerequisite local check after successor rebase'
        : `prerequisite impacted by ${change.category}`,
    }, seen);
  }

  const core = indexes.coreByCanonical.get(canonicalId);
  if (core) {
    pushUnique(items, {
      packageId,
      subjectKind: 'core-node',
      subjectId: core.canonicalId,
      canonicalId,
      category: change.category,
      disposition: singleSuccessor ? 'AUTO_REBASE_CANDIDATE' : 'REVIEW_REQUIRED',
      deltaIdentity: change.deltaIdentity,
      ...related,
      successors: change.successors,
      predecessors: change.predecessors,
      detail: `core-node impacted by ${change.category}`,
    }, seen);
  }
}

export function impactSetFromArtifacts(
  artifacts: TeachingProjectionArtifacts,
  input: Omit<ComputeActImpactSetInput, 'projection'> & {
    changes: readonly ActDeltaChangeEvent[];
  },
): ActTeachingProjectionImpactSet {
  return computeActTeachingProjectionImpactSet({
    ...input,
    projection: {
      resources: artifacts.resources,
      bindings: artifacts.bindings,
      prerequisites: artifacts.prerequisites,
      coreNodes: artifacts.coreNodes,
      cards: artifacts.cardsIndex.cards,
      projectionId: artifacts.manifest.projectionId,
      scopeId: artifacts.manifest.scopeId,
    },
  });
}

/**
 * Deterministic active-course resource mapping (#1268).
 *
 * Priority: crosswalk → card → manifest → exact label/alias → author decision.
 * Fuzzy / split / merge / stale / multi-match → REVIEW_REQUIRED.
 */

import type { TeachingProjectionRole } from './contracts';
import { isTeachingProjectionRole } from './identity';
import { projectionDigest } from './hash';
import { normalizeExactLabel } from './legacy-id-policy';
import type {
  ActiveCourseInventoryResource,
  ActiveCardMappingEntry,
  AuthorSemanticDecision,
  AuthorityLabelIndexEntry,
  LegacyIdCrosswalkEntry,
  MappingCandidate,
  MappingContext,
  MappingMethod,
  MigrationStatus,
  MigrationStatusRecord,
  TeachingKnowledgeRefAuthoring,
} from './migration-contracts';

const METHOD_ORDER: MappingMethod[] = [
  'CROSSWALK',
  'CARD',
  'MANIFEST',
  'EXACT_LABEL',
];

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortCandidates(candidates: MappingCandidate[]): MappingCandidate[] {
  return [...candidates].sort((a, b) => {
    const byCanonical = compareCodePoint(a.canonicalId, b.canonicalId);
    if (byCanonical !== 0) return byCanonical;
    const byRole = compareCodePoint(String(a.role ?? ''), String(b.role ?? ''));
    if (byRole !== 0) return byRole;
    return compareCodePoint(a.method, b.method);
  });
}

function uniqueByKey(
  candidates: MappingCandidate[],
): MappingCandidate[] {
  const seen = new Set<string>();
  const out: MappingCandidate[] = [];
  for (const c of sortCandidates(candidates)) {
    // Keep distinct legacyId / label evidence so merge detection still works when
    // multiple legacy ids resolve to the same Canonical under one method.
    const key = [
      c.canonicalId,
      c.role ?? '',
      c.method,
      c.legacyId ?? '',
      c.label ?? '',
      c.evidence,
    ].join('\u001f');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function isUsableCanonical(
  canonicalId: string,
  authorityCanonicalIds: ReadonlySet<string>,
): boolean {
  return authorityCanonicalIds.has(canonicalId);
}

function defaultRoleFor(
  resource: ActiveCourseInventoryResource,
  ctx: MappingContext,
): TeachingProjectionRole {
  if (ctx.defaultRole && isTeachingProjectionRole(ctx.defaultRole)) {
    return ctx.defaultRole;
  }
  switch (resource.resourceType) {
    case 'step':
      return 'PRACTICES';
    case 'handout':
      return 'EXPLAINS';
    case 'lesson':
      return 'COVERS';
    case 'card':
      return 'EXPLAINS';
    case 'textbook':
    case 'textbook-section':
      return 'EXPLAINS';
    default:
      return 'COVERS';
  }
}

function resolveRole(
  explicit: TeachingProjectionRole | null | undefined,
  resource: ActiveCourseInventoryResource,
  ctx: MappingContext,
): TeachingProjectionRole {
  if (explicit && isTeachingProjectionRole(explicit)) return explicit;
  return defaultRoleFor(resource, ctx);
}

/** Digest of mapping inputs that author decisions must pin. */
export function computeMappingInputDigest(
  resource: ActiveCourseInventoryResource,
  candidates: readonly MappingCandidate[],
  authorDecisionContextDigest: string | null = null,
): string {
  return projectionDigest({
    resourceId: resource.resourceId,
    scopeId: resource.scopeId,
    sourceDigest: resource.sourceDigest,
    blueprintPath: resource.blueprintPath ?? null,
    blueprintDigest: resource.blueprintDigest ?? null,
    authorDecisionContextDigest,
    projectionMode: resource.projectionMode,
    legacyIds: [...resource.legacyIds].sort(),
    labels: [...resource.labels].map(normalizeExactLabel).sort(),
    knowledgeRefs: resource.knowledgeRefs.map((r) => ({
      canonicalId: r.canonicalId,
      role: r.role,
    })),
    candidates: candidates.map((c) => ({
      canonicalId: c.canonicalId,
      role: c.role,
      method: c.method,
    })),
  });
}

function collectCrosswalkCandidates(
  resource: ActiveCourseInventoryResource,
  crosswalk: readonly LegacyIdCrosswalkEntry[],
  authorityCanonicalIds: ReadonlySet<string>,
): MappingCandidate[] {
  const byLegacy = new Map<string, LegacyIdCrosswalkEntry[]>();
  for (const entry of crosswalk) {
    const list = byLegacy.get(entry.legacyId) ?? [];
    list.push(entry);
    byLegacy.set(entry.legacyId, list);
  }

  const out: MappingCandidate[] = [];
  for (const legacyId of resource.legacyIds) {
    const rows = byLegacy.get(legacyId) ?? [];
    for (const row of rows) {
      if (row.stale) {
        out.push({
          canonicalId: row.canonicalId,
          role: row.role ?? null,
          method: 'CROSSWALK',
          evidence: `stale-crosswalk:${legacyId}->${row.canonicalId}`,
          legacyId,
        });
        continue;
      }
      if (!isUsableCanonical(row.canonicalId, authorityCanonicalIds)) {
        out.push({
          canonicalId: row.canonicalId,
          role: row.role ?? null,
          method: 'CROSSWALK',
          evidence: `stale-target:${legacyId}->${row.canonicalId}`,
          legacyId,
        });
        continue;
      }
      out.push({
        canonicalId: row.canonicalId,
        role: row.role ?? null,
        method: 'CROSSWALK',
        evidence: `crosswalk:${legacyId}->${row.canonicalId}`,
        legacyId,
      });
    }
  }
  return out;
}

function collectCardCandidates(
  resource: ActiveCourseInventoryResource,
  cards: readonly ActiveCardMappingEntry[],
  authorityCanonicalIds: ReadonlySet<string>,
): MappingCandidate[] {
  const out: MappingCandidate[] = [];
  const activeCards = cards.filter((c) => c.active);

  for (const cardId of resource.cardIds) {
    for (const card of activeCards) {
      if (card.cardId !== cardId) continue;
      if (!isUsableCanonical(card.canonicalId, authorityCanonicalIds)) {
        out.push({
          canonicalId: card.canonicalId,
          role: null,
          method: 'CARD',
          evidence: `card-stale:${card.cardId}->${card.canonicalId}`,
        });
        continue;
      }
      out.push({
        canonicalId: card.canonicalId,
        role: null,
        method: 'CARD',
        evidence: `card:${card.cardId}->${card.canonicalId}`,
      });
    }
  }

  // Card selected for a legacy node associated with this resource.
  for (const legacyId of resource.legacyIds) {
    for (const card of activeCards) {
      if (card.legacyNodeId !== legacyId) continue;
      if (!isUsableCanonical(card.canonicalId, authorityCanonicalIds)) continue;
      out.push({
        canonicalId: card.canonicalId,
        role: null,
        method: 'CARD',
        evidence: `card-legacy:${legacyId}->${card.cardId}->${card.canonicalId}`,
        legacyId,
      });
    }
  }

  return out;
}

function collectManifestCandidates(
  resource: ActiveCourseInventoryResource,
  authorityCanonicalIds: ReadonlySet<string>,
): MappingCandidate[] {
  const out: MappingCandidate[] = [];

  // Explicit authoring knowledgeRefs already on the resource.
  for (const ref of resource.knowledgeRefs) {
    if (!isUsableCanonical(ref.canonicalId, authorityCanonicalIds)) {
      out.push({
        canonicalId: ref.canonicalId,
        role: ref.role,
        method: 'MANIFEST',
        evidence: `manifest-stale-ref:${ref.canonicalId}`,
      });
      continue;
    }
    out.push({
      canonicalId: ref.canonicalId,
      role: ref.role,
      method: 'MANIFEST',
      evidence: `manifest-knowledgeRef:${ref.canonicalId}:${ref.role}`,
    });
  }

  const mk = resource.manifestKnowledge;
  if (!mk) return out;

  for (const canonicalId of mk.canonicalIds ?? []) {
    const role = mk.roles?.[0] ?? null;
    if (!isUsableCanonical(canonicalId, authorityCanonicalIds)) {
      out.push({
        canonicalId,
        role,
        method: 'MANIFEST',
        evidence: `manifest-stale-canonical:${canonicalId}`,
      });
      continue;
    }
    out.push({
      canonicalId,
      role,
      method: 'MANIFEST',
      evidence: `manifest-canonical:${canonicalId}`,
    });
  }

  // Manifest legacy ids alone do not auto-bind without crosswalk/card/label.
  // They contribute only when paired with explicit canonical ids above.

  return out;
}

function collectExactLabelCandidates(
  resource: ActiveCourseInventoryResource,
  authorityLabels: readonly AuthorityLabelIndexEntry[],
  authorityCanonicalIds: ReadonlySet<string>,
): MappingCandidate[] {
  const labelIndex = new Map<string, string[]>();
  for (const entry of authorityLabels) {
    if (!isUsableCanonical(entry.canonicalId, authorityCanonicalIds)) continue;
    const lifecycle = String(entry.lifecycleStatus ?? 'active').toLowerCase();
    if (lifecycle === 'retired' || lifecycle === 'draft') continue;
    for (const label of entry.labels) {
      const key = normalizeExactLabel(label);
      if (!key) continue;
      const list = labelIndex.get(key) ?? [];
      list.push(entry.canonicalId);
      labelIndex.set(key, list);
    }
  }

  const out: MappingCandidate[] = [];
  const labels = [
    ...resource.labels,
    ...(resource.manifestKnowledge?.labels ?? []),
  ];

  for (const label of labels) {
    const key = normalizeExactLabel(label);
    if (!key) continue;
    const hits = [...new Set(labelIndex.get(key) ?? [])];
    for (const canonicalId of hits) {
      out.push({
        canonicalId,
        role: null,
        method: 'EXACT_LABEL',
        evidence: `exact-label:${label}->${canonicalId}`,
        label,
      });
    }
  }
  return out;
}

function findAuthorDecision(
  resource: ActiveCourseInventoryResource,
  inputDigest: string,
  decisions: readonly AuthorSemanticDecision[],
): AuthorSemanticDecision | null {
  const matches = decisions.filter(
    (d) =>
      d.resourceId === resource.resourceId
      && d.scopeId === resource.scopeId
      && d.inputDigest === inputDigest,
  );
  if (matches.length === 1) return matches[0]!;
  return null;
}

function uniqueCanonicals(candidates: MappingCandidate[]): string[] {
  return [...new Set(candidates.map((c) => c.canonicalId))].sort(compareCodePoint);
}

/**
 * Classify candidates for a single method as:
 * - exact one-to-one usable binding
 * - empty
 * - ambiguous (multi canonical, multi role, only stale/fuzzy signals)
 */
function classifyMethodCandidates(
  methodCandidates: MappingCandidate[],
  resource: ActiveCourseInventoryResource,
  ctx: MappingContext,
): {
  kind: 'exact' | 'empty' | 'ambiguous';
  bindings: TeachingKnowledgeRefAuthoring[];
  usable: MappingCandidate[];
  rationale: string;
} {
  const usable = methodCandidates.filter((c) =>
    isUsableCanonical(c.canonicalId, ctx.authorityCanonicalIds)
    && !c.evidence.startsWith('stale-')
    && !c.evidence.includes('stale-target')
    && !c.evidence.includes('card-stale')
    && !c.evidence.includes('manifest-stale'),
  );

  if (usable.length === 0) {
    if (methodCandidates.length > 0) {
      return {
        kind: 'ambiguous',
        bindings: [],
        usable: [],
        rationale: 'only-stale-or-unusable-candidates',
      };
    }
    return { kind: 'empty', bindings: [], usable: [], rationale: 'no-candidates' };
  }

  const canonicals = uniqueCanonicals(usable);

  // Multiple distinct legacy ids mapping to multiple canonicals under same method
  // without author decision is a split/merge ambiguity when resource is atomic.
  if (canonicals.length > 1) {
    return {
      kind: 'ambiguous',
      bindings: [],
      usable,
      rationale: `multi-canonical:${canonicals.join(',')}`,
    };
  }

  const canonicalId = canonicals[0]!;
  const roles = [
    ...new Set(
      usable
        .filter((c) => c.canonicalId === canonicalId)
        .map((c) => c.role)
        .filter((r): r is TeachingProjectionRole => r != null && isTeachingProjectionRole(r)),
    ),
  ];

  if (roles.length > 1) {
    return {
      kind: 'ambiguous',
      bindings: [],
      usable,
      rationale: `multi-role:${roles.join(',')}`,
    };
  }

  // Merge detection: multiple distinct legacy ids resolve to one canonical.
  // Spec requires author decision for merge (unless a single explicit method pair).
  const legacyIds = [
    ...new Set(
      usable
        .map((c) => c.legacyId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];
  if (legacyIds.length > 1) {
    return {
      kind: 'ambiguous',
      bindings: [],
      usable,
      rationale: `merge-legacy:${legacyIds.sort().join(',')}`,
    };
  }

  const role = resolveRole(roles[0] ?? null, resource, ctx);
  return {
    kind: 'exact',
    bindings: [
      {
        canonicalId,
        role,
        primary: true,
        rationale: usable[0]?.evidence,
        sourcePath: resource.sourcePath,
      },
    ],
    usable,
    rationale: usable[0]?.evidence ?? 'exact-one-to-one',
  };
}

export interface MapResourceOptions {
  /** When true, treat OPTIONAL unbound as EXPLICIT_NONE instead of REVIEW_REQUIRED. */
  optionalUnboundAsExplicitNone?: boolean;
}

/**
 * Map one inventory resource to BOUND / EXPLICIT_NONE / REVIEW_REQUIRED.
 */
export function mapActiveCourseResource(
  resource: ActiveCourseInventoryResource,
  ctx: MappingContext,
  options: MapResourceOptions = {},
): MigrationStatusRecord {
  const optionalUnboundAsExplicitNone = options.optionalUnboundAsExplicitNone !== false;

  if (resource.projectionMode === 'NONE') {
    return {
      resourceId: resource.resourceId,
      scopeId: resource.scopeId,
      packageId: resource.packageId,
      resourceType: resource.resourceType,
      projectionMode: resource.projectionMode,
      status: 'EXPLICIT_NONE',
      mappingMethod: 'NONE',
      bindings: [],
      candidates: [],
      sourcePath: resource.sourcePath,
      sourceDigest: resource.sourceDigest,
      evidence: ['projectionMode=NONE'],
      rationale: 'explicit-non-semantic-content',
      authorDecisionId: null,
    };
  }

  const allCandidates = uniqueByKey([
    ...collectCrosswalkCandidates(resource, ctx.crosswalk, ctx.authorityCanonicalIds),
    ...collectCardCandidates(resource, ctx.cards, ctx.authorityCanonicalIds),
    ...collectManifestCandidates(resource, ctx.authorityCanonicalIds),
    ...collectExactLabelCandidates(resource, ctx.authorityLabels, ctx.authorityCanonicalIds),
  ]);

  const inputDigest = computeMappingInputDigest(
    resource,
    allCandidates,
    ctx.authorDecisionContextDigest ?? null,
  );
  const decision = findAuthorDecision(resource, inputDigest, ctx.authorDecisions);

  if (decision) {
    if (decision.kind === 'EXPLICIT_NONE') {
      return {
        resourceId: resource.resourceId,
        scopeId: resource.scopeId,
        packageId: resource.packageId,
        resourceType: resource.resourceType,
        projectionMode: resource.projectionMode,
        status: 'EXPLICIT_NONE',
        mappingMethod: 'AUTHOR_DECISION',
        bindings: [],
        candidates: allCandidates,
        sourcePath: resource.sourcePath,
        sourceDigest: resource.sourceDigest,
        evidence: [`author-decision:${decision.decisionId}`, ...allCandidates.map((c) => c.evidence)],
        rationale: decision.rationale,
        authorDecisionId: decision.decisionId,
      };
    }

    const bindings = (decision.bindings ?? []).map((b) => ({
      canonicalId: b.canonicalId,
      role: b.role,
      primary: b.primary,
      rationale: b.rationale ?? decision.rationale,
      sourcePath: b.sourcePath ?? resource.sourcePath,
    }));

    const allUsable = bindings.every((b) =>
      isUsableCanonical(b.canonicalId, ctx.authorityCanonicalIds)
      && isTeachingProjectionRole(b.role),
    );

    if (bindings.length > 0 && allUsable) {
      return {
        resourceId: resource.resourceId,
        scopeId: resource.scopeId,
        packageId: resource.packageId,
        resourceType: resource.resourceType,
        projectionMode: resource.projectionMode,
        status: 'BOUND',
        mappingMethod: 'AUTHOR_DECISION',
        bindings,
        candidates: allCandidates,
        sourcePath: resource.sourcePath,
        sourceDigest: resource.sourceDigest,
        evidence: [`author-decision:${decision.decisionId}`, ...bindings.map((b) => `${b.canonicalId}:${b.role}`)],
        rationale: decision.rationale,
        authorDecisionId: decision.decisionId,
      };
    }
  }

  for (const method of METHOD_ORDER) {
    const methodCandidates = allCandidates.filter((c) => c.method === method);
    const classified = classifyMethodCandidates(methodCandidates, resource, ctx);

    if (classified.kind === 'exact') {
      return {
        resourceId: resource.resourceId,
        scopeId: resource.scopeId,
        packageId: resource.packageId,
        resourceType: resource.resourceType,
        projectionMode: resource.projectionMode,
        status: 'BOUND',
        mappingMethod: method,
        bindings: classified.bindings,
        candidates: allCandidates,
        sourcePath: resource.sourcePath,
        sourceDigest: resource.sourceDigest,
        evidence: classified.bindings.map((b) => `${method}:${b.canonicalId}:${b.role}`),
        rationale: classified.rationale,
        authorDecisionId: null,
      };
    }

    if (classified.kind === 'ambiguous') {
      return {
        resourceId: resource.resourceId,
        scopeId: resource.scopeId,
        packageId: resource.packageId,
        resourceType: resource.resourceType,
        projectionMode: resource.projectionMode,
        status: 'REVIEW_REQUIRED',
        mappingMethod: method,
        bindings: [],
        candidates: allCandidates,
        sourcePath: resource.sourcePath,
        sourceDigest: resource.sourceDigest,
        evidence: methodCandidates.map((c) => c.evidence),
        rationale: classified.rationale,
        authorDecisionId: null,
      };
    }
  }

  // No deterministic signal.
  if (
    resource.projectionMode === 'OPTIONAL'
    && optionalUnboundAsExplicitNone
    && allCandidates.length === 0
  ) {
    return {
      resourceId: resource.resourceId,
      scopeId: resource.scopeId,
      packageId: resource.packageId,
      resourceType: resource.resourceType,
      projectionMode: resource.projectionMode,
      status: 'EXPLICIT_NONE',
      mappingMethod: 'EXPLICIT_NONE',
      bindings: [],
      candidates: [],
      sourcePath: resource.sourcePath,
      sourceDigest: resource.sourceDigest,
      evidence: ['optional-no-candidates'],
      rationale: 'optional-explicit-none',
      authorDecisionId: null,
    };
  }

  // Fuzzy-only / evidence-poor / required unbound
  return {
    resourceId: resource.resourceId,
    scopeId: resource.scopeId,
    packageId: resource.packageId,
    resourceType: resource.resourceType,
    projectionMode: resource.projectionMode,
    status: 'REVIEW_REQUIRED',
    mappingMethod: null,
    bindings: [],
    candidates: allCandidates,
    sourcePath: resource.sourcePath,
    sourceDigest: resource.sourceDigest,
    evidence: allCandidates.map((c) => c.evidence),
    rationale:
      allCandidates.length === 0
        ? 'no-deterministic-signal'
        : 'fuzzy-or-unresolved-candidates',
    authorDecisionId: null,
  };
}

export function mapActiveCourseResources(
  resources: readonly ActiveCourseInventoryResource[],
  ctx: MappingContext,
  options?: MapResourceOptions,
): MigrationStatusRecord[] {
  return [...resources]
    .map((r) => mapActiveCourseResource(r, ctx, options))
    .sort((a, b) => compareCodePoint(a.resourceId, b.resourceId));
}

export function summarizeMigrationStatuses(
  records: readonly MigrationStatusRecord[],
): { boundCount: number; explicitNoneCount: number; reviewRequiredCount: number } {
  let boundCount = 0;
  let explicitNoneCount = 0;
  let reviewRequiredCount = 0;
  for (const r of records) {
    if (r.status === 'BOUND') boundCount += 1;
    else if (r.status === 'EXPLICIT_NONE') explicitNoneCount += 1;
    else reviewRequiredCount += 1;
  }
  return { boundCount, explicitNoneCount, reviewRequiredCount };
}

export function migrationStatusDigest(
  records: readonly MigrationStatusRecord[],
): string {
  return projectionDigest(
    records.map((r) => ({
      resourceId: r.resourceId,
      scopeId: r.scopeId,
      status: r.status,
      mappingMethod: r.mappingMethod,
      bindings: r.bindings,
      rationale: r.rationale,
      authorDecisionId: r.authorDecisionId,
    })),
  );
}

export type { MigrationStatus };

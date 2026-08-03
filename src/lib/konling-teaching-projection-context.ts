/**
 * Server-owned Konling Teaching Projection context (#1274).
 *
 * Carries one explicit Authority / Teaching Projection combination plus scoped
 * Canonical / resource / prerequisite / optional-card fields. Client hints are
 * advisory only; the server revalidates IDs, course scope, and authorization
 * before any tool or prompt assembly. Teaching edges are never synthesized
 * from ActKG labels and never written back.
 */

import type {
  LayeredGraphFallbackProvenance,
  LayeredGraphPayload,
  LayeredGraphScope,
  TeachingPrerequisiteEdge,
  TeachingResourceBindingView,
} from '@/lib/layered-graph/contracts';
import type {
  PrerequisiteStrength,
  TeachingCardIndexEntry,
  TeachingProjectionRole,
  TeachingResourceType,
} from '@/lib/teaching-projection/contracts';

export const KONLING_TEACHING_PROJECTION_CONTEXT_CONTRACT =
  'act-konling-teaching-projection-context/v1' as const;

export const KONLING_TEACHING_PROJECTION_STATUSES = [
  'ready',
  'fallback',
  'unavailable',
  'absent',
  'identity-drift',
  'unauthorized',
] as const;

export type KonlingTeachingProjectionStatus =
  (typeof KONLING_TEACHING_PROJECTION_STATUSES)[number];

export type KonlingOptionalCardStatus =
  | 'active'
  | 'absent'
  | 'inactive'
  | 'not-applicable';

export interface KonlingLinkedTeachingResource {
  resourceId: string;
  resourceType: TeachingResourceType | null;
  role: TeachingProjectionRole;
  title: string | null;
  primary: boolean;
  canonicalId: string;
  scopeId: string;
  sourcePath: string | null;
  citationSafe: true;
}

export interface KonlingPrerequisiteNeighbor {
  prerequisiteId: string;
  canonicalId: string;
  direction: 'ancestor' | 'successor';
  strength: PrerequisiteStrength;
  scopeId: string | null;
  evidenceRef: string | null;
  /** ACT teaching prerequisite — never an ActKG engineering predicate. */
  relationDomain: 'teaching-prerequisite';
}

export interface KonlingActiveCardMetadata {
  cardId: string;
  resourceId: string;
  canonicalId: string;
  title: string | null;
  active: boolean;
  required: boolean;
  sourcePath: string | null;
  status: KonlingOptionalCardStatus;
}

export interface KonlingTeachingProjectionContext {
  contract: typeof KONLING_TEACHING_PROJECTION_CONTEXT_CONTRACT;
  source: 'server-owned';
  status: KonlingTeachingProjectionStatus;
  /** Engineering Authority release identity (independent of teaching readiness). */
  authorityReleaseId: string | null;
  authoritySnapshotId: string | null;
  authoritySnapshotHash: string | null;
  /** Teaching Projection identity when resolved. */
  projectionId: string | null;
  projectionHash: string | null;
  scope: LayeredGraphScope | null;
  /** Current scoped Canonical IDs after server revalidation. */
  canonicalIds: string[];
  linkedResources: KonlingLinkedTeachingResource[];
  prerequisiteAncestors: KonlingPrerequisiteNeighbor[];
  prerequisiteSuccessors: KonlingPrerequisiteNeighbor[];
  /** Optional active card metadata; absence never implies missing Canonical. */
  activeCard: KonlingActiveCardMetadata | null;
  optionalCardStatus: KonlingOptionalCardStatus;
  /** Evidence cutoff for personalized claims (ISO timestamp or null). */
  evidenceCutoff: string | null;
  fallback: LayeredGraphFallbackProvenance | null;
  clientHintsAccepted: string[];
  clientHintsRejected: string[];
  reasons: string[];
  /**
   * Engineering layer may continue without teaching. True when teaching is
   * absent/unavailable but Authority remains usable.
   */
  engineeringOnlyAllowed: boolean;
}

export interface KonlingTeachingProjectionClientHints {
  authorityReleaseId?: string | null;
  projectionId?: string | null;
  canonicalIds?: readonly string[] | null;
  resourceIds?: readonly string[] | null;
  cardId?: string | null;
  scopeId?: string | null;
  lessonKey?: string | null;
  stepId?: string | null;
  /** Opaque signed context token payload already verified by the caller. */
  signedCanonicalIds?: readonly string[] | null;
  evidenceCutoff?: string | null;
}

export interface ResolveKonlingTeachingProjectionContextInput {
  payload: LayeredGraphPayload | null | undefined;
  /**
   * Preferred current Canonical focus. When omitted, uses scope.knowledgeRefs
   * then projected bindings.
   */
  focusCanonicalIds?: readonly string[] | null;
  clientHints?: KonlingTeachingProjectionClientHints | null;
  /**
   * Course/user authorization gate. When false, teaching resources are
   * excluded and status becomes unauthorized.
   */
  authorized?: boolean;
  /**
   * Course IDs the caller may access. Cross-course IDs are rejected.
   */
  permittedScopeIds?: readonly string[] | null;
  /**
   * Max prerequisite neighbors per direction (bounded neighborhood).
   */
  maxPrerequisiteNeighbors?: number;
  /**
   * Expected Authority / Projection combination. Drift fails closed for
   * teaching without forging engineering edges.
   */
  requiredAuthorityReleaseId?: string | null;
  requiredProjectionId?: string | null;
  evidenceCutoff?: string | null;
}

const DEFAULT_MAX_PREREQUISITE_NEIGHBORS = 8;

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

function emptyContext(
  partial: Partial<KonlingTeachingProjectionContext> & {
    status: KonlingTeachingProjectionStatus;
    reasons: string[];
  },
): KonlingTeachingProjectionContext {
  return {
    contract: KONLING_TEACHING_PROJECTION_CONTEXT_CONTRACT,
    source: 'server-owned',
    status: partial.status,
    authorityReleaseId: partial.authorityReleaseId ?? null,
    authoritySnapshotId: partial.authoritySnapshotId ?? null,
    authoritySnapshotHash: partial.authoritySnapshotHash ?? null,
    projectionId: partial.projectionId ?? null,
    projectionHash: partial.projectionHash ?? null,
    scope: partial.scope ?? null,
    canonicalIds: partial.canonicalIds ?? [],
    linkedResources: partial.linkedResources ?? [],
    prerequisiteAncestors: partial.prerequisiteAncestors ?? [],
    prerequisiteSuccessors: partial.prerequisiteSuccessors ?? [],
    activeCard: partial.activeCard ?? null,
    optionalCardStatus: partial.optionalCardStatus ?? 'not-applicable',
    evidenceCutoff: partial.evidenceCutoff ?? null,
    fallback: partial.fallback ?? null,
    clientHintsAccepted: partial.clientHintsAccepted ?? [],
    clientHintsRejected: partial.clientHintsRejected ?? [],
    reasons: partial.reasons,
    engineeringOnlyAllowed: partial.engineeringOnlyAllowed ?? true,
  };
}

function projectLinkedResource(
  binding: TeachingResourceBindingView,
): KonlingLinkedTeachingResource {
  return {
    resourceId: binding.resourceId,
    resourceType: binding.resourceType,
    role: binding.role,
    title: binding.resourceTitle,
    primary: binding.primary,
    canonicalId: binding.canonicalId,
    scopeId: binding.scopeId,
    sourcePath: binding.sourcePath,
    citationSafe: true,
  };
}

function projectCard(
  card: TeachingCardIndexEntry,
  status: KonlingOptionalCardStatus,
): KonlingActiveCardMetadata {
  return {
    cardId: card.cardId,
    resourceId: card.resourceId,
    canonicalId: card.canonicalId,
    title: card.title,
    active: card.active,
    required: card.required,
    sourcePath: card.sourcePath,
    status,
  };
}

function collectFocusCanonicalIds(input: {
  payload: LayeredGraphPayload;
  focusCanonicalIds?: readonly string[] | null;
  clientHints?: KonlingTeachingProjectionClientHints | null;
}): {
  accepted: string[];
  acceptedHints: string[];
  rejectedHints: string[];
} {
  const projected = new Set([
    ...input.payload.teachingResources.bindings.map((b) => b.canonicalId),
    ...input.payload.teachingResources.coreNodes.map((n) => n.canonicalId),
    ...input.payload.engineering.nodes.map((n) => n.canonicalId),
  ]);
  const scopeRefs = input.payload.requestedScope?.knowledgeRefs ?? [];
  const acceptedHints: string[] = [];
  const rejectedHints: string[] = [];

  const candidates: string[] = [];
  for (const id of input.focusCanonicalIds ?? []) {
    if (projected.has(id) || scopeRefs.includes(id)) candidates.push(id);
  }

  const signed = input.clientHints?.signedCanonicalIds ?? [];
  for (const id of signed) {
    if (projected.has(id) || scopeRefs.includes(id)) {
      candidates.push(id);
      acceptedHints.push('signedCanonicalIds');
    } else {
      rejectedHints.push(`signedCanonicalIds:${id}`);
    }
  }

  const hinted = input.clientHints?.canonicalIds ?? [];
  for (const id of hinted) {
    if (projected.has(id) || scopeRefs.includes(id)) {
      candidates.push(id);
      acceptedHints.push('canonicalIds');
    } else {
      rejectedHints.push(`canonicalIds:${id}`);
    }
  }

  if (candidates.length === 0) {
    for (const id of scopeRefs) candidates.push(id);
  }
  if (candidates.length === 0) {
    for (const id of projected) candidates.push(id);
  }

  return {
    accepted: uniqueSorted(candidates),
    acceptedHints: uniqueSorted(acceptedHints),
    rejectedHints: uniqueSorted(rejectedHints),
  };
}

function boundPrerequisiteNeighborhood(input: {
  edges: readonly TeachingPrerequisiteEdge[];
  focusCanonicalIds: readonly string[];
  maxNeighbors: number;
}): {
  ancestors: KonlingPrerequisiteNeighbor[];
  successors: KonlingPrerequisiteNeighbor[];
} {
  const focus = new Set(input.focusCanonicalIds);
  const ancestors: KonlingPrerequisiteNeighbor[] = [];
  const successors: KonlingPrerequisiteNeighbor[] = [];

  for (const edge of input.edges) {
    if (focus.has(edge.targetCanonicalId)) {
      ancestors.push({
        prerequisiteId: edge.prerequisiteId,
        canonicalId: edge.sourceCanonicalId,
        direction: 'ancestor',
        strength: edge.strength,
        scopeId: edge.scopeId,
        evidenceRef: edge.evidenceRef,
        relationDomain: 'teaching-prerequisite',
      });
    }
    if (focus.has(edge.sourceCanonicalId)) {
      successors.push({
        prerequisiteId: edge.prerequisiteId,
        canonicalId: edge.targetCanonicalId,
        direction: 'successor',
        strength: edge.strength,
        scopeId: edge.scopeId,
        evidenceRef: edge.evidenceRef,
        relationDomain: 'teaching-prerequisite',
      });
    }
  }

  const rank = (strength: PrerequisiteStrength) =>
    strength === 'REQUIRED' ? 0 : 1;

  ancestors.sort((a, b) => {
    const byStrength = rank(a.strength) - rank(b.strength);
    if (byStrength !== 0) return byStrength;
    return a.canonicalId < b.canonicalId
      ? -1
      : a.canonicalId > b.canonicalId
        ? 1
        : 0;
  });
  successors.sort((a, b) => {
    const byStrength = rank(a.strength) - rank(b.strength);
    if (byStrength !== 0) return byStrength;
    return a.canonicalId < b.canonicalId
      ? -1
      : a.canonicalId > b.canonicalId
        ? 1
        : 0;
  });

  return {
    ancestors: ancestors.slice(0, input.maxNeighbors),
    successors: successors.slice(0, input.maxNeighbors),
  };
}

function resolveOptionalCard(
  cards: readonly TeachingCardIndexEntry[],
  focusCanonicalIds: readonly string[],
  clientCardId: string | null | undefined,
): {
  activeCard: KonlingActiveCardMetadata | null;
  optionalCardStatus: KonlingOptionalCardStatus;
  acceptedHints: string[];
  rejectedHints: string[];
} {
  const focus = new Set(focusCanonicalIds);
  const scoped = cards.filter((card) => focus.has(card.canonicalId));
  const acceptedHints: string[] = [];
  const rejectedHints: string[] = [];

  if (clientCardId) {
    const match = scoped.find((card) => card.cardId === clientCardId)
      ?? cards.find((card) => card.cardId === clientCardId);
    if (match && focus.has(match.canonicalId)) {
      acceptedHints.push('cardId');
      if (match.active) {
        return {
          activeCard: projectCard(match, 'active'),
          optionalCardStatus: 'active',
          acceptedHints,
          rejectedHints,
        };
      }
      return {
        activeCard: projectCard(match, 'inactive'),
        optionalCardStatus: 'inactive',
        acceptedHints,
        rejectedHints,
      };
    }
    rejectedHints.push(`cardId:${clientCardId}`);
  }

  const active = scoped.find((card) => card.active);
  if (active) {
    return {
      activeCard: projectCard(active, 'active'),
      optionalCardStatus: 'active',
      acceptedHints,
      rejectedHints,
    };
  }
  if (scoped.length > 0) {
    return {
      activeCard: projectCard(scoped[0]!, 'inactive'),
      optionalCardStatus: 'inactive',
      acceptedHints,
      rejectedHints,
    };
  }
  if (focusCanonicalIds.length > 0) {
    return {
      activeCard: null,
      optionalCardStatus: 'absent',
      acceptedHints,
      rejectedHints,
    };
  }
  return {
    activeCard: null,
    optionalCardStatus: 'not-applicable',
    acceptedHints,
    rejectedHints,
  };
}

function mapPayloadStatus(
  payload: LayeredGraphPayload,
): KonlingTeachingProjectionStatus {
  const status = payload.teachingResources.identity.status;
  if (status === 'ready') return 'ready';
  if (status === 'fallback') return 'fallback';
  if (status === 'identity-drift') return 'identity-drift';
  if (status === 'absent' || status === 'NOT_PROJECTED') return 'absent';
  return 'unavailable';
}

/**
 * Resolve server-owned Konling Teaching Projection context from a layered
 * payload. Pure: no FS, no model inference, no writeback.
 */
export function resolveKonlingTeachingProjectionContext(
  input: ResolveKonlingTeachingProjectionContextInput,
): KonlingTeachingProjectionContext {
  const authorized = input.authorized !== false;
  const maxNeighbors =
    input.maxPrerequisiteNeighbors ?? DEFAULT_MAX_PREREQUISITE_NEIGHBORS;
  const evidenceCutoff =
    input.evidenceCutoff
    ?? input.clientHints?.evidenceCutoff
    ?? null;

  if (!input.payload) {
    return emptyContext({
      status: 'absent',
      reasons: ['teaching-projection-payload-missing'],
      evidenceCutoff,
      engineeringOnlyAllowed: true,
      clientHintsRejected: Object.keys(input.clientHints ?? {}),
    });
  }

  const payload = input.payload;
  const engIdentity = payload.engineering.identity;
  const teachIdentity = payload.teachingResources.identity;

  if (!authorized) {
    return emptyContext({
      status: 'unauthorized',
      authorityReleaseId: engIdentity.authorityReleaseId,
      authoritySnapshotId: engIdentity.authoritySnapshotId,
      authoritySnapshotHash: engIdentity.authoritySnapshotHash,
      projectionId: teachIdentity.projectionId,
      projectionHash: teachIdentity.projectionHash,
      scope: payload.requestedScope,
      evidenceCutoff,
      fallback: payload.fallback,
      reasons: ['teaching-resources-unauthorized'],
      engineeringOnlyAllowed: engIdentity.status === 'ready',
      clientHintsRejected: Object.keys(input.clientHints ?? {}),
    });
  }

  if (
    input.permittedScopeIds
    && payload.requestedScope?.scopeId
    && !input.permittedScopeIds.includes(payload.requestedScope.scopeId)
  ) {
    return emptyContext({
      status: 'unauthorized',
      authorityReleaseId: engIdentity.authorityReleaseId,
      authoritySnapshotId: engIdentity.authoritySnapshotId,
      authoritySnapshotHash: engIdentity.authoritySnapshotHash,
      projectionId: teachIdentity.projectionId,
      projectionHash: teachIdentity.projectionHash,
      scope: payload.requestedScope,
      evidenceCutoff,
      fallback: payload.fallback,
      reasons: [`cross-course-scope-rejected:${payload.requestedScope.scopeId}`],
      engineeringOnlyAllowed: engIdentity.status === 'ready',
      clientHintsRejected: ['scopeId'],
    });
  }

  const clientHintsAccepted: string[] = [];
  const clientHintsRejected: string[] = [];

  if (input.clientHints?.authorityReleaseId) {
    if (
      engIdentity.authorityReleaseId
      && input.clientHints.authorityReleaseId === engIdentity.authorityReleaseId
    ) {
      clientHintsAccepted.push('authorityReleaseId');
    } else {
      clientHintsRejected.push('authorityReleaseId');
    }
  }
  if (input.clientHints?.projectionId) {
    if (
      teachIdentity.projectionId
      && input.clientHints.projectionId === teachIdentity.projectionId
    ) {
      clientHintsAccepted.push('projectionId');
    } else {
      clientHintsRejected.push('projectionId');
    }
  }
  if (input.clientHints?.scopeId) {
    if (
      payload.requestedScope?.scopeId
      && input.clientHints.scopeId === payload.requestedScope.scopeId
    ) {
      clientHintsAccepted.push('scopeId');
    } else {
      clientHintsRejected.push('scopeId');
    }
  }

  // Identity drift: required combination mismatches server-resolved IDs.
  if (
    input.requiredAuthorityReleaseId
    && engIdentity.authorityReleaseId
    && input.requiredAuthorityReleaseId !== engIdentity.authorityReleaseId
  ) {
    return emptyContext({
      status: 'identity-drift',
      authorityReleaseId: engIdentity.authorityReleaseId,
      authoritySnapshotId: engIdentity.authoritySnapshotId,
      authoritySnapshotHash: engIdentity.authoritySnapshotHash,
      projectionId: teachIdentity.projectionId,
      projectionHash: teachIdentity.projectionHash,
      scope: payload.requestedScope,
      evidenceCutoff,
      fallback: payload.fallback,
      reasons: [
        `authority-release-drift:expected=${input.requiredAuthorityReleaseId}:actual=${engIdentity.authorityReleaseId}`,
      ],
      engineeringOnlyAllowed: false,
      clientHintsAccepted,
      clientHintsRejected,
    });
  }

  if (
    input.requiredProjectionId
    && teachIdentity.projectionId
    && input.requiredProjectionId !== teachIdentity.projectionId
  ) {
    return emptyContext({
      status: 'identity-drift',
      authorityReleaseId: engIdentity.authorityReleaseId
        ?? teachIdentity.authorityReleaseId,
      authoritySnapshotId: engIdentity.authoritySnapshotId,
      authoritySnapshotHash: engIdentity.authoritySnapshotHash,
      projectionId: teachIdentity.projectionId,
      projectionHash: teachIdentity.projectionHash,
      scope: payload.requestedScope,
      evidenceCutoff,
      fallback: payload.fallback,
      reasons: [
        `projection-id-drift:expected=${input.requiredProjectionId}:actual=${teachIdentity.projectionId}`,
      ],
      engineeringOnlyAllowed: engIdentity.status === 'ready',
      clientHintsAccepted,
      clientHintsRejected,
    });
  }

  const status = mapPayloadStatus(payload);
  if (status === 'absent' || status === 'unavailable' || status === 'identity-drift') {
    return emptyContext({
      status,
      authorityReleaseId: engIdentity.authorityReleaseId
        ?? teachIdentity.authorityReleaseId,
      authoritySnapshotId: engIdentity.authoritySnapshotId,
      authoritySnapshotHash: engIdentity.authoritySnapshotHash,
      projectionId: teachIdentity.projectionId,
      projectionHash: teachIdentity.projectionHash,
      scope: payload.requestedScope,
      evidenceCutoff,
      fallback: payload.fallback,
      reasons:
        teachIdentity.reasons.length > 0
          ? [...teachIdentity.reasons]
          : [`teaching-layer-${status}`],
      engineeringOnlyAllowed: engIdentity.status === 'ready',
      clientHintsAccepted,
      clientHintsRejected: [
        ...clientHintsRejected,
        ...Object.keys(input.clientHints ?? {}).filter(
          (key) => !clientHintsAccepted.includes(key),
        ),
      ],
    });
  }

  const focus = collectFocusCanonicalIds({
    payload,
    focusCanonicalIds: input.focusCanonicalIds,
    clientHints: input.clientHints,
  });
  clientHintsAccepted.push(...focus.acceptedHints);
  clientHintsRejected.push(...focus.rejectedHints);

  // Cross-course resource exclusion: only resources in the requested scope.
  const scopeId = payload.requestedScope?.scopeId ?? teachIdentity.scopeId;
  let bindings = payload.teachingResources.bindings.filter((binding) =>
    focus.accepted.includes(binding.canonicalId),
  );
  if (scopeId) {
    bindings = bindings.filter((binding) => binding.scopeId === scopeId);
  }

  // Reject client-hinted resource IDs outside authorized set.
  if (input.clientHints?.resourceIds) {
    const allowed = new Set(bindings.map((b) => b.resourceId));
    for (const resourceId of input.clientHints.resourceIds) {
      if (allowed.has(resourceId)) {
        clientHintsAccepted.push('resourceIds');
      } else {
        clientHintsRejected.push(`resourceIds:${resourceId}`);
      }
    }
  }

  const linkedResources = bindings
    .map(projectLinkedResource)
    .sort((a, b) =>
      a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0,
    );

  const neighborhood = boundPrerequisiteNeighborhood({
    edges: payload.teachingPrerequisites.edges,
    focusCanonicalIds: focus.accepted,
    maxNeighbors,
  });

  const cardResolution = resolveOptionalCard(
    payload.teachingResources.cards,
    focus.accepted,
    input.clientHints?.cardId,
  );
  clientHintsAccepted.push(...cardResolution.acceptedHints);
  clientHintsRejected.push(...cardResolution.rejectedHints);

  return {
    contract: KONLING_TEACHING_PROJECTION_CONTEXT_CONTRACT,
    source: 'server-owned',
    status,
    authorityReleaseId:
      engIdentity.authorityReleaseId ?? teachIdentity.authorityReleaseId,
    authoritySnapshotId: engIdentity.authoritySnapshotId,
    authoritySnapshotHash: engIdentity.authoritySnapshotHash,
    projectionId: teachIdentity.projectionId,
    projectionHash: teachIdentity.projectionHash,
    scope: payload.requestedScope,
    canonicalIds: focus.accepted,
    linkedResources,
    prerequisiteAncestors: neighborhood.ancestors,
    prerequisiteSuccessors: neighborhood.successors,
    activeCard: cardResolution.activeCard,
    optionalCardStatus: cardResolution.optionalCardStatus,
    evidenceCutoff,
    fallback: payload.fallback,
    clientHintsAccepted: uniqueSorted(clientHintsAccepted),
    clientHintsRejected: uniqueSorted(clientHintsRejected),
    reasons:
      teachIdentity.reasons.length > 0
        ? [...teachIdentity.reasons]
        : status === 'fallback'
          ? ['teaching-projection-fallback']
          : ['teaching-projection-ready'],
    engineeringOnlyAllowed: false,
  };
}

/**
 * Prompt-safe grounding lines for Konling tools. Never exposes store paths,
 * writer APIs, or raw ActKG engineering predicates as teaching prerequisites.
 */
export function buildKonlingTeachingProjectionGroundingLines(
  context: KonlingTeachingProjectionContext | null | undefined,
): string[] {
  if (!context) {
    return ['teaching-projection:absent'];
  }

  const lines: string[] = [
    `teaching-projection:status=${context.status}`,
  ];
  if (context.authorityReleaseId) {
    lines.push(`authorityReleaseId=${context.authorityReleaseId}`);
  }
  if (context.projectionId) {
    lines.push(`projectionId=${context.projectionId}`);
  }
  if (context.scope?.scopeId) {
    lines.push(`scopeId=${context.scope.scopeId}`);
  }
  if (context.canonicalIds.length > 0) {
    lines.push(`canonicalIds=${context.canonicalIds.slice(0, 12).join(',')}`);
  }
  if (context.linkedResources.length > 0) {
    lines.push(
      `linkedResources=${context.linkedResources
        .slice(0, 8)
        .map((r) => `${r.resourceId}:${r.role}`)
        .join(',')}`,
    );
  }
  if (context.prerequisiteAncestors.length > 0) {
    lines.push(
      `prerequisiteAncestors=${context.prerequisiteAncestors
        .slice(0, 8)
        .map((n) => `${n.canonicalId}:${n.strength}`)
        .join(',')}`,
    );
  }
  if (context.prerequisiteSuccessors.length > 0) {
    lines.push(
      `prerequisiteSuccessors=${context.prerequisiteSuccessors
        .slice(0, 8)
        .map((n) => `${n.canonicalId}:${n.strength}`)
        .join(',')}`,
    );
  }
  if (context.optionalCardStatus === 'absent') {
    lines.push('optionalCard=absent;use-canonical-summary-or-linked-resources');
  } else if (context.activeCard) {
    lines.push(
      `optionalCard=${context.activeCard.cardId}:${context.optionalCardStatus}`,
    );
  }
  if (context.fallback) {
    lines.push(
      `fallback=${context.fallback.kind}:${context.fallback.adapterId}`,
    );
  }
  if (context.evidenceCutoff) {
    lines.push(`evidenceCutoff=${context.evidenceCutoff}`);
  }
  for (const reason of context.reasons.slice(0, 4)) {
    lines.push(`reason=${reason}`);
  }
  return lines;
}

/**
 * Metadata retained through answer assembly for dual-domain provenance.
 */
export function projectKonlingTeachingProjectionAnswerProvenance(
  context: KonlingTeachingProjectionContext | null | undefined,
): {
  domain: 'teaching-resource';
  status: KonlingTeachingProjectionStatus | 'absent';
  authorityReleaseId: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  scopeId: string | null;
  canonicalIds: string[];
  resourceIds: string[];
  cardId: string | null;
  optionalCardStatus: KonlingOptionalCardStatus | 'not-applicable';
  prerequisiteEvidenceRefs: string[];
  fallbackKind: string | null;
  relationWriteback: false;
} {
  if (!context) {
    return {
      domain: 'teaching-resource',
      status: 'absent',
      authorityReleaseId: null,
      projectionId: null,
      projectionHash: null,
      scopeId: null,
      canonicalIds: [],
      resourceIds: [],
      cardId: null,
      optionalCardStatus: 'not-applicable',
      prerequisiteEvidenceRefs: [],
      fallbackKind: null,
      relationWriteback: false,
    };
  }

  return {
    domain: 'teaching-resource',
    status: context.status,
    authorityReleaseId: context.authorityReleaseId,
    projectionId: context.projectionId,
    projectionHash: context.projectionHash,
    scopeId: context.scope?.scopeId ?? null,
    canonicalIds: [...context.canonicalIds],
    resourceIds: context.linkedResources.map((r) => r.resourceId),
    cardId: context.activeCard?.cardId ?? null,
    optionalCardStatus: context.optionalCardStatus,
    prerequisiteEvidenceRefs: [
      ...context.prerequisiteAncestors,
      ...context.prerequisiteSuccessors,
    ]
      .map((n) => n.evidenceRef)
      .filter((ref): ref is string => Boolean(ref)),
    fallbackKind: context.fallback?.kind ?? null,
    relationWriteback: false,
  };
}

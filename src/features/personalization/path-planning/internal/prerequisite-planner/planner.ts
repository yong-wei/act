/**
 * ACT REQUIRED prerequisite reverse traversal path planner (#1275).
 *
 * Hard edges: ACT_TEACHING REQUIRED only.
 * RECOMMENDED: advisory annotations.
 * Engineering relations: optional context only, never hard edges.
 *
 * When a learning-path consumer-activation pointer is present (#1276), the
 * planner binds to that Authority/Projection combination (or its pin).
 */

import {
  overlayLiveTeachingPins,
  readAgreedLiveCourseProjection,
} from '@/lib/teaching-projection/live-course-pointer';
import {
  projectionPinsFromSelection,
  resolveLearningPathProductionSelection,
  type ConsumerProductionSelection,
} from '@/lib/versioned-knowledge-activation';

import { selectAccessibleProjectedResources } from './resource-selection';
import {
  ACT_PREREQUISITE_PATH_PLANNER_VERSION,
  type ActPathBlocker,
  type ActPathEngineeringRelation,
  type ActPathPlanNode,
  type ActPathPlannerInput,
  type ActPathPlanResult,
  type ActPathProjectedResourceCandidate,
  type ActPathRecommendedAnnotation,
} from './contracts';

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

interface NormalizedEdge {
  edgeId: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  strength: 'REQUIRED' | 'RECOMMENDED' | string;
  layer: string;
  relationType: string;
  evidenceRef: string | null;
  rationale: string | null;
  scopeId: string | null;
  /** Present on PrerequisiteEdgePublished; runtime edges may omit. */
  status: string | null;
  authorityReleaseId: string | null;
  projectionCaptureId: string | null;
}

interface NormalizedCoreNode {
  canonicalId: string;
  pathEligible: boolean;
  cardPolicy: string | null;
  moduleId: string | null;
  scopeId: string | null;
  projectionStatus: string | null;
  rationale: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeEdge(raw: ActPathPlannerInput['prerequisites'][number]): NormalizedEdge | null {
  const row = asRecord(raw);
  const source =
    readString(row.sourceCanonicalId)
    ?? readString(row.sourceNodeId);
  const target =
    readString(row.targetCanonicalId)
    ?? readString(row.targetNodeId);
  const strength = readString(row.strength);
  if (!source || !target || !strength) return null;

  const evidenceRefs = Array.isArray(row.evidenceRefs)
    ? row.evidenceRefs.filter((item): item is string => typeof item === 'string')
    : [];
  const evidenceRef =
    readString(row.evidenceRef)
    ?? (evidenceRefs[0] ?? null);

  return {
    edgeId:
      readString(row.edgeId)
      ?? readString(row.prerequisiteId)
      ?? `${source}->${target}:${strength}`,
    sourceCanonicalId: source,
    targetCanonicalId: target,
    strength,
    layer: readString(row.layer) ?? 'ACT_TEACHING',
    relationType: readString(row.relationType) ?? 'PREREQUISITE',
    evidenceRef,
    rationale: readString(row.rationale) ?? readString(row.curatorRationale),
    scopeId: readString(row.scopeId),
    status: readString(row.status),
    authorityReleaseId: readString(row.authorityReleaseId),
    projectionCaptureId: readString(row.projectionCaptureId),
  };
}

function normalizeCoreNode(
  raw: ActPathPlannerInput['coreNodes'][number],
): NormalizedCoreNode {
  const row = asRecord(raw);
  return {
    canonicalId: readString(row.canonicalId) ?? '',
    pathEligible: row.pathEligible === true,
    cardPolicy: readString(row.cardPolicy),
    moduleId: readString(row.moduleId),
    scopeId: readString(row.scopeId),
    projectionStatus: readString(row.projectionStatus) ?? 'PROJECTED',
    rationale: readString(row.rationale),
  };
}

function isActTeachingRequired(edge: NormalizedEdge): boolean {
  if (edge.strength !== 'REQUIRED') return false;
  if (edge.layer !== 'ACT_TEACHING') return false;
  if (edge.relationType !== 'PREREQUISITE') return false;
  return true;
}

function isActTeachingRecommended(edge: NormalizedEdge): boolean {
  if (edge.strength !== 'RECOMMENDED') return false;
  if (edge.layer !== 'ACT_TEACHING') return false;
  return true;
}

/**
 * Hard/advisory edges must bind the current Projection scope/capture.
 * PrerequisiteEdgePublished always carries `status`; only PUBLISHED is accepted
 * and capture identity must match strictly (including null === null).
 * Runtime TeachingPrerequisiteRuntime edges omit `status` and are treated as
 * already gate-filtered by the projection builder.
 */
function isBoundToCurrentProjection(
  edge: NormalizedEdge,
  projection: NonNullable<ActPathPlannerInput['projection']>,
): boolean {
  const isPublishedForm = edge.status != null;
  if (isPublishedForm && edge.status !== 'PUBLISHED') {
    return false;
  }
  if (edge.scopeId != null && edge.scopeId !== projection.scopeId) {
    return false;
  }
  if (
    edge.authorityReleaseId != null
    && edge.authorityReleaseId !== projection.authorityReleaseId
  ) {
    return false;
  }
  if (isPublishedForm) {
    // Published edges always close capture identity against the current
    // Projection prerequisite publication id (null only matches null).
    const capture =
      projection.prerequisitePublicationId?.trim()
      || null;
    const edgeCapture = edge.projectionCaptureId;
    if (edgeCapture !== capture) {
      return false;
    }
  }
  return true;
}

function isHardRequiredEdge(
  edge: NormalizedEdge,
  projection: NonNullable<ActPathPlannerInput['projection']>,
): boolean {
  return isActTeachingRequired(edge) && isBoundToCurrentProjection(edge, projection);
}

function isAdvisoryRecommendedEdge(
  edge: NormalizedEdge,
  projection: NonNullable<ActPathPlannerInput['projection']>,
): boolean {
  return isActTeachingRecommended(edge) && isBoundToCurrentProjection(edge, projection);
}

/**
 * Reverse-traverse REQUIRED edges from the goal: collect unmet ancestors.
 * Edge semantics: source is a prerequisite of target.
 */
function reverseTraverseRequired(
  goalCanonicalId: string,
  requiredEdges: readonly NormalizedEdge[],
): { nodes: Set<string>; blockers: ActPathBlocker[] } {
  const reverseAdj = new Map<string, string[]>();
  const edgeByPair = new Map<string, NormalizedEdge>();
  for (const edge of requiredEdges) {
    const list = reverseAdj.get(edge.targetCanonicalId) ?? [];
    list.push(edge.sourceCanonicalId);
    reverseAdj.set(edge.targetCanonicalId, list);
    edgeByPair.set(
      `${edge.sourceCanonicalId}\u001f${edge.targetCanonicalId}`,
      edge,
    );
  }

  const nodes = new Set<string>([goalCanonicalId]);
  const stack = [goalCanonicalId];
  const visiting = new Set<string>();
  const blockers: ActPathBlocker[] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visiting.has(current)) {
      blockers.push({
        code: 'required-cycle',
        message: `REQUIRED prerequisite cycle detected at ${current}`,
        canonicalId: current,
      });
      continue;
    }
    visiting.add(current);
    const parents = [...(reverseAdj.get(current) ?? [])].sort(compareCodePoint);
    for (const parent of parents) {
      if (!nodes.has(parent)) {
        nodes.add(parent);
        stack.push(parent);
      }
      // Dangling check deferred to core-node index.
      void edgeByPair;
    }
  }

  return { nodes, blockers };
}

function topologicalOrderRequired(
  nodeSet: ReadonlySet<string>,
  requiredEdges: readonly NormalizedEdge[],
): { order: string[]; blockers: ActPathBlocker[] } {
  const nodes = new Set(nodeSet);
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodes) {
    indegree.set(id, 0);
    adj.set(id, []);
  }

  for (const edge of requiredEdges) {
    if (!nodes.has(edge.sourceCanonicalId) || !nodes.has(edge.targetCanonicalId)) {
      continue;
    }
    adj.get(edge.sourceCanonicalId)!.push(edge.targetCanonicalId);
    indegree.set(
      edge.targetCanonicalId,
      (indegree.get(edge.targetCanonicalId) ?? 0) + 1,
    );
  }

  for (const [from, targets] of adj) {
    adj.set(from, [...targets].sort(compareCodePoint));
  }

  const ready = [...nodes]
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort(compareCodePoint);
  const order: string[] = [];

  while (ready.length > 0) {
    const node = ready.shift()!;
    order.push(node);
    for (const next of adj.get(node) ?? []) {
      const nextDeg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDeg);
      if (nextDeg === 0) {
        ready.push(next);
        ready.sort(compareCodePoint);
      }
    }
  }

  if (order.length !== nodes.size) {
    return {
      order: [],
      blockers: [
        {
          code: 'required-cycle',
          message: 'cannot topologically order REQUIRED prerequisite subgraph',
        },
      ],
    };
  }

  return { order, blockers: [] };
}

function collectCandidatesForNode(input: {
  canonicalId: string;
  resources: readonly ActPathProjectedResourceCandidate[];
  bindings: ActPathPlannerInput['bindings'];
  cards: ActPathPlannerInput['cards'];
}): ActPathProjectedResourceCandidate[] {
  const resourceById = new Map(
    input.resources.map((resource) => [resource.resourceId, resource]),
  );
  const out = new Map<string, ActPathProjectedResourceCandidate>();

  for (const binding of input.bindings ?? []) {
    const row = asRecord(binding);
    const canonicalId = readString(row.canonicalId);
    const resourceId = readString(row.resourceId);
    if (canonicalId !== input.canonicalId || !resourceId) continue;
    const base = resourceById.get(resourceId);
    if (!base) {
      out.set(resourceId, {
        resourceId,
        resourceType: 'other',
        accessible: false,
        role: readString(row.role),
        scopeId: readString(row.scopeId),
        sourcePath: readString(row.sourcePath),
        primary: row.primary === true,
        bindingStatus: 'UNBOUND',
        projectionStatus: 'UNBOUND',
        provenance: {
          bindingId: readString(row.bindingId),
          rationale: readString(row.rationale),
        },
      });
      continue;
    }
    out.set(resourceId, {
      ...base,
      role: base.role ?? readString(row.role),
      scopeId: base.scopeId ?? readString(row.scopeId),
      sourcePath: base.sourcePath ?? readString(row.sourcePath),
      primary: base.primary === true || row.primary === true,
      provenance: {
        bindingId: readString(row.bindingId) ?? base.provenance?.bindingId ?? null,
        evidenceRef: base.provenance?.evidenceRef ?? null,
        rationale:
          readString(row.rationale)
          ?? base.provenance?.rationale
          ?? null,
      },
    });
  }

  for (const card of input.cards ?? []) {
    const row = asRecord(card);
    const canonicalId = readString(row.canonicalId);
    const resourceId = readString(row.resourceId);
    if (canonicalId !== input.canonicalId || !resourceId) continue;
    const base = resourceById.get(resourceId) ?? out.get(resourceId);
    out.set(resourceId, {
      resourceId,
      resourceType: 'card',
      resourceNodeId: base?.resourceNodeId ?? resourceId,
      registryId: base?.registryId ?? resourceId,
      launchTarget: base?.launchTarget ?? null,
      role: base?.role ?? 'EXPLAINS',
      scopeId: base?.scopeId ?? null,
      sourcePath: base?.sourcePath ?? readString(row.sourcePath),
      primary: base?.primary === true,
      accessible: row.active === true && (base?.accessible ?? true),
      projectionStatus: base?.projectionStatus ?? 'BOUND',
      bindingStatus: base?.bindingStatus ?? 'BOUND',
      cardActive: row.active === true,
      cardRequired: row.required === true,
      provenance: {
        bindingId: base?.provenance?.bindingId ?? null,
        evidenceRef: base?.provenance?.evidenceRef ?? null,
        rationale: base?.provenance?.rationale ?? null,
      },
    });
  }

  // Direct canonical attachment on candidates (single-node or pre-tagged lists).
  for (const resource of input.resources) {
    if (out.has(resource.resourceId)) continue;
    if (resource.canonicalId && resource.canonicalId === input.canonicalId) {
      out.set(resource.resourceId, resource);
    }
  }

  // Untagged single-node fallback: only when EVERY candidate lacks canonical
  // ownership and no multi-node binding/card inventory was supplied. When any
  // candidate carries canonicalId, missing matches must fail closed instead of
  // borrowing another node's resources.
  const anyCanonicalTagged = input.resources.some(
    (resource) =>
      typeof resource.canonicalId === 'string'
      && resource.canonicalId.trim().length > 0,
  );
  if (
    out.size === 0
    && !anyCanonicalTagged
    && (input.bindings == null || input.bindings.length === 0)
    && (input.cards == null || input.cards.length === 0)
  ) {
    for (const resource of input.resources) {
      out.set(resource.resourceId, resource);
    }
  }

  return [...out.values()];
}

function buildEmptyResult(
  input: ActPathPlannerInput,
  status: ActPathPlanResult['status'],
  blocked: ActPathBlocker[],
  diagnostics: ActPathPlanResult['diagnostics'],
  engineeringContext: ActPathEngineeringRelation[] = [],
  recommendedAnnotations: ActPathRecommendedAnnotation[] = [],
): ActPathPlanResult {
  return {
    schemaVersion: ACT_PREREQUISITE_PATH_PLANNER_VERSION,
    status,
    plannerVersion: ACT_PREREQUISITE_PATH_PLANNER_VERSION,
    goalCanonicalId: input.goalCanonicalId,
    projection: input.projection,
    nodes: [],
    blocked,
    recommendedAnnotations,
    engineeringContext,
    diagnostics,
  };
}

/**
 * Bind planner projection identity to the learning-path consumer activation
 * when present. Replacing consumer-activation current.json changes the
 * Authority/Projection combination used for formal path planning.
 */
export function applyLearningPathConsumerActivation(
  projection: ActPathPlannerInput['projection'],
  options: {
    repoRoot?: string;
    activationSelection?: ConsumerProductionSelection;
  } = {},
): {
  projection: ActPathPlannerInput['projection'];
  activationMode: ConsumerProductionSelection['mode'];
  reasons: string[];
} {
  if (!options.activationSelection && typeof options.repoRoot !== 'string') {
    return {
      projection,
      activationMode: 'absent',
      reasons: [],
    };
  }
  const selection =
    options.activationSelection
    ?? resolveLearningPathProductionSelection({ repoRoot: options.repoRoot });
  const pins = overlayLiveTeachingPins(
    projectionPinsFromSelection(selection),
    readAgreedLiveCourseProjection(options.repoRoot),
  );
  if (selection.mode === 'absent') {
    return {
      projection,
      activationMode: selection.mode,
      reasons: selection.reasons,
    };
  }
  if (selection.mode === 'unavailable') {
    // Fail closed: clear projection identity so the planner cannot execute
    // against a global/caller combination while activation evidence is bad.
    return {
      projection: null,
      activationMode: selection.mode,
      reasons: [
        'learning-path-activation-unavailable',
        ...selection.reasons,
      ],
    };
  }
  if (!pins.projectionId || !pins.authorityReleaseId) {
    return {
      projection,
      activationMode: selection.mode,
      reasons: [
        ...selection.reasons,
        'learning-path-activation-incomplete-combination',
      ],
    };
  }
  // Force activation combination for both READY and pinned/shadow/blocked.
  return {
    projection: {
      authorityReleaseId: pins.authorityReleaseId,
      projectionId: pins.projectionId,
      projectionHash: pins.projectionHash,
      scopeId:
        selection.combination?.scopeId
        ?? projection?.scopeId
        ?? 'unscoped',
      prerequisitePublicationId: projection?.prerequisitePublicationId,
      prerequisiteGraphIdentity: projection?.prerequisiteGraphIdentity,
    },
    activationMode: selection.mode,
    reasons: [
      ...selection.reasons,
      selection.mode === 'pin-combination'
        ? 'learning-path-activation-forced-pin'
        : 'learning-path-activation-forced-combination',
    ],
  };
}

/**
 * Plan a Projection-bound path over ACT REQUIRED prerequisites.
 */
export function planActPrerequisitePath(
  rawInput: ActPathPlannerInput & {
    repoRoot?: string;
    activationSelection?: ConsumerProductionSelection;
  },
): ActPathPlanResult {
  const activated = applyLearningPathConsumerActivation(rawInput.projection, {
    repoRoot: rawInput.repoRoot,
    activationSelection: rawInput.activationSelection,
  });
  // Activation-aware view used by the rest of the planner.
  const input: ActPathPlannerInput = {
    ...rawInput,
    projection: activated.projection,
  };

  const goalCanonicalId = input.goalCanonicalId?.trim() ?? '';
  const mastered = new Set(
    (input.masteredCanonicalIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const engineeringContext = [...(input.engineeringRelations ?? [])];
  const edges = input.prerequisites
    .map(normalizeEdge)
    .filter((edge): edge is NormalizedEdge => edge != null);

  // Diagnostics before projection identity: count raw ACT_TEACHING shapes only.
  const rawRequiredCount = edges.filter(isActTeachingRequired).length;
  const rawRecommendedCount = edges.filter(isActTeachingRecommended).length;

  const baseDiagnostics = {
    reverseTraversalCount: 0,
    masteredExcludedCount: 0,
    requiredEdgeCount: rawRequiredCount,
    recommendedEdgeCount: rawRecommendedCount,
    engineeringRelationCount: engineeringContext.length,
  };

  // 1) Projection / Authority / scope identity
  if (!input.projection) {
    if (input.allowCompatibilityFallback) {
      return buildEmptyResult(
        input,
        'compatibility-fallback',
        [
          {
            code: 'compatibility-fallback',
            message:
              'Legacy path request lacks projection identity; compatibility adapter returned explicit fallback status',
          },
        ],
        baseDiagnostics,
        engineeringContext,
      );
    }
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'missing-projection-identity',
          message: 'Formal ACT path requires Authority/Projection identity',
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  if (!input.projection.authorityReleaseId?.trim()) {
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'missing-authority-identity',
          message: 'Formal ACT path requires authorityReleaseId',
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  if (!input.projection.projectionId?.trim()) {
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'missing-projection-identity',
          message: 'Formal ACT path requires projectionId',
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  if (!input.projection.scopeId?.trim()) {
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'missing-scope',
          message: 'Formal ACT path requires scopeId',
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  // Only PUBLISHED edges bound to the current Projection scope/capture are hard
  // or advisory path edges. CANDIDATE / STALE / REVIEW_REQUIRED and stale
  // captures are ignored (never promoted).
  const projection = input.projection;
  const requiredEdges = edges.filter((edge) => isHardRequiredEdge(edge, projection));
  const recommendedEdges = edges.filter((edge) =>
    isAdvisoryRecommendedEdge(edge, projection),
  );
  baseDiagnostics.requiredEdgeCount = requiredEdges.length;
  baseDiagnostics.recommendedEdgeCount = recommendedEdges.length;

  if (!goalCanonicalId) {
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'goal-not-found',
          message: 'goalCanonicalId is required',
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  // 2) Engineering-only graph: never invent hard edges
  if (
    requiredEdges.length === 0
    && engineeringContext.length > 0
    && !mastered.has(goalCanonicalId)
  ) {
    // Goal may still be pathable alone if it is a core pathEligible node with
    // resources. Engineering relations remain context only.
  } else if (
    requiredEdges.length === 0
    && engineeringContext.length > 0
    && input.coreNodes.length === 0
  ) {
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'engineering-only-relation',
          message:
            'Engineering relations cannot form hard learning-path prerequisites',
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  const coreById = new Map<string, NormalizedCoreNode>();
  for (const raw of input.coreNodes) {
    const node = normalizeCoreNode(raw);
    if (node.canonicalId) coreById.set(node.canonicalId, node);
  }

  const goalCore = coreById.get(goalCanonicalId);
  if (!goalCore) {
    // Goal not in core denominator: treat as engineering-only / not projected.
    if (engineeringContext.some(
      (rel) => rel.sourceId === goalCanonicalId || rel.targetId === goalCanonicalId,
    )) {
      return buildEmptyResult(
        input,
        'blocked',
        [
          {
            code: 'engineering-only-relation',
            message: `Goal ${goalCanonicalId} is only connected by engineering relations and is not an ACT core teaching node`,
            canonicalId: goalCanonicalId,
          },
        ],
        baseDiagnostics,
        engineeringContext,
      );
    }
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'goal-not-found',
          message: `Goal ${goalCanonicalId} is not present in the ACT core teaching-node denominator`,
          canonicalId: goalCanonicalId,
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  if (goalCore.projectionStatus === 'NOT_PROJECTED') {
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'goal-not-projected',
          message: `Goal ${goalCanonicalId} is not projected into the current Teaching Projection`,
          canonicalId: goalCanonicalId,
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  if (!goalCore.pathEligible) {
    return buildEmptyResult(
      input,
      'blocked',
      [
        {
          code: 'goal-not-path-eligible',
          message: `Goal ${goalCanonicalId} has pathEligible=false`,
          canonicalId: goalCanonicalId,
        },
      ],
      baseDiagnostics,
      engineeringContext,
    );
  }

  // 3) Reverse REQUIRED traversal
  const traversal = reverseTraverseRequired(goalCanonicalId, requiredEdges);
  if (traversal.blockers.some((b) => b.code === 'required-cycle')) {
    return buildEmptyResult(
      input,
      'blocked',
      traversal.blockers,
      { ...baseDiagnostics, reverseTraversalCount: traversal.nodes.size },
      engineeringContext,
    );
  }

  // 4) Exclude mastered nodes (goal included if already mastered → empty path)
  const unmet = [...traversal.nodes]
    .filter((id) => !mastered.has(id))
    .sort(compareCodePoint);
  const masteredExcludedCount = traversal.nodes.size - unmet.length;

  if (unmet.length === 0) {
    return {
      schemaVersion: ACT_PREREQUISITE_PATH_PLANNER_VERSION,
      status: 'ready',
      plannerVersion: ACT_PREREQUISITE_PATH_PLANNER_VERSION,
      goalCanonicalId,
      projection: input.projection,
      nodes: [],
      blocked: [],
      recommendedAnnotations: [],
      engineeringContext,
      diagnostics: {
        ...baseDiagnostics,
        reverseTraversalCount: traversal.nodes.size,
        masteredExcludedCount,
      },
    };
  }

  // 5) Gate each unmet node for pathEligible / projection / dangling
  const blockers: ActPathBlocker[] = [];
  for (const id of unmet) {
    const core = coreById.get(id);
    if (!core) {
      blockers.push({
        code: 'dangling-prerequisite',
        message: `REQUIRED prerequisite node ${id} is not in the core teaching-node denominator`,
        canonicalId: id,
      });
      continue;
    }
    if (core.projectionStatus === 'NOT_PROJECTED') {
      blockers.push({
        code: 'goal-not-projected',
        message: `Node ${id} is not projected`,
        canonicalId: id,
      });
      continue;
    }
    if (!core.pathEligible) {
      blockers.push({
        code: 'node-not-path-eligible',
        message: `Node ${id} has pathEligible=false and cannot enter a formal path`,
        canonicalId: id,
      });
    }
  }
  if (blockers.length > 0) {
    return buildEmptyResult(
      input,
      'blocked',
      blockers,
      {
        ...baseDiagnostics,
        reverseTraversalCount: traversal.nodes.size,
        masteredExcludedCount,
      },
      engineeringContext,
    );
  }

  // 6) Deterministic topological order with Canonical-ID tie-breaks
  const topo = topologicalOrderRequired(new Set(unmet), requiredEdges);
  if (topo.blockers.length > 0) {
    return buildEmptyResult(
      input,
      'blocked',
      topo.blockers,
      {
        ...baseDiagnostics,
        reverseTraversalCount: traversal.nodes.size,
        masteredExcludedCount,
      },
      engineeringContext,
    );
  }

  // 7) Resource selection per node — fail closed on missing accessible resources
  const unmetSet = new Set(unmet);
  const recommendedAnnotations: ActPathRecommendedAnnotation[] = recommendedEdges
    .filter(
      (edge) =>
        unmetSet.has(edge.sourceCanonicalId)
        || unmetSet.has(edge.targetCanonicalId)
        || edge.sourceCanonicalId === goalCanonicalId
        || edge.targetCanonicalId === goalCanonicalId,
    )
    .map((edge) => ({
      edgeId: edge.edgeId,
      sourceCanonicalId: edge.sourceCanonicalId,
      targetCanonicalId: edge.targetCanonicalId,
      strength: 'RECOMMENDED' as const,
      evidenceRef: edge.evidenceRef,
      rationale: edge.rationale,
    }))
    .sort((a, b) => compareCodePoint(a.edgeId, b.edgeId));

  const requiredByTarget = new Map<string, string[]>();
  for (const edge of requiredEdges) {
    if (!unmetSet.has(edge.targetCanonicalId)) continue;
    if (!unmetSet.has(edge.sourceCanonicalId) && !mastered.has(edge.sourceCanonicalId)) {
      // Source was filtered (e.g. not in traversal) — skip.
      continue;
    }
    // Only list unmet direct prereqs still on the path; mastered prereqs are
    // already satisfied and omitted from executable path.
    if (!unmetSet.has(edge.sourceCanonicalId)) continue;
    const list = requiredByTarget.get(edge.targetCanonicalId) ?? [];
    list.push(edge.sourceCanonicalId);
    requiredByTarget.set(edge.targetCanonicalId, list);
  }
  for (const [key, list] of requiredByTarget) {
    requiredByTarget.set(key, [...new Set(list)].sort(compareCodePoint));
  }

  const evidenceByTarget = new Map<string, string[]>();
  for (const edge of requiredEdges) {
    if (!unmetSet.has(edge.targetCanonicalId)) continue;
    if (!edge.evidenceRef) continue;
    const list = evidenceByTarget.get(edge.targetCanonicalId) ?? [];
    list.push(edge.evidenceRef);
    evidenceByTarget.set(edge.targetCanonicalId, list);
  }

  const nodes: ActPathPlanNode[] = [];
  for (const [order, canonicalId] of topo.order.entries()) {
    const core = coreById.get(canonicalId)!;
    const candidates = collectCandidatesForNode({
      canonicalId,
      resources: input.resources,
      bindings: input.bindings,
      cards: input.cards,
    });
    const selection = selectAccessibleProjectedResources({
      canonicalId,
      candidates,
      projection: input.projection,
      cardPolicy: core.cardPolicy,
    });

    if (!selection.selected) {
      return buildEmptyResult(
        input,
        'blocked',
        selection.blockers,
        {
          ...baseDiagnostics,
          reverseTraversalCount: traversal.nodes.size,
          masteredExcludedCount,
        },
        engineeringContext,
        recommendedAnnotations,
      );
    }

    const nodeRecommended = recommendedAnnotations.filter(
      (edge) =>
        edge.sourceCanonicalId === canonicalId
        || edge.targetCanonicalId === canonicalId,
    );
    const engineeringContextIds = engineeringContext
      .filter(
        (rel) =>
          rel.sourceId === canonicalId || rel.targetId === canonicalId,
      )
      .map((rel) => rel.id ?? `${rel.predicate}:${rel.sourceId}->${rel.targetId}`)
      .sort(compareCodePoint);

    nodes.push({
      canonicalId,
      order,
      pathEligible: true,
      isGoal: canonicalId === goalCanonicalId,
      requiredPrerequisiteCanonicalIds:
        requiredByTarget.get(canonicalId) ?? [],
      selectedResource: selection.selected,
      alternateResources: selection.alternates,
      annotations: {
        missingOptionalCard: selection.missingOptionalCard,
        recommendedPrerequisites: nodeRecommended,
        engineeringContextIds,
      },
      rationale: {
        canonicalId,
        prerequisiteEvidence: [
          ...new Set(evidenceByTarget.get(canonicalId) ?? []),
        ].sort(compareCodePoint),
        selectionReason: selection.selected.selectionReason,
      },
    });
  }

  return {
    schemaVersion: ACT_PREREQUISITE_PATH_PLANNER_VERSION,
    status: 'ready',
    plannerVersion: ACT_PREREQUISITE_PATH_PLANNER_VERSION,
    goalCanonicalId,
    projection: input.projection,
    nodes,
    blocked: [],
    recommendedAnnotations,
    engineeringContext,
    diagnostics: {
      ...baseDiagnostics,
      reverseTraversalCount: traversal.nodes.size,
      masteredExcludedCount,
    },
  };
}

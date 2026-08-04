/**
 * Step → Canonical → optional card drawer resolution (#1273).
 *
 * Card absence is a resource status, not a node-not-found error.
 * Launch targets are only accepted when the caller supplies an existing
 * registry/route mapping — never invented from raw ActKG node IDs.
 */

import type {
  TeachingCardIndexEntry,
  TeachingProjectionRole,
  TeachingResourceType,
} from '@/lib/teaching-projection/contracts';

import type {
  LayeredGraphFallbackProvenance,
  LayeredGraphPayload,
  TeachingResourceBindingView,
} from './contracts';

export type DrawerCardStatus =
  | 'active-card'
  | 'inactive-card'
  | 'card-absent'
  | 'node-summary-only'
  | 'not-projected';

export interface DrawerCanonicalSummary {
  canonicalId: string;
  /** Student-facing title when known. */
  title: string | null;
  description: string | null;
  presentInEngineering: boolean;
  engineeringType: string | null;
}

export interface DrawerLinkedResource {
  resourceId: string;
  resourceType: TeachingResourceType | null;
  role: TeachingProjectionRole;
  title: string | null;
  primary: boolean;
  sourcePath: string | null;
  /**
   * Launch target resolved via registry/route ownership. Never invented from
   * a Canonical node ID.
   */
  launch: {
    href: string | null;
    source: 'authoritative' | 'fallback' | null;
    disabledReason: string | null;
    registryId: string | null;
  };
}

export interface StepDrawerResolution {
  stepId: string | null;
  scopeId: string | null;
  canonicalId: string;
  cardStatus: DrawerCardStatus;
  /** Active optional card when present. */
  card: TeachingCardIndexEntry | null;
  /** Canonical summary always available when Authority knows the node. */
  summary: DrawerCanonicalSummary;
  /** Linked handout/interactive/textbook/step resources for the node. */
  linkedResources: DrawerLinkedResource[];
  /** Explicit fallback provenance when teaching layer is on fallback. */
  fallback: LayeredGraphFallbackProvenance | null;
  projectionId: string | null;
  projectionHash: string | null;
  /**
   * True only when Canonical is unknown to both engineering and teaching.
   * Optional card absence alone never sets this.
   */
  nodeNotFound: boolean;
  studentMessage: string;
}

export interface ResolveStepDrawerInput {
  payload: LayeredGraphPayload;
  /** Step id for provenance. */
  stepId?: string | null;
  /**
   * Knowledge refs for the current step (Canonical IDs). Required path:
   * step.knowledgeRefs → canonicalId → optional card.
   */
  knowledgeRefs: readonly string[];
  /** Which ref to resolve; defaults to the first. */
  selectedCanonicalId?: string | null;
  /**
   * Optional map from resourceId → launch target owned by course/registry.
   * Callers must supply existing routes; this module never invents them.
   */
  resourceLaunchTargets?: ReadonlyMap<string, string | null> | Record<string, string | null>;
  /**
   * Optional registry ids for resources.
   */
  resourceRegistryIds?: ReadonlyMap<string, string> | Record<string, string>;
  /**
   * Optional human titles for Canonical nodes (e.g. from Authority semanticName
   * or course runtime overlay).
   */
  canonicalTitles?: ReadonlyMap<string, string> | Record<string, string>;
  canonicalDescriptions?: ReadonlyMap<string, string> | Record<string, string>;
}

function asMap<T>(
  value: ReadonlyMap<string, T> | Record<string, T> | undefined,
): Map<string, T> {
  if (!value) return new Map();
  if (value instanceof Map) return value;
  return new Map(Object.entries(value));
}

/**
 * Accept only caller-provided relative/app routes. Reject scheme-bearing or
 * node-id-shaped inventions. Full security validation remains at the launch
 * surface (registry / launch-target).
 */
function resolveLaunchForResource(input: {
  resourceId: string;
  launchTargets: Map<string, string | null>;
  registryIds: Map<string, string>;
  canonicalId: string;
}): DrawerLinkedResource['launch'] {
  const candidate = input.launchTargets.get(input.resourceId) ?? null;
  if (candidate === null || candidate === undefined || candidate === '') {
    return {
      href: null,
      source: null,
      disabledReason: 'missing-registry-or-route',
      registryId: input.registryIds.get(input.resourceId) ?? null,
    };
  }
  // Never invent a route from the Canonical node id.
  if (
    candidate === input.canonicalId
    || candidate === `/knowledge/${input.canonicalId}`
    || candidate.startsWith('node-')
  ) {
    return {
      href: null,
      source: null,
      disabledReason: 'refuses-canonical-id-route',
      registryId: input.registryIds.get(input.resourceId) ?? null,
    };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !candidate.startsWith('/')) {
    // Absolute schemes are deferred to the launch-target security surface.
    // Still pass through string so the UI layer can re-validate.
  }
  return {
    href: candidate,
    source: 'authoritative',
    disabledReason: null,
    registryId: input.registryIds.get(input.resourceId) ?? null,
  };
}

function studentMessageFor(status: DrawerCardStatus, nodeNotFound: boolean): string {
  if (nodeNotFound) {
    return '当前步骤引用的知识点暂不可用。';
  }
  switch (status) {
    case 'active-card':
      return '已加载本步骤关联知识卡片。';
    case 'inactive-card':
      return '知识卡片当前未激活，已展示节点摘要与相关资源。';
    case 'card-absent':
      return '本知识点暂无独立知识卡片，已展示节点摘要与相关资源。';
    case 'node-summary-only':
      return '已展示知识点摘要。';
    case 'not-projected':
      return '该知识点尚未投影到当前课程范围，工程图谱节点仍可用。';
    default:
      return '已展示知识点信息。';
  }
}

/**
 * Resolve drawer content for one step knowledge ref.
 * Missing optional cards never become node-not-found.
 */
export function resolveStepDrawerContent(
  input: ResolveStepDrawerInput,
): StepDrawerResolution | null {
  const refs = input.knowledgeRefs.filter((ref) => ref.trim().length > 0);
  if (refs.length === 0) return null;

  const canonicalId =
    (input.selectedCanonicalId && refs.includes(input.selectedCanonicalId)
      ? input.selectedCanonicalId
      : refs[0]) ?? null;
  if (!canonicalId) return null;

  const payload = input.payload;
  const launchTargets = asMap(input.resourceLaunchTargets);
  const registryIds = asMap(input.resourceRegistryIds);
  const titles = asMap(input.canonicalTitles);
  const descriptions = asMap(input.canonicalDescriptions);

  const engineeringNode =
    payload.engineering.nodes.find((node) => node.canonicalId === canonicalId)
    ?? null;
  const bindings = payload.teachingResources.bindings.filter(
    (binding) => binding.canonicalId === canonicalId,
  );
  const cards = payload.teachingResources.cards.filter(
    (card) => card.canonicalId === canonicalId,
  );
  const activeCard = cards.find((card) => card.active) ?? null;
  const inactiveCard = !activeCard && cards.length > 0 ? cards[0] : null;

  let cardStatus: DrawerCardStatus;
  if (activeCard) {
    cardStatus = 'active-card';
  } else if (inactiveCard) {
    cardStatus = 'inactive-card';
  } else if (
    payload.teachingResources.identity.status === 'absent'
    || payload.teachingResources.identity.status === 'unavailable'
    || payload.teachingResources.identity.status === 'NOT_PROJECTED'
  ) {
    cardStatus = engineeringNode ? 'not-projected' : 'node-summary-only';
  } else if (bindings.length > 0 || engineeringNode) {
    cardStatus = 'card-absent';
  } else {
    cardStatus = 'node-summary-only';
  }

  // Node is only "not found" when neither engineering nor teaching knows it.
  const nodeNotFound = !engineeringNode && bindings.length === 0 && cards.length === 0
    && payload.engineering.identity.status === 'ready';

  // Soft NOT_PROJECTED when Authority has the node but teaching has no binding
  // in the current scope and teaching layer is otherwise ready/fallback.
  if (
    !nodeNotFound
    && engineeringNode
    && bindings.length === 0
    && cards.length === 0
    && (payload.teachingResources.identity.status === 'ready'
      || payload.teachingResources.identity.status === 'fallback')
  ) {
    cardStatus = 'not-projected';
  }

  const title =
    titles.get(canonicalId)
    ?? engineeringNode?.semanticName
    ?? activeCard?.title
    ?? inactiveCard?.title
    ?? null;

  const summary: DrawerCanonicalSummary = {
    canonicalId,
    title,
    description: descriptions.get(canonicalId) ?? null,
    presentInEngineering: Boolean(engineeringNode),
    engineeringType: engineeringNode?.canonicalType ?? null,
  };

  const linkedResources: DrawerLinkedResource[] = bindings.map((binding) =>
    toLinkedResource(binding, launchTargets, registryIds, canonicalId),
  );

  return {
    stepId: input.stepId ?? null,
    scopeId: payload.requestedScope?.scopeId
      ?? payload.teachingResources.identity.scopeId,
    canonicalId,
    cardStatus,
    card: activeCard ?? inactiveCard,
    summary,
    linkedResources,
    fallback: payload.fallback,
    projectionId: payload.teachingResources.identity.projectionId,
    projectionHash: payload.teachingResources.identity.projectionHash,
    nodeNotFound: Boolean(nodeNotFound),
    studentMessage: studentMessageFor(
      cardStatus,
      Boolean(nodeNotFound),
    ),
  };
}

function toLinkedResource(
  binding: TeachingResourceBindingView,
  launchTargets: Map<string, string | null>,
  registryIds: Map<string, string>,
  canonicalId: string,
): DrawerLinkedResource {
  return {
    resourceId: binding.resourceId,
    resourceType: binding.resourceType,
    role: binding.role,
    title: binding.resourceTitle,
    primary: binding.primary,
    sourcePath: binding.sourcePath,
    launch: resolveLaunchForResource({
      resourceId: binding.resourceId,
      launchTargets,
      registryIds,
      canonicalId,
    }),
  };
}

/**
 * Resolve all knowledge refs for a step into ordered drawer entries.
 */
export function resolveStepDrawerEntries(
  input: Omit<ResolveStepDrawerInput, 'selectedCanonicalId'>,
): StepDrawerResolution[] {
  return input.knowledgeRefs
    .filter((ref) => ref.trim().length > 0)
    .map((canonicalId) =>
      resolveStepDrawerContent({
        ...input,
        selectedCanonicalId: canonicalId,
      }),
    )
    .filter((entry): entry is StepDrawerResolution => entry !== null);
}

/**
 * Map resource type to student-facing Chinese label (no implementation detail).
 */
export function teachingResourceTypeLabel(
  type: TeachingResourceType | null,
): string {
  switch (type) {
    case 'lesson':
      return '课程';
    case 'handout':
      return '讲义';
    case 'step':
      return '互动步骤';
    case 'textbook':
    case 'textbook-chapter':
    case 'textbook-section':
      return '教材';
    case 'card':
      return '知识卡片';
    default:
      return '教学资源';
  }
}

export function teachingRoleLabel(role: TeachingProjectionRole): string {
  switch (role) {
    case 'COVERS':
      return '覆盖';
    case 'EXPLAINS':
      return '讲解';
    case 'PRACTICES':
      return '练习';
    case 'ASSESSES':
      return '测评';
    default:
      return role;
  }
}

import type {
  SarAuthorityLevel,
  SarPrivacyScope,
  SarRelationRole,
  SarRetrievalEntity,
  SarRetrievalEvent,
  SarRetrievalEventEntity,
  SarRetrievalResult,
  SarRetrievalTrace,
  SarTraceHop,
} from './structured-associative-retrieval-types';

export type SarAssociationExpansionUseCase =
  | 'source-pack-seeding'
  | 'diagnostic-trace'
  | 'path-planning'
  | 'graph-context';

export type SarAssociationCallerRole = 'student' | 'teacher' | 'admin' | 'auditor';

export interface SarAssociationCallerScope {
  role: SarAssociationCallerRole;
  studentId?: string;
  classId?: string;
}

export interface SarAssociationExpansionInput {
  id?: string;
  query?: string;
  useCase: SarAssociationExpansionUseCase;
  callerScope: SarAssociationCallerScope;
  seedRefs: readonly string[];
  projection: Pick<
    SarRetrievalResult,
    'events' | 'entities' | 'relations' | 'citationTargetRefs' | 'retrievalChunkRefs' | 'limitations'
  > & { trace?: Partial<SarRetrievalTrace> };
  maxHops?: 0 | 1 | 2;
  maxEvents?: number;
  maxEntities?: number;
  minConfidence?: number;
  allowedAuthorityLevels?: readonly SarAuthorityLevel[];
  versionRefs?: readonly string[];
}

export interface SarAssociationCandidateRefs {
  eventIds: string[];
  entityIds: string[];
  citationTargetIds: string[];
  retrievalChunkIds: string[];
  resourceNodeIds: string[];
  planningUnitIds: string[];
}

export interface SarAssociationRejectedRef {
  ref: string;
  reason: string;
}

export interface SarAssociationExpansionResult {
  id: string;
  useCase: SarAssociationExpansionUseCase;
  query?: string;
  candidateRefs: SarAssociationCandidateRefs;
  events: SarRetrievalEvent[];
  entities: SarRetrievalEntity[];
  trace: SarRetrievalTrace;
  limitations: string[];
  sourcePackSeedRefs: string[];
}

interface ScopeDecision {
  allowed: boolean;
  reason?: string;
}

interface FrontierItem {
  entityId: string;
  sourceEntityId: string;
}

interface BudgetedSelection {
  events: SarRetrievalEvent[];
  entities: SarRetrievalEntity[];
  hops: SarTraceHop[];
  seedEntityIds: string[];
}

const DEFAULT_MAX_EVENTS = 24;
const DEFAULT_MAX_ENTITIES = 24;
const DEFAULT_MIN_CONFIDENCE = 0;
const DEFAULT_VERSION_REF = 'sar-association-expansion.v1';

const AUTHORITY_RANK: Record<SarAuthorityLevel, number> = {
  'platform-verified': 0,
  'teacher-approved': 1,
  'metadata-projected': 2,
  'llm-extracted': 3,
};

export function expandSarAssociations(input: SarAssociationExpansionInput): SarAssociationExpansionResult {
  const maxHops = input.maxHops ?? 1;
  const eventById = new Map(input.projection.events.map((event) => [event.id, event]));
  const entityById = new Map(input.projection.entities.map((entity) => [entity.id, entity]));
  const relationsByEntity = groupRelationsByEntity(input.projection.relations);
  const relationsByEvent = groupRelationsByEvent(input.projection.relations);
  const rejectedRefs = new Map<string, SarAssociationRejectedRef>();
  const limitations = new Set<string>([
    ...input.projection.limitations,
    ...(input.projection.trace?.limitations ?? []),
    'source-pack-ranking-required',
    'citation-hydration-required',
  ]);
  const maxEvents = normalizeBudget(input.maxEvents, DEFAULT_MAX_EVENTS, 'maxEvents', limitations);
  const maxEntities = normalizeBudget(input.maxEntities, DEFAULT_MAX_ENTITIES, 'maxEntities', limitations);
  const minConfidence = normalizeMinConfidence(input.minConfidence, limitations);
  const seedEntityIds = new Set<string>();
  const directSeedEntityIds = new Set<string>();
  const seedEventIds = new Set<string>();
  const entityDepth = new Map<string, number>();
  const eventDepth = new Map<string, number>();

  for (const seedRef of uniqueSorted(input.seedRefs)) {
    if (entityById.has(seedRef)) {
      const decision = entityScopeDecision(entityById.get(seedRef), input.callerScope);
      if (decision.allowed) {
        seedEntityIds.add(seedRef);
        directSeedEntityIds.add(seedRef);
      }
      else reject(rejectedRefs, seedRef, decision.reason ?? 'entity-scope-filtered');
      continue;
    }
    if (eventById.has(seedRef)) {
      const decision = eventScopeDecision(eventById.get(seedRef), input);
      if (!decision.allowed) {
        reject(rejectedRefs, seedRef, decision.reason ?? 'event-scope-filtered');
        continue;
      }
      const relationEntityDecision = relationEntitiesScopeDecision(
        relationsByEvent.get(seedRef) ?? [],
        entityById,
        input.callerScope,
        '',
        rejectedRefs,
      );
      if (!relationEntityDecision.allowed) {
        reject(rejectedRefs, seedRef, relationEntityDecision.reason ?? 'event-entity-scope-filtered');
        continue;
      }
      seedEventIds.add(seedRef);
      setMinDepth(eventDepth, seedRef, 0);
      for (const relation of relationsByEvent.get(seedRef) ?? []) {
        const relatedEntity = entityById.get(relation.entityId);
        const entityDecision = entityScopeDecision(relatedEntity, input.callerScope);
        if (entityDecision.allowed) {
          seedEntityIds.add(relation.entityId);
          setMinDepth(entityDepth, relation.entityId, 0);
        } else {
          reject(rejectedRefs, relation.entityId, entityDecision.reason ?? 'entity-scope-filtered');
        }
      }
      continue;
    }
    reject(rejectedRefs, seedRef, 'seed-ref-not-found');
  }

  if (seedEntityIds.size === 0 && seedEventIds.size === 0) {
    limitations.add('no-resolved-seed-refs');
  }

  const selectedEventIds = new Set<string>();
  const selectedEntityIds = new Set<string>();
  const expansionHops: SarTraceHop[] = [];

  for (const entityId of seedEntityIds) {
    selectedEntityIds.add(entityId);
    setMinDepth(entityDepth, entityId, 0);
  }
  for (const eventId of seedEventIds) {
    selectedEventIds.add(eventId);
    setMinDepth(eventDepth, eventId, 0);
  }

  for (const entityId of directSeedEntityIds) {
    collectDirectEvents({
      entityId,
      relationsByEntity,
      relationsByEvent,
      entityById,
      eventById,
      selectedEventIds,
      rejectedRefs,
      input,
      minConfidence,
      eventDepth,
      entityDepth,
    });
  }

  let frontier: FrontierItem[] = [...directSeedEntityIds].map((entityId) => ({ entityId, sourceEntityId: entityId }));
  for (let hop = 1; hop <= maxHops; hop += 1) {
    const nextFrontier: FrontierItem[] = [];
    for (const item of frontier) {
      const sourceRelations = relationsByEntity.get(item.entityId) ?? [];
      for (const sourceRelation of sourceRelations) {
        if (sourceRelation.confidence < minConfidence) {
          reject(rejectedRefs, sourceRelation.eventId, 'low-confidence-relation');
          continue;
        }
        const event = eventById.get(sourceRelation.eventId);
        const eventDecision = eventScopeDecision(event, input);
        if (!eventDecision.allowed) {
          reject(rejectedRefs, sourceRelation.eventId, eventDecision.reason ?? 'event-scope-filtered');
          continue;
        }
        const connectedRelations = relationsByEvent.get(sourceRelation.eventId) ?? [];
        const connectedEntityDecision = relationEntitiesScopeDecision(
          connectedRelations,
          entityById,
          input.callerScope,
          item.entityId,
          rejectedRefs,
        );
        if (!connectedEntityDecision.allowed) {
          reject(rejectedRefs, sourceRelation.eventId, connectedEntityDecision.reason ?? 'event-entity-scope-filtered');
          continue;
        }
        selectedEventIds.add(sourceRelation.eventId);
        setMinDepth(eventDepth, sourceRelation.eventId, entityDepth.get(item.entityId) ?? hop - 1);
        for (const connectedRelation of connectedRelations) {
          if (connectedRelation.entityId === item.entityId) continue;
          if (connectedRelation.confidence < minConfidence) {
            reject(rejectedRefs, connectedRelation.entityId, 'low-confidence-relation');
            continue;
          }
          const entity = entityById.get(connectedRelation.entityId);
          const entityDecision = entityScopeDecision(entity, input.callerScope);
          if (!entityDecision.allowed) {
            reject(rejectedRefs, connectedRelation.entityId, entityDecision.reason ?? 'entity-scope-filtered');
            continue;
          }
          if (selectedEntityIds.has(connectedRelation.entityId)) continue;
          selectedEntityIds.add(connectedRelation.entityId);
          setMinDepth(entityDepth, connectedRelation.entityId, hop);
          expansionHops.push({
            fromEntityId: item.entityId,
            toEntityId: connectedRelation.entityId,
            viaEventId: connectedRelation.eventId,
            relationRole: connectedRelation.role,
            confidence: Math.min(sourceRelation.confidence, connectedRelation.confidence),
          });
          nextFrontier.push({
            entityId: connectedRelation.entityId,
            sourceEntityId: item.sourceEntityId,
          });
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  const expandedEvents = sortedEvents(
    [...selectedEventIds].map((eventId) => eventById.get(eventId)).filter(isPresent),
    eventDepth,
  );
  const expandedEntities = sortedEntities(
    [...selectedEntityIds].map((entityId) => entityById.get(entityId)).filter(isPresent),
    entityDepth,
  );
  const selection = budgetConnectedSelection({
    expandedEvents,
    expandedEntities,
    expansionHops,
    seedEntityIds,
    eventDepth,
    maxEvents,
    maxEntities,
  });
  const rejectedRefValues = [...rejectedRefs.values()].sort((left, right) => left.ref.localeCompare(right.ref));
  const rejectedRefSet = new Set(rejectedRefValues.map((item) => item.ref));
  const events = selection.events.filter((event) => !rejectedRefSet.has(event.id));
  const entities = selection.entities.filter((entity) => !rejectedRefSet.has(entity.id));
  const hops = selection.hops.filter((hop) => (
    !rejectedRefSet.has(hop.fromEntityId)
    && !rejectedRefSet.has(hop.toEntityId)
    && (!hop.viaEventId || !rejectedRefSet.has(hop.viaEventId))
  ));
  const seedEntityIdsForTrace = selection.seedEntityIds.filter((entityId) => !rejectedRefSet.has(entityId));
  const candidateRefs = buildCandidateRefs(events, entities, hops, input.projection, maxHops);
  if (expandedEvents.length > maxEvents) limitations.add(`event-budget:${maxEvents}`);
  if (expandedEntities.length > maxEntities) limitations.add(`entity-budget:${maxEntities}`);
  if (expansionHops.length === 0 && maxHops > 0) limitations.add('no-expansion-hop-selected');

  const selectedRefs = uniqueSorted([
    ...candidateRefs.eventIds,
    ...candidateRefs.entityIds,
    ...candidateRefs.citationTargetIds,
    ...candidateRefs.retrievalChunkIds,
    ...candidateRefs.resourceNodeIds,
    ...candidateRefs.planningUnitIds,
  ]);
  const trace: SarRetrievalTrace = {
    id: input.id ? `sar:trace:association:${input.id}` : 'sar:trace:association',
    seedEntityIds: seedEntityIdsForTrace,
    expansionHops: hops,
    selectedRefs,
    rejectedRefs: rejectedRefValues,
    limitations: uniqueSorted([...limitations]),
    versionRefs: uniqueSorted([
      DEFAULT_VERSION_REF,
      ...(input.versionRefs ?? []),
      ...(input.projection.trace?.versionRefs ?? []),
    ]),
  };

  return {
    id: input.id ? `sar:association:${input.id}` : 'sar:association',
    useCase: input.useCase,
    query: input.query,
    candidateRefs,
    events,
    entities,
    trace,
    limitations: trace.limitations,
    sourcePackSeedRefs: selectedRefs,
  };
}

function collectDirectEvents(input: {
  entityId: string;
  relationsByEntity: Map<string, SarRetrievalEventEntity[]>;
  relationsByEvent: Map<string, SarRetrievalEventEntity[]>;
  entityById: Map<string, SarRetrievalEntity>;
  eventById: Map<string, SarRetrievalEvent>;
  selectedEventIds: Set<string>;
  rejectedRefs: Map<string, SarAssociationRejectedRef>;
  input: SarAssociationExpansionInput;
  minConfidence: number;
  eventDepth: Map<string, number>;
  entityDepth: Map<string, number>;
}): void {
  for (const relation of input.relationsByEntity.get(input.entityId) ?? []) {
    if (relation.confidence < input.minConfidence) {
      reject(input.rejectedRefs, relation.eventId, 'low-confidence-relation');
      continue;
    }
    const event = input.eventById.get(relation.eventId);
    const decision = eventScopeDecision(event, input.input);
    if (!decision.allowed) {
      reject(input.rejectedRefs, relation.eventId, decision.reason ?? 'event-scope-filtered');
      continue;
    }
    const connectedEntityDecision = relationEntitiesScopeDecision(
      input.relationsByEvent.get(relation.eventId) ?? [],
      input.entityById,
      input.input.callerScope,
      input.entityId,
      input.rejectedRefs,
    );
    if (!connectedEntityDecision.allowed) {
      reject(input.rejectedRefs, relation.eventId, connectedEntityDecision.reason ?? 'event-entity-scope-filtered');
      continue;
    }
    input.selectedEventIds.add(relation.eventId);
    setMinDepth(input.eventDepth, relation.eventId, input.entityDepth.get(input.entityId) ?? 0);
  }
}

function buildCandidateRefs(
  events: SarRetrievalEvent[],
  entities: SarRetrievalEntity[],
  hops: SarTraceHop[],
  projection: Pick<SarRetrievalResult, 'events' | 'citationTargetRefs' | 'retrievalChunkRefs'>,
  maxHops: 0 | 1 | 2,
): SarAssociationCandidateRefs {
  const eventIds = new Set(events.map((event) => event.id));
  const hopEntityIds = new Set(hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId]));
  const hopEventIds = new Set(hops.map((hop) => hop.viaEventId).filter(isPresent));
  const hasConnectedEvidence = hops.length > 0 || entities.some((entity) => hopEntityIds.has(entity.id));
  const includeProjectionRefs = projection.events.length > 0
    && projection.events.every((event) => eventIds.has(event.id))
    && hasConnectedEvidence;
  const connectedEvents = events.filter((event) => maxHops === 0 || hopEventIds.has(event.id));
  const connectedEntities = maxHops === 0
    ? entities
    : entities.filter((entity) => (
        entity.entityType !== 'resource-node'
        && entity.entityType !== 'planning-unit'
        && entity.entityType !== 'citation-target'
      ) || hopEntityIds.has(entity.id));
  return {
    eventIds: events.map((event) => event.id),
    entityIds: entities.map((entity) => entity.id),
    citationTargetIds: uniqueSorted([
      ...(includeProjectionRefs ? projection.citationTargetRefs : []),
      ...connectedEvents.map((event) => stringMetadata(event, 'citationTargetId')).filter(isPresent),
      ...connectedEvents.flatMap((event) => stringArrayMetadata(event, 'citationTargetIds')),
      ...connectedEntities.map((entity) => entity.entityType === 'citation-target' ? entity.canonicalRef : '').filter(Boolean),
    ]),
    retrievalChunkIds: uniqueSorted([
      ...(includeProjectionRefs ? projection.retrievalChunkRefs : []),
      ...connectedEvents.map((event) => stringMetadata(event, 'retrievalChunkId')).filter(isPresent),
      ...connectedEvents.map((event) => stringMetadata(event, 'chunkId')).filter(isPresent),
      ...connectedEvents.flatMap((event) => stringArrayMetadata(event, 'retrievalChunkIds')),
      ...connectedEvents.flatMap((event) => stringArrayMetadata(event, 'chunkIds')),
    ]),
    resourceNodeIds: uniqueSorted([
      ...connectedEvents.map((event) => stringMetadata(event, 'resourceNodeId')).filter(isPresent),
      ...connectedEvents.flatMap((event) => stringArrayMetadata(event, 'resourceNodeIds')),
      ...connectedEntities.map((entity) => entity.entityType === 'resource-node' ? entity.canonicalRef : '').filter(Boolean),
    ]),
    planningUnitIds: uniqueSorted([
      ...connectedEvents.map((event) => stringMetadata(event, 'planningUnitId')).filter(isPresent),
      ...connectedEvents.flatMap((event) => stringArrayMetadata(event, 'planningUnitIds')),
      ...connectedEntities.map((entity) => entity.entityType === 'planning-unit' ? entity.canonicalRef : '').filter(Boolean),
    ]),
  };
}

function eventScopeDecision(
  event: SarRetrievalEvent | undefined,
  input: Pick<SarAssociationExpansionInput, 'callerScope' | 'useCase' | 'allowedAuthorityLevels'>,
): ScopeDecision {
  if (!event) return { allowed: false, reason: 'event-not-found' };
  const { callerScope } = input;
  const privacyScopeDecision = privacyDecision(event.privacyScope, callerScope.role);
  if (!privacyScopeDecision.allowed) return privacyScopeDecision;
  const authorityScopeDecision = authorityDecision(event.sourceRef.authorityLevel, input);
  if (!authorityScopeDecision.allowed) return authorityScopeDecision;
  const useCaseScopeDecision = eventUseCaseDecision(event, input.useCase);
  if (!useCaseScopeDecision.allowed) return useCaseScopeDecision;
  const studentId = eventStudentId(event);
  if (studentId && callerScope.role === 'student') {
    if (!callerScope.studentId) return { allowed: false, reason: 'student-scope-required' };
    if (callerScope.studentId !== studentId) return { allowed: false, reason: 'student-scope-mismatch' };
  }
  const classId = eventClassId(event);
  if (studentId && callerScope.role === 'teacher' && !classId) {
    return { allowed: false, reason: 'class-scope-required' };
  }
  if (classId && (callerScope.role === 'student' || callerScope.role === 'teacher')) {
    if (!callerScope.classId) return { allowed: false, reason: 'class-scope-required' };
    if (callerScope.classId !== classId) return { allowed: false, reason: 'class-scope-mismatch' };
  }
  return { allowed: true };
}

function eventStudentId(event: SarRetrievalEvent): string | null {
  return stringMetadata(event, 'studentId')
    ?? stringMetadata(event, 'ownerUserId')
    ?? stringSourceRef(event, 'studentId')
    ?? stringSourceRef(event, 'ownerUserId');
}

function eventClassId(event: SarRetrievalEvent): string | null {
  return stringMetadata(event, 'classId') ?? stringSourceRef(event, 'classId');
}

function entityScopeDecision(
  entity: SarRetrievalEntity | undefined,
  callerScope: SarAssociationCallerScope,
): ScopeDecision {
  if (!entity) return { allowed: false, reason: 'entity-not-found' };
  const privacyScopeDecision = privacyDecision(entity.privacyScope, callerScope.role);
  if (!privacyScopeDecision.allowed) return privacyScopeDecision;
  if (entity.entityType === 'student') {
    if (callerScope.role === 'admin' || callerScope.role === 'auditor') return { allowed: true };
    if (!callerScope.studentId) return { allowed: false, reason: 'student-scope-required' };
    return callerScope.studentId === entity.canonicalRef
      ? { allowed: true }
      : { allowed: false, reason: 'student-scope-mismatch' };
  }
  if (entity.entityType === 'class') {
    if (callerScope.role === 'admin' || callerScope.role === 'auditor') return { allowed: true };
    if (!callerScope.classId) return { allowed: false, reason: 'class-scope-required' };
    return callerScope.classId === entity.canonicalRef
      ? { allowed: true }
      : { allowed: false, reason: 'class-scope-mismatch' };
  }
  return { allowed: true };
}

function relationEntitiesScopeDecision(
  relations: readonly SarRetrievalEventEntity[],
  entityById: ReadonlyMap<string, SarRetrievalEntity>,
  callerScope: SarAssociationCallerScope,
  sourceEntityId: string,
  rejectedRefs: Map<string, SarAssociationRejectedRef>,
): ScopeDecision {
  for (const relation of relations) {
    if (relation.entityId === sourceEntityId) continue;
    const entity = entityById.get(relation.entityId);
    const decision = entityScopeDecision(entity, callerScope);
    if (decision.allowed) continue;
    reject(rejectedRefs, relation.entityId, decision.reason ?? 'entity-scope-filtered');
    return { allowed: false, reason: `event-linked-${decision.reason ?? 'entity-scope-filtered'}` };
  }
  return { allowed: true };
}

function privacyDecision(privacyScope: SarPrivacyScope, role: SarAssociationCallerRole): ScopeDecision {
  if (privacyScope === 'student-visible') return { allowed: true };
  if (privacyScope === 'teacher-scoped') {
    return ['teacher', 'admin', 'auditor'].includes(role)
      ? { allowed: true }
      : { allowed: false, reason: 'teacher-scope-required' };
  }
  if (privacyScope === 'admin-scoped') {
    return role === 'admin' || role === 'auditor'
      ? { allowed: true }
      : { allowed: false, reason: 'admin-scope-required' };
  }
  if (privacyScope === 'audit-only') {
    return role === 'auditor'
      ? { allowed: true }
      : { allowed: false, reason: 'audit-scope-required' };
  }
  return { allowed: false, reason: 'system-internal-scope' };
}

function authorityDecision(
  authorityLevel: SarAuthorityLevel,
  input: Pick<SarAssociationExpansionInput, 'useCase' | 'allowedAuthorityLevels'>,
): ScopeDecision {
  const allowed = new Set(input.allowedAuthorityLevels ?? defaultAuthorityLevels(input.useCase));
  return allowed.has(authorityLevel)
    ? { allowed: true }
    : { allowed: false, reason: `authority-not-allowed:${authorityLevel}` };
}

function defaultAuthorityLevels(useCase: SarAssociationExpansionUseCase): SarAuthorityLevel[] {
  if (useCase === 'diagnostic-trace') {
    return ['platform-verified', 'teacher-approved', 'metadata-projected', 'llm-extracted'];
  }
  return ['platform-verified', 'teacher-approved', 'metadata-projected'];
}

function eventUseCaseDecision(event: SarRetrievalEvent, useCase: SarAssociationExpansionUseCase): ScopeDecision {
  const declaredUseCase = stringMetadata(event, 'useCase');
  if (declaredUseCase && declaredUseCase !== useCase) {
    return { allowed: false, reason: `use-case-mismatch:${declaredUseCase}` };
  }
  const declaredUseCases = stringArrayMetadata(event, 'useCases');
  if (declaredUseCases.length > 0 && !declaredUseCases.includes(useCase)) {
    return { allowed: false, reason: 'use-case-mismatch' };
  }
  return { allowed: true };
}

function groupRelationsByEntity(relations: readonly SarRetrievalEventEntity[]): Map<string, SarRetrievalEventEntity[]> {
  const grouped = new Map<string, SarRetrievalEventEntity[]>();
  for (const relation of relations) {
    const current = grouped.get(relation.entityId) ?? [];
    current.push(relation);
    grouped.set(relation.entityId, current);
  }
  for (const [entityId, values] of grouped) grouped.set(entityId, stableRelations(values));
  return grouped;
}

function groupRelationsByEvent(relations: readonly SarRetrievalEventEntity[]): Map<string, SarRetrievalEventEntity[]> {
  const grouped = new Map<string, SarRetrievalEventEntity[]>();
  for (const relation of relations) {
    const current = grouped.get(relation.eventId) ?? [];
    current.push(relation);
    grouped.set(relation.eventId, current);
  }
  for (const [eventId, values] of grouped) grouped.set(eventId, stableRelations(values));
  return grouped;
}

function sortedEvents(events: SarRetrievalEvent[], eventDepth: ReadonlyMap<string, number>): SarRetrievalEvent[] {
  return [...events].sort((left, right) => {
    const depth = (eventDepth.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (eventDepth.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    if (depth !== 0) return depth;
    const authority = AUTHORITY_RANK[left.sourceRef.authorityLevel] - AUTHORITY_RANK[right.sourceRef.authorityLevel];
    if (authority !== 0) return authority;
    return left.id.localeCompare(right.id);
  });
}

function sortedEntities(entities: SarRetrievalEntity[], entityDepth: ReadonlyMap<string, number>): SarRetrievalEntity[] {
  return [...entities].sort((left, right) => {
    const depth = (entityDepth.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (entityDepth.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    if (depth !== 0) return depth;
    return left.id.localeCompare(right.id);
  });
}

function stableRelations(relations: SarRetrievalEventEntity[]): SarRetrievalEventEntity[] {
  return [...relations].sort((left, right) => {
    const eventOrder = left.eventId.localeCompare(right.eventId);
    if (eventOrder !== 0) return eventOrder;
    const entityOrder = left.entityId.localeCompare(right.entityId);
    if (entityOrder !== 0) return entityOrder;
    return roleOrder(left.role) - roleOrder(right.role);
  });
}

function stableHops(hops: SarTraceHop[]): SarTraceHop[] {
  return [...hops].sort((left, right) => {
    const from = left.fromEntityId.localeCompare(right.fromEntityId);
    if (from !== 0) return from;
    const to = left.toEntityId.localeCompare(right.toEntityId);
    if (to !== 0) return to;
    return (left.viaEventId ?? '').localeCompare(right.viaEventId ?? '');
  });
}

function budgetConnectedSelection(input: {
  expandedEvents: SarRetrievalEvent[];
  expandedEntities: SarRetrievalEntity[];
  expansionHops: SarTraceHop[];
  seedEntityIds: ReadonlySet<string>;
  eventDepth: ReadonlyMap<string, number>;
  maxEvents: number;
  maxEntities: number;
}): BudgetedSelection {
  const entityById = new Map(input.expandedEntities.map((entity) => [entity.id, entity]));
  const eventBudgetIds = new Set(input.expandedEvents.slice(0, input.maxEvents).map((event) => event.id));
  const selectedEntityIds = new Set<string>();
  const seedEntityIds: string[] = [];

  for (const seedEntityId of uniqueSorted([...input.seedEntityIds])) {
    if (seedEntityIds.length >= input.maxEntities) break;
    if (!entityById.has(seedEntityId)) continue;
    selectedEntityIds.add(seedEntityId);
    seedEntityIds.push(seedEntityId);
  }

  let changed = true;
  const hops = stableHops(input.expansionHops);
  while (changed && selectedEntityIds.size < input.maxEntities) {
    changed = false;
    for (const hop of hops) {
      if (selectedEntityIds.size >= input.maxEntities) break;
      if (!selectedEntityIds.has(hop.fromEntityId)) continue;
      if (selectedEntityIds.has(hop.toEntityId)) continue;
      if (!entityById.has(hop.toEntityId)) continue;
      if (hop.viaEventId && !eventBudgetIds.has(hop.viaEventId)) continue;
      selectedEntityIds.add(hop.toEntityId);
      changed = true;
    }
  }

  const selectedEntities = input.expandedEntities.filter((entity) => selectedEntityIds.has(entity.id));
  const selectedHops = hops.filter((hop) => (
    selectedEntityIds.has(hop.fromEntityId)
    && selectedEntityIds.has(hop.toEntityId)
    && (!hop.viaEventId || eventBudgetIds.has(hop.viaEventId))
  ));
  const eventsNeededByHops = new Set(selectedHops.map((hop) => hop.viaEventId).filter(isPresent));
  const directEventIds = new Set(input.expandedEvents
    .filter((event) => eventBudgetIds.has(event.id))
    .filter((event) => (input.eventDepth.get(event.id) ?? Number.MAX_SAFE_INTEGER) === 0)
    .filter(() => selectedEntityIds.size > 0)
    .map((event) => event.id));
  const selectedEventIds = new Set([...eventsNeededByHops, ...directEventIds]);
  const selectedEvents = input.expandedEvents.filter((event) => selectedEventIds.has(event.id));

  return {
    events: selectedEvents,
    entities: selectedEntities,
    hops: selectedHops,
    seedEntityIds,
  };
}

function roleOrder(role: SarRelationRole): number {
  return ['about', 'supports', 'requires', 'evidence-for', 'generated-from', 'candidate-for', 'rejects'].indexOf(role);
}

function stringMetadata(event: SarRetrievalEvent, key: string): string | null {
  const value = event.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function stringSourceRef(event: SarRetrievalEvent, key: string): string | null {
  const value = (event.sourceRef as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function stringArrayMetadata(event: SarRetrievalEvent, key: string): string[] {
  const value = event.metadata?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function reject(
  rejectedRefs: Map<string, SarAssociationRejectedRef>,
  ref: string,
  reason: string,
): void {
  if (!rejectedRefs.has(ref)) rejectedRefs.set(ref, { ref, reason });
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) => left.localeCompare(right));
}

function setMinDepth(depths: Map<string, number>, id: string, depth: number): void {
  const current = depths.get(id);
  if (current === undefined || depth < current) depths.set(id, depth);
}

function normalizeBudget(
  value: number | undefined,
  fallback: number,
  name: string,
  limitations: Set<string>,
): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) {
    limitations.add(`invalid-${name}:${String(value)}`);
    return fallback;
  }
  return Math.floor(value);
}

function normalizeMinConfidence(value: number | undefined, limitations: Set<string>): number {
  if (value === undefined) return DEFAULT_MIN_CONFIDENCE;
  if (!Number.isFinite(value)) {
    limitations.add(`invalid-minConfidence:${String(value)}`);
    return DEFAULT_MIN_CONFIDENCE;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isPresent<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

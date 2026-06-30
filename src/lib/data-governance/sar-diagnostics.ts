import {
  expandSarAssociations,
  type SarAssociationExpansionResult,
} from './sar-association-expansion';
import type {
  SarAuthorityLevel,
  SarPrivacyScope,
  SarRetrievalEntity,
  SarRetrievalEvent,
  SarRetrievalEventEntity,
  SarRetrievalResult,
  SarRetrievalTrace,
} from './structured-associative-retrieval-types';

export type SarDiagnosticsTraceInput = {
  id: string;
  query: string;
  result: SarRetrievalResult;
  sourcePackHandoffRefs?: readonly string[];
  verifiedCitationRefs?: readonly string[];
  ordinarySourcePackRefs?: readonly string[];
  sarAssistedRefs?: readonly string[];
};

export type SarDiagnosticsTraceSummary = {
  id: string;
  query: string;
  hopCount: number;
  selectedEventCount: number;
  selectedEntityCount: number;
  rejectedRefCount: number;
  privacyRejectionCount: number;
  limitationCount: number;
  sourcePackHandoffCount: number;
  verifiedCitationRate: number;
};

export type SerializedSarTraceForDiagnostics = {
  id: string;
  seedEntityIds: string[];
  expandedEntityIds: string[];
  selectedEventIds: string[];
  selectedRefs: string[];
  rejectedRefs: Array<{ ref: string; reason: string }>;
  limitations: string[];
  versionRefs: string[];
  downstream: {
    sourcePackHandoffRefs: string[];
    verifiedCitationRefs: string[];
    verifiedCitationRate: number;
  };
  events: Array<{
    id: string;
    eventType: SarRetrievalEvent['eventType'];
    title: string;
    safeSummary: string;
    privacyScope: SarPrivacyScope;
    sourceRef: Pick<SarRetrievalEvent['sourceRef'], 'id' | 'owner' | 'authorityLevel' | 'freshness'>;
  }>;
  entities: Array<{
    id: string;
    entityType: SarRetrievalEntity['entityType'];
    canonicalRef: string;
    label: string;
    privacyScope: SarPrivacyScope;
  }>;
};

export type SarDiagnosticsReport = {
  generatedAt: string;
  totals: {
    eventCount: number;
    entityCount: number;
    relationCount: number;
    queryCount: number;
    averageHopCount: number;
    privacyRejectionCount: number;
    limitationCount: number;
    sourcePackHandoffCount: number;
    verifiedCitationRate: number;
    sarCandidateAdoptionCount: number;
    sarCandidateRejectionCount: number;
  };
  eventTypeCounts: Record<string, number>;
  sourceOwnerCounts: Record<string, number>;
  privacyScopeCounts: Record<string, number>;
  authorityLevelCounts: Record<string, number>;
  limitationCounts: Record<string, number>;
  queryTraceSummaries: SarDiagnosticsTraceSummary[];
  serializedTraces: SerializedSarTraceForDiagnostics[];
  comparison: {
    ordinarySourcePackRefCount: number;
    sarAssistedRefCount: number;
    adoptedRefCount: number;
    rejectedRefCount: number;
  };
  demoFixtureStatus?: {
    id: string;
    deterministic: boolean;
    query: string;
    sourcePackHandoff: boolean;
    verifiedCitationOutcome: 'available' | 'missing';
  };
};

export type ControlCorrectionSarDemoFixture = {
  id: string;
  query: string;
  result: SarRetrievalResult;
  expansion: SarAssociationExpansionResult;
  report: SarDiagnosticsReport;
};

export function serializeSarTraceForDiagnostics(input: SarDiagnosticsTraceInput): SerializedSarTraceForDiagnostics {
  const result = exportableSarResult(input.result);
  const nonExportableRefs = nonExportableDiagnosticRefs(input.result);
  const sourcePackHandoffRefs = exportableDiagnosticRefs(input.sourcePackHandoffRefs ?? result.retrievalChunkRefs, input.result);
  const verifiedCitationRefs = verifiedCitationTargetRefs(
    exportableDiagnosticRefs(input.verifiedCitationRefs ?? [], input.result),
    result.citationTargetRefs,
  );
  const verifiedCitationRate = rate(verifiedCitationRefs.length, uniqueSorted(result.citationTargetRefs).length);

  return {
    id: redactSensitiveDiagnosticRef(result.trace.id),
    seedEntityIds: redactRefList(result.trace.seedEntityIds),
    expandedEntityIds: redactRefList(result.entities.map((entity) => entity.id)),
    selectedEventIds: redactRefList(result.events.map((event) => event.id)),
    selectedRefs: redactRefList(result.trace.selectedRefs),
    rejectedRefs: result.trace.rejectedRefs.map((item) => serializeRejectedRef(item, input.result, nonExportableRefs)),
    limitations: mergedDiagnosticLimitations(result),
    versionRefs: redactRefList(result.trace.versionRefs),
    downstream: {
      sourcePackHandoffRefs: redactRefList(sourcePackHandoffRefs),
      verifiedCitationRefs: redactRefList(verifiedCitationRefs),
      verifiedCitationRate,
    },
    events: result.events.map((event) => ({
      id: redactSensitiveDiagnosticRef(event.id),
      eventType: event.eventType,
      title: redactSensitiveDiagnosticText(event.title),
      safeSummary: redactSensitiveDiagnosticText(event.safeSummary),
      privacyScope: event.privacyScope,
      sourceRef: {
        id: redactSensitiveDiagnosticRef(event.sourceRef.id),
        owner: event.sourceRef.owner,
        authorityLevel: event.sourceRef.authorityLevel,
        freshness: event.sourceRef.freshness,
      },
    })),
    entities: result.entities.map((entity) => ({
      id: redactSensitiveDiagnosticRef(entity.id),
      entityType: entity.entityType,
      canonicalRef: entity.entityType === 'student' ? '[redacted]' : redactSensitiveDiagnosticRef(entity.canonicalRef),
      label: redactSensitiveDiagnosticText(entity.label),
      privacyScope: entity.privacyScope,
    })),
  };
}

export function buildSarDiagnosticsReport(input: {
  generatedAt: string;
  traces: readonly SarDiagnosticsTraceInput[];
  demoFixtureStatus?: SarDiagnosticsReport['demoFixtureStatus'];
}): SarDiagnosticsReport {
  const eventTypeCounts: Record<string, number> = {};
  const sourceOwnerCounts: Record<string, number> = {};
  const privacyScopeCounts: Record<string, number> = {};
  const authorityLevelCounts: Record<string, number> = {};
  const limitationCounts: Record<string, number> = {};
  const queryTraceSummaries: SarDiagnosticsTraceSummary[] = [];
  const serializedTraces = input.traces.map(serializeSarTraceForDiagnostics);

  let eventCount = 0;
  let entityCount = 0;
  let relationCount = 0;
  let hopCount = 0;
  let privacyRejectionCount = 0;
  let limitationCount = 0;
  let sourcePackHandoffCount = 0;
  let verifiedCitationNumerator = 0;
  let verifiedCitationDenominator = 0;
  let ordinarySourcePackRefCount = 0;
  let sarAssistedRefCount = 0;
  let adoptedRefCount = 0;
  let rejectedRefCount = 0;

  for (const traceInput of input.traces) {
    const result = exportableSarResult(traceInput.result);
    const tracePrivacyRejections = countPrivacyRejections(result.trace);
    const traceLimitations = mergedDiagnosticLimitations(result);
    const sourcePackHandoffRefs = exportableDiagnosticRefs(
      traceInput.sourcePackHandoffRefs ?? result.retrievalChunkRefs,
      traceInput.result,
    );
    const verifiedCitationRefs = verifiedCitationTargetRefs(
      exportableDiagnosticRefs(traceInput.verifiedCitationRefs ?? [], traceInput.result),
      result.citationTargetRefs,
    );
    const citationTargetRefs = uniqueSorted(result.citationTargetRefs);
    const ordinarySourcePackRefs = exportableDiagnosticRefs(traceInput.ordinarySourcePackRefs ?? [], traceInput.result);
    const sarAssistedRefs = exportableDiagnosticRefs(traceInput.sarAssistedRefs ?? result.retrievalChunkRefs, traceInput.result);
    const adoptedRefs = sarAssistedRefs.filter((ref) => !ordinarySourcePackRefs.includes(ref));

    eventCount += result.events.length;
    entityCount += result.entities.length;
    relationCount += result.relations.length;
    hopCount += result.trace.expansionHops.length;
    privacyRejectionCount += tracePrivacyRejections;
    limitationCount += traceLimitations.length;
    sourcePackHandoffCount += sourcePackHandoffRefs.length;
    verifiedCitationNumerator += verifiedCitationRefs.length;
    verifiedCitationDenominator += citationTargetRefs.length;
    ordinarySourcePackRefCount += ordinarySourcePackRefs.length;
    sarAssistedRefCount += sarAssistedRefs.length;
    adoptedRefCount += adoptedRefs.length;
    rejectedRefCount += result.trace.rejectedRefs.length;

    for (const event of result.events) {
      increment(eventTypeCounts, event.eventType);
      increment(sourceOwnerCounts, event.sourceRef.owner);
      increment(privacyScopeCounts, event.privacyScope);
      increment(authorityLevelCounts, event.sourceRef.authorityLevel);
    }
    for (const entity of result.entities) {
      increment(privacyScopeCounts, entity.privacyScope);
    }
    for (const limitation of traceLimitations) {
      increment(limitationCounts, limitation);
    }

    queryTraceSummaries.push({
      id: redactSensitiveDiagnosticRef(traceInput.id),
      query: redactSensitiveDiagnosticText(traceInput.query),
      hopCount: result.trace.expansionHops.length,
      selectedEventCount: result.events.length,
      selectedEntityCount: result.entities.length,
      rejectedRefCount: result.trace.rejectedRefs.length,
      privacyRejectionCount: tracePrivacyRejections,
      limitationCount: traceLimitations.length,
      sourcePackHandoffCount: sourcePackHandoffRefs.length,
      verifiedCitationRate: rate(verifiedCitationRefs.length, citationTargetRefs.length),
    });
  }

  return {
    generatedAt: input.generatedAt,
    totals: {
      eventCount,
      entityCount,
      relationCount,
      queryCount: input.traces.length,
      averageHopCount: rate(hopCount, input.traces.length),
      privacyRejectionCount,
      limitationCount,
      sourcePackHandoffCount,
      verifiedCitationRate: rate(verifiedCitationNumerator, verifiedCitationDenominator),
      sarCandidateAdoptionCount: adoptedRefCount,
      sarCandidateRejectionCount: rejectedRefCount,
    },
    eventTypeCounts,
    sourceOwnerCounts,
    privacyScopeCounts,
    authorityLevelCounts,
    limitationCounts,
    queryTraceSummaries,
    serializedTraces,
    comparison: {
      ordinarySourcePackRefCount,
      sarAssistedRefCount,
      adoptedRefCount,
      rejectedRefCount,
    },
    demoFixtureStatus: input.demoFixtureStatus,
  };
}

export function buildControlCorrectionSarDemoFixture(generatedAt = new Date().toISOString()): ControlCorrectionSarDemoFixture {
  const query = 'Why address frequency response margins before controller correction simulation and Arena validation?';
  const projection = controlCorrectionProjection();
  const expansion = expandSarAssociations({
    id: 'control-correction-demo',
    query,
    useCase: 'diagnostic-trace',
    callerScope: { role: 'teacher', classId: 'class-control-demo' },
    seedRefs: [
      'sar:entity:goal:control-correction',
      'sar:entity:simulation:controller-correction',
      'sar:event:hidden-arena-internals',
    ],
    projection,
    maxHops: 2,
    maxEvents: 12,
    maxEntities: 12,
    versionRefs: ['sar-diagnostics-demo.v1'],
  });
  const selectedEventIds = new Set(expansion.events.map((event) => event.id));
  const selectedEntityIds = new Set(expansion.entities.map((entity) => entity.id));
  const selectedRelations = projection.relations.filter((relation) => (
    selectedEventIds.has(relation.eventId) && selectedEntityIds.has(relation.entityId)
  ));
  const result: SarRetrievalResult = {
    id: 'sar:result:control-correction-demo',
    trace: expansion.trace,
    events: expansion.events,
    entities: expansion.entities,
    relations: selectedRelations,
    citationTargetRefs: ['citation:frequency-margin-source', 'citation:arena-validation-source'],
    retrievalChunkRefs: ['chunk:source-pack:frequency-margin', 'chunk:source-pack:arena-validation'],
    limitations: expansion.limitations,
  };
  const sourcePackHandoffRefs = result.retrievalChunkRefs;
  const report = buildSarDiagnosticsReport({
    generatedAt,
    traces: [{
      id: 'control-correction-demo',
      query,
      result,
      sourcePackHandoffRefs,
      verifiedCitationRefs: ['citation:frequency-margin-source'],
      ordinarySourcePackRefs: ['chunk:source-pack:frequency-margin'],
      sarAssistedRefs: result.retrievalChunkRefs,
    }],
    demoFixtureStatus: {
      id: 'control-correction-demo',
      deterministic: true,
      query,
      sourcePackHandoff: sourcePackHandoffRefs.length > 0,
      verifiedCitationOutcome: 'available',
    },
  });

  return {
    id: 'control-correction-demo',
    query,
    result,
    expansion,
    report,
  };
}

function controlCorrectionProjection(): Pick<
  SarRetrievalResult,
  'events' | 'entities' | 'relations' | 'citationTargetRefs' | 'retrievalChunkRefs' | 'limitations'
> & { trace: Partial<SarRetrievalTrace> } {
  const events: SarRetrievalEvent[] = [
    event('sar:event:goal:control-correction', 'path-summary', 'Control correction learning goal', 'The learner needs a sequenced path from frequency margins to controller correction.', 'student-visible', 'LearningGoal', 'platform-verified'),
    event('sar:event:frequency-margin-resource', 'resource-node', 'Frequency response margin resource', 'Source Pack resource explains gain and phase margins before correction design.', 'student-visible', 'ResourceNode', 'teacher-approved', {
      resourceNodeId: 'resource:frequency-response-margins',
      retrievalChunkId: 'chunk:source-pack:frequency-margin',
      citationTargetId: 'citation:frequency-margin-source',
    }),
    event('sar:event:learner-margin-limitation', 'learning-fact-summary', 'Learner limitation on stability margins', 'Learner evidence shows uncertainty about margin interpretation.', 'teacher-scoped', 'StudentEvidenceFeatureCache', 'metadata-projected', {
      studentId: 'student-control-demo',
      classId: 'class-control-demo',
      rawLearnerSubmission: 'private raw answer omitted by diagnostics serialization',
    }),
    event('sar:event:correction-simulation', 'simulation-summary', 'Controller correction simulation', 'Simulation evidence validates overshoot and settling-time changes after correction.', 'teacher-scoped', 'SimulationRun', 'platform-verified', {
      classId: 'class-control-demo',
      resourceNodeId: 'resource:controller-correction-simulation',
    }),
    event('sar:event:arena-validation', 'arena-summary', 'Arena official evaluation handoff', 'Arena official evaluation provides downstream validation for the corrected controller.', 'teacher-scoped', 'ArenaEvaluationRun', 'platform-verified', {
      classId: 'class-control-demo',
      citationTargetId: 'citation:arena-validation-source',
      retrievalChunkId: 'chunk:source-pack:arena-validation',
    }),
    event('sar:event:hidden-arena-internals', 'arena-summary', 'Hidden Arena internals', 'Audit-only internals are present in projection but must not serialize.', 'audit-only', 'ArenaEvaluationRun', 'platform-verified', {
      hiddenArenaEvaluationInternalsPayload: { rawScoreVector: [1, 0, 1] },
    }),
  ];
  const entities: SarRetrievalEntity[] = [
    entity('sar:entity:goal:control-correction', 'learning-goal', 'goal:control-correction', 'Control correction goal', 'student-visible'),
    entity('sar:entity:graph:frequency-margins', 'graph-node', 'graph:frequency-response-margins', 'Frequency response margins', 'student-visible'),
    entity('sar:entity:resource:frequency-margin', 'resource-node', 'resource:frequency-response-margins', 'Frequency margin Source Pack', 'student-visible'),
    entity('sar:entity:student:control-demo', 'student', 'student-control-demo', 'Control demo learner', 'teacher-scoped'),
    entity('sar:entity:simulation:controller-correction', 'resource-node', 'resource:controller-correction-simulation', 'Controller correction simulation', 'teacher-scoped'),
    entity('sar:entity:arena:official-validation', 'planning-unit', 'arena:official-controller-validation', 'Arena official validation', 'teacher-scoped'),
  ];
  const relations: SarRetrievalEventEntity[] = [
    relation('sar:event:goal:control-correction', 'sar:entity:goal:control-correction', 'about', 1),
    relation('sar:event:goal:control-correction', 'sar:entity:graph:frequency-margins', 'requires', 0.96),
    relation('sar:event:frequency-margin-resource', 'sar:entity:graph:frequency-margins', 'about', 0.94),
    relation('sar:event:frequency-margin-resource', 'sar:entity:resource:frequency-margin', 'supports', 0.92),
    relation('sar:event:learner-margin-limitation', 'sar:entity:graph:frequency-margins', 'evidence-for', 0.87),
    relation('sar:event:learner-margin-limitation', 'sar:entity:student:control-demo', 'generated-from', 0.87),
    relation('sar:event:correction-simulation', 'sar:entity:graph:frequency-margins', 'requires', 0.83),
    relation('sar:event:correction-simulation', 'sar:entity:simulation:controller-correction', 'supports', 0.91),
    relation('sar:event:arena-validation', 'sar:entity:simulation:controller-correction', 'requires', 0.86),
    relation('sar:event:arena-validation', 'sar:entity:arena:official-validation', 'supports', 0.9),
    relation('sar:event:hidden-arena-internals', 'sar:entity:arena:official-validation', 'evidence-for', 0.9),
  ];

  return {
    events,
    entities,
    relations,
    citationTargetRefs: ['citation:frequency-margin-source', 'citation:arena-validation-source'],
    retrievalChunkRefs: ['chunk:source-pack:frequency-margin', 'chunk:source-pack:arena-validation'],
    limitations: ['citation-hydration-required'],
    trace: {
      limitations: ['learner-evidence-limited-to-teacher-scope'],
      versionRefs: ['sar-projection.fixture.control-correction.v1'],
    },
  };
}

function event(
  id: string,
  eventType: SarRetrievalEvent['eventType'],
  title: string,
  safeSummary: string,
  privacyScope: SarPrivacyScope,
  owner: string,
  authorityLevel: SarAuthorityLevel,
  metadata: Record<string, unknown> = {},
): SarRetrievalEvent {
  return {
    id,
    eventType,
    title,
    safeSummary,
    privacyScope,
    sourceRef: {
      id,
      owner,
      authorityLevel,
      freshness: '2026-06-30T00:00:00.000Z',
      classId: typeof metadata.classId === 'string' ? metadata.classId : null,
      ownerUserId: typeof metadata.studentId === 'string' ? metadata.studentId : null,
    },
    metadata,
  };
}

function entity(
  id: string,
  entityType: SarRetrievalEntity['entityType'],
  canonicalRef: string,
  label: string,
  privacyScope: SarPrivacyScope,
): SarRetrievalEntity {
  return {
    id,
    entityType,
    canonicalRef,
    label,
    aliases: [],
    privacyScope,
    extraction: 'platform-stable-id',
  };
}

function relation(
  eventId: string,
  entityId: string,
  role: SarRetrievalEventEntity['role'],
  confidence: number,
): SarRetrievalEventEntity {
  return {
    eventId,
    entityId,
    role,
    confidence,
    provenance: 'metadata-projection',
    source: 'control-correction-sar-demo',
  };
}

function countPrivacyRejections(trace: SarRetrievalTrace): number {
  return trace.rejectedRefs.filter((item) => (
    item.reason.includes('scope')
    || item.reason.includes('privacy')
    || item.reason.includes('internal')
  )).length;
}

function exportableSarResult(result: SarRetrievalResult): SarRetrievalResult {
  const exportableEventIds = new Set(
    result.events
      .filter((event) => isExportablePrivacyScope(event.privacyScope))
      .map((event) => event.id),
  );
  const exportableEntityIds = new Set(
    result.entities
      .filter((entity) => isExportablePrivacyScope(entity.privacyScope))
      .map((entity) => entity.id),
  );
  const nonExportableRefs = nonExportableDiagnosticRefs(result);
  const events = result.events.filter((event) => exportableEventIds.has(event.id));
  const entities = result.entities.filter((entity) => exportableEntityIds.has(entity.id));
  const relations = result.relations.filter((relation) => (
    exportableEventIds.has(relation.eventId) && exportableEntityIds.has(relation.entityId)
  ));
  return {
    ...result,
    events,
    entities,
    relations,
    citationTargetRefs: exportableDiagnosticRefs(result.citationTargetRefs, result, nonExportableRefs),
    retrievalChunkRefs: exportableDiagnosticRefs(result.retrievalChunkRefs, result, nonExportableRefs),
    trace: {
      ...result.trace,
      seedEntityIds: exportableDiagnosticRefs(result.trace.seedEntityIds, result, nonExportableRefs),
      versionRefs: exportableDiagnosticRefs(result.trace.versionRefs, result, nonExportableRefs),
      expansionHops: result.trace.expansionHops.filter((hop) => (
        exportableEntityIds.has(hop.fromEntityId)
        && exportableEntityIds.has(hop.toEntityId)
        && (!hop.viaEventId || exportableEventIds.has(hop.viaEventId))
      )),
      selectedRefs: exportableDiagnosticRefs(result.trace.selectedRefs, result, nonExportableRefs),
    },
  };
}

function isExportablePrivacyScope(scope: SarPrivacyScope): boolean {
  return scope === 'student-visible' || scope === 'teacher-scoped' || scope === 'admin-scoped';
}

function isPrivateEventRef(ref: string, result: SarRetrievalResult): boolean {
  const event = result.events.find((candidate) => candidate.id === ref);
  return Boolean(event && !isExportablePrivacyScope(event.privacyScope));
}

function isPrivateEntityRef(ref: string, result: SarRetrievalResult): boolean {
  const entity = result.entities.find((candidate) => candidate.id === ref);
  return Boolean(entity && !isExportablePrivacyScope(entity.privacyScope));
}

function serializeRejectedRef(
  item: SarRetrievalTrace['rejectedRefs'][number],
  result: SarRetrievalResult,
  nonExportableRefs: ReadonlySet<string>,
): { ref: string; reason: string } {
  const redactedRef = redactSensitiveDiagnosticRef(item.ref);
  if (!isExportableDiagnosticRef(item.ref, result, nonExportableRefs) || redactedRef === '[redacted]') {
    return {
      ref: '[redacted]',
      reason: '[redacted]',
    };
  }
  return {
    ref: redactedRef,
    reason: redactSensitiveDiagnosticText(item.reason),
  };
}

function exportableDiagnosticRefs(
  values: readonly string[],
  result: SarRetrievalResult,
  nonExportableRefs = nonExportableDiagnosticRefs(result),
): string[] {
  return uniqueSorted(values.filter((ref) => isExportableDiagnosticRef(ref, result, nonExportableRefs)));
}

function isExportableDiagnosticRef(
  ref: string,
  result: SarRetrievalResult,
  nonExportableRefs: ReadonlySet<string>,
): boolean {
  return !nonExportableRefs.has(ref)
    && !isPrivateEventRef(ref, result)
    && !isPrivateEntityRef(ref, result);
}

function nonExportableDiagnosticRefs(result: SarRetrievalResult): Set<string> {
  const refs = new Set<string>();
  for (const event of result.events) {
    if (isExportablePrivacyScope(event.privacyScope)) continue;
    refs.add(event.id);
    refs.add(event.sourceRef.id);
    collectStringRefs(event.metadata, refs);
  }
  for (const entity of result.entities) {
    if (isExportablePrivacyScope(entity.privacyScope)) continue;
    refs.add(entity.id);
    refs.add(entity.canonicalRef);
  }
  return refs;
}

function collectStringRefs(value: unknown, refs: Set<string>): void {
  if (typeof value === 'string') {
    refs.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringRefs(item, refs));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStringRefs(item, refs));
  }
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function mergedDiagnosticLimitations(result: SarRetrievalResult): string[] {
  return uniqueSorted([...result.trace.limitations, ...result.limitations].map(redactSensitiveDiagnosticText));
}

function redactRefList(values: readonly string[]): string[] {
  return uniqueSorted(values.map(redactSensitiveDiagnosticRef));
}

function verifiedCitationTargetRefs(
  verifiedCitationRefs: readonly string[],
  citationTargetRefs: readonly string[],
): string[] {
  const citationTargets = new Set(uniqueSorted(citationTargetRefs));
  return uniqueSorted(verifiedCitationRefs).filter((ref) => citationTargets.has(ref));
}

function redactSensitiveDiagnosticText(value: string): string {
  if (SENSITIVE_DIAGNOSTIC_TEXT.some((pattern) => pattern.test(value))) {
    return '[redacted]';
  }
  return value;
}

function redactSensitiveDiagnosticRef(value: string): string {
  if (
    SENSITIVE_DIAGNOSTIC_TEXT.some((pattern) => pattern.test(value))
    || SENSITIVE_DIAGNOSTIC_REF.some((pattern) => pattern.test(value))
  ) {
    return '[redacted]';
  }
  return value;
}

const SENSITIVE_DIAGNOSTIC_TEXT = [
  /\braw(?:Content|Evidence|LearnerSubmissions?|Submissions?|Answers?|AnswerBod(?:y|ies)|Trace|TraceJson|Traces|TracePayload)\b/i,
  /\blearnerSubmissions?\b/i,
  /\bhidden(?:ArenaInternals|ArenaEvaluationInternals|EvaluationInternals)\b/i,
  /\bauditOnlyTrace\b/i,
  /\braw[_ -]?(answer|answers|evidence|submission|submissions|trace|payload)\b/i,
  /\braw\b.*\b(answer|answers|evidence|submission|submissions|trace|payload)\b/i,
  /\bhidden[_ -]?(arena|evaluation|internals)/i,
  /\bhidden\b.*\b(arena|evaluation|internals)\b/i,
  /\binternals?\b/i,
  /\bprivate[_ -]?konling[_ -]?memory\b/i,
  /\baudit[_ -]?only\b/i,
  /\bsystem[_ -]?internal\b/i,
  /\baudit[_ -]?only[_ -]?trace\b/i,
];

const SENSITIVE_DIAGNOSTIC_REF = [
  /(^|[:/_-])raw(?:Content|Evidence|LearnerSubmissions?|Submissions?|Answers?|AnswerBod(?:y|ies)|Trace|TraceJson|Traces|TracePayload)($|[:/_-])/i,
  /(^|[:/_-])learnerSubmissions?($|[:/_-])/i,
  /(^|[:/_-])hidden(?:ArenaInternals|ArenaEvaluationInternals|EvaluationInternals)($|[:/_-])/i,
  /(^|[:/_-])auditOnlyTrace($|[:/_-])/i,
  /(^|[:/_-])private($|[:/_-])/i,
  /(^|[:/_-])private[-_]?(source|student|memory|evidence|submission|payload|trace|ref)($|[:/_-])/i,
  /(^|[:/_-])audit[-_]?only($|[:/_-])/i,
  /(^|[:/_-])raw($|[:/_-])/i,
];

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  validateSarEntity,
  validateSarEvent,
  validateSarRelation,
  validateSarResult,
  validateSarTrace,
  type SarRetrievalEntity,
  type SarRetrievalEvent,
  type SarRetrievalEventEntity,
  type SarRetrievalResult,
  type SarRetrievalTrace,
  type SarValidationIssue,
} from './structured-associative-retrieval';

export type SarQueryTraceScope = 'student' | 'class' | 'teacher' | 'admin' | 'system';

export type SarQueryTraceExportEligibility =
  | 'admin-export'
  | 'teacher-export'
  | 'excluded';

export type SarQueryTraceHandoffStatus =
  | 'not-started'
  | 'source-pack-pending'
  | 'citation-verification-pending'
  | 'ready'
  | 'blocked';

export type SarQueryTraceMinimizationPolicy =
  | 'delete-details-after-retention'
  | 'aggregate-after-retention'
  | 'redact-details-after-retention';

export interface SarPersistedSourceRef {
  id: string;
  owner: string;
  authorityLevel: SarRetrievalEvent['sourceRef']['authorityLevel'];
  freshness: string;
  contentHash?: string;
  ownerUserIdHash?: string;
  classIdHash?: string;
}

export interface SarPersistedEventRecord {
  stableId: string;
  eventType: SarRetrievalEvent['eventType'];
  title: string;
  safeSummary: string;
  sourceRef: SarPersistedSourceRef;
  authorityLevel: SarRetrievalEvent['sourceRef']['authorityLevel'];
  privacyScope: SarRetrievalEvent['privacyScope'];
  freshness: string;
  contentHash: string;
  versionRefs: string[];
  writtenAt: string;
  updatedAt: string;
}

export interface SarPersistedEntityRecord {
  stableId: string;
  entityType: SarRetrievalEntity['entityType'];
  canonicalRef: string;
  label: string;
  aliases: string[];
  privacyScope: SarRetrievalEntity['privacyScope'];
  extraction: SarRetrievalEntity['extraction'];
  contentHash: string;
  versionRefs: string[];
  writtenAt: string;
  updatedAt: string;
}

export interface SarPersistedRelationRecord {
  stableId: string;
  eventId: string;
  entityId: string;
  role: SarRetrievalEventEntity['role'];
  confidence: number;
  provenance: SarRetrievalEventEntity['provenance'];
  source: string;
  contentHash: string;
  versionRefs: string[];
  writtenAt: string;
  updatedAt: string;
}

export interface SarQueryTraceRetention {
  storedAt: string;
  retainUntil: string;
  minimizeAfter?: string;
  minimizationPolicy: SarQueryTraceMinimizationPolicy;
}

export interface SarQueryTraceScopeRef {
  scope: SarQueryTraceScope;
  studentIdHash?: string;
  classIdHash?: string;
  teacherIdHash?: string;
}

export interface SarPersistedQueryTraceRecord {
  stableId: string;
  queryRole: string;
  useCase: string;
  queryHash: string;
  scope: SarQueryTraceScopeRef;
  retention: SarQueryTraceRetention;
  exportEligibility: SarQueryTraceExportEligibility;
  handoffStatus: SarQueryTraceHandoffStatus;
  seedEntityIds: string[];
  expansionHops: SarRetrievalTrace['expansionHops'];
  selectedRefs: string[];
  rejectedRefs: SarRetrievalTrace['rejectedRefs'];
  limitations: string[];
  versionRefs: string[];
  minimized: boolean;
  aggregateCounts?: {
    seedEntityIds: number;
    expansionHops: number;
    selectedRefs: number;
    rejectedRefs: number;
  };
  contentHash: string;
  writtenAt: string;
  updatedAt: string;
}

export interface SarPersistenceSnapshot {
  schemaVersion: 'sar-persistence.v1';
  generatedAt: string;
  events: Record<string, SarPersistedEventRecord>;
  entities: Record<string, SarPersistedEntityRecord>;
  relations: Record<string, SarPersistedRelationRecord>;
  queryTraces: Record<string, SarPersistedQueryTraceRecord>;
}

export interface SarPersistenceExport {
  schemaVersion: SarPersistenceSnapshot['schemaVersion'];
  generatedAt: string;
  exportedAt: string;
  events: SarPersistedEventRecord[];
  entities: SarPersistedEntityRecord[];
  relations: SarPersistedRelationRecord[];
  queryTraces: SarPersistedQueryTraceRecord[];
}

export interface SarPersistResultOptions {
  versionRefs?: string[];
  now?: string;
}

export interface SarPersistQueryTraceInput {
  result: SarRetrievalResult;
  queryRole: string;
  useCase: string;
  queryIdentity: unknown;
  scope: SarQueryTraceScopeRef;
  retention: SarQueryTraceRetention;
  exportEligibility: SarQueryTraceExportEligibility;
  handoffStatus: SarQueryTraceHandoffStatus;
  now?: string;
}

export interface SarPersistenceRepositoryOptions {
  filePath?: string;
  now?: () => string;
  snapshot?: SarPersistenceSnapshot;
}

export interface SarPersistenceWriteResult {
  persisted: boolean;
  issues: SarValidationIssue[];
}

const SNAPSHOT_KEYS = new Set([
  'schemaVersion',
  'generatedAt',
  'events',
  'entities',
  'relations',
  'queryTraces',
]);

const QUERY_TRACE_RECORD_KEYS = new Set([
  'stableId',
  'queryRole',
  'useCase',
  'queryHash',
  'scope',
  'retention',
  'exportEligibility',
  'handoffStatus',
  'seedEntityIds',
  'expansionHops',
  'selectedRefs',
  'rejectedRefs',
  'limitations',
  'versionRefs',
  'minimized',
  'aggregateCounts',
  'contentHash',
  'writtenAt',
  'updatedAt',
]);

const PERSISTED_EVENT_RECORD_KEYS = new Set([
  'stableId',
  'eventType',
  'title',
  'safeSummary',
  'sourceRef',
  'authorityLevel',
  'privacyScope',
  'freshness',
  'contentHash',
  'versionRefs',
  'writtenAt',
  'updatedAt',
]);

const PERSISTED_ENTITY_RECORD_KEYS = new Set([
  'stableId',
  'entityType',
  'canonicalRef',
  'label',
  'aliases',
  'privacyScope',
  'extraction',
  'contentHash',
  'versionRefs',
  'writtenAt',
  'updatedAt',
]);

const PERSISTED_RELATION_RECORD_KEYS = new Set([
  'stableId',
  'eventId',
  'entityId',
  'role',
  'confidence',
  'provenance',
  'source',
  'contentHash',
  'versionRefs',
  'writtenAt',
  'updatedAt',
]);

const PERSISTED_SOURCE_REF_KEYS = new Set([
  'id',
  'owner',
  'authorityLevel',
  'freshness',
  'contentHash',
  'ownerUserIdHash',
  'classIdHash',
]);

const QUERY_TRACE_SCOPE_REF_KEYS = new Set([
  'scope',
  'studentIdHash',
  'classIdHash',
  'teacherIdHash',
]);

const QUERY_TRACE_RETENTION_KEYS = new Set([
  'storedAt',
  'retainUntil',
  'minimizeAfter',
  'minimizationPolicy',
]);

const QUERY_TRACE_AGGREGATE_COUNTS_KEYS = new Set([
  'seedEntityIds',
  'expansionHops',
  'selectedRefs',
  'rejectedRefs',
]);

const EXPORT_ELIGIBILITY = new Set<SarQueryTraceExportEligibility>([
  'admin-export',
  'teacher-export',
  'excluded',
]);

const HANDOFF_STATUS = new Set<SarQueryTraceHandoffStatus>([
  'not-started',
  'source-pack-pending',
  'citation-verification-pending',
  'ready',
  'blocked',
]);

const MINIMIZATION_POLICIES = new Set<SarQueryTraceMinimizationPolicy>([
  'delete-details-after-retention',
  'aggregate-after-retention',
  'redact-details-after-retention',
]);

const QUERY_TRACE_SCOPES = new Set<SarQueryTraceScope>([
  'student',
  'class',
  'teacher',
  'admin',
  'system',
]);

const RESTRICTED_TRACE_TEXT = [
  /\braw[_ -]?answer[_ -]?bod(?:y|ies)\b/i,
  /\braw[_ -]?answers?\b/i,
  /\braw[_ -]?learner[_ -]?submissions?\b/i,
  /\braw[_ -]?submissions?\b/i,
  /\braw[_ -]?trace(?:s|[_ -]?payload)?\b/i,
  /\bhidden[_ -]?arena[_ -]?evaluation[_ -]?internals?\b/i,
  /\bhidden[_ -]?arena[_ -]?internals?\b/i,
  /\bprivate[_ -]?konling[_ -]?memory\b/i,
  /\baudit[_ -]?only[_ -]?trace\b/i,
  /\baudit[_ -]?trace\b/i,
];

export function createEmptySarPersistenceSnapshot(now = new Date().toISOString()): SarPersistenceSnapshot {
  return {
    schemaVersion: 'sar-persistence.v1',
    generatedAt: now,
    events: {},
    entities: {},
    relations: {},
    queryTraces: {},
  };
}

export function hashSarQueryIdentity(identity: unknown): string {
  return `sar:query:sha256:${stableHash(identity)}`;
}

export function createSarPersistenceRepository(
  options: SarPersistenceRepositoryOptions = {},
): SarPersistenceRepository {
  return new SarPersistenceRepository(options);
}

export class SarPersistenceRepository {
  private snapshot: SarPersistenceSnapshot;
  private readonly filePath?: string;
  private readonly now: () => string;

  constructor(options: SarPersistenceRepositoryOptions = {}) {
    this.filePath = options.filePath;
    this.now = options.now ?? (() => new Date().toISOString());
    const initialSnapshot = options.snapshot ?? this.loadSnapshot() ?? createEmptySarPersistenceSnapshot(this.now());
    const validation = validateSnapshot(initialSnapshot);
    if (validation.length > 0) {
      throw new Error(`Invalid SAR persistence snapshot: ${validation.map((issue) => issue.path).join(', ')}`);
    }
    this.snapshot = deepClone(initialSnapshot);
  }

  getSnapshot(): SarPersistenceSnapshot {
    return deepClone(this.snapshot);
  }

  restore(snapshot: SarPersistenceSnapshot): SarPersistenceWriteResult {
    const validation = validateSnapshot(snapshot);
    if (validation.length > 0) return { persisted: false, issues: validation };
    this.snapshot = deepClone(snapshot);
    this.flush();
    return { persisted: true, issues: [] };
  }

  rebuild(results: readonly SarRetrievalResult[], options: SarPersistResultOptions = {}): SarPersistenceWriteResult {
    const next = createEmptySarPersistenceSnapshot(options.now ?? this.now());
    for (const result of results) {
      const issues = validateSarResult(result).issues;
      if (issues.length > 0) return { persisted: false, issues };
      const versionRefs = options.versionRefs ?? result.trace.versionRefs;
      const versionRefIssues = validateVersionRefs(versionRefs);
      if (versionRefIssues.length > 0) return { persisted: false, issues: versionRefIssues };
      persistResultIntoSnapshot(next, result, versionRefs, options.now ?? this.now());
    }
    next.queryTraces = this.snapshot.queryTraces;
    this.snapshot = next;
    this.flush();
    return { persisted: true, issues: [] };
  }

  upsertResult(result: SarRetrievalResult, options: SarPersistResultOptions = {}): SarPersistenceWriteResult {
    const issues = validateSarResult(result).issues;
    if (issues.length > 0) return { persisted: false, issues };
    const versionRefs = options.versionRefs ?? result.trace.versionRefs;
    const versionRefIssues = validateVersionRefs(versionRefs);
    if (versionRefIssues.length > 0) return { persisted: false, issues: versionRefIssues };
    persistResultIntoSnapshot(
      this.snapshot,
      result,
      versionRefs,
      options.now ?? this.now(),
    );
    this.snapshot.generatedAt = options.now ?? this.now();
    this.flush();
    return { persisted: true, issues: [] };
  }

  upsertQueryTrace(input: SarPersistQueryTraceInput): SarPersistenceWriteResult {
    const resultIssues = validateSarResult(input.result).issues;
    if (resultIssues.length > 0) return { persisted: false, issues: resultIssues };
    const traceIssues = validateSarTrace(input.result.trace).issues;
    if (traceIssues.length > 0) return { persisted: false, issues: traceIssues };
    const retentionIssues = validateTracePersistenceInput(input);
    if (retentionIssues.length > 0) return { persisted: false, issues: retentionIssues };

    const now = input.now ?? this.now();
    const trace = input.result.trace;
    persistResultIntoSnapshot(this.snapshot, input.result, trace.versionRefs, now);
    const stableId = trace.id;
    const previous = this.snapshot.queryTraces[stableId];
    const next: SarPersistedQueryTraceRecord = {
      stableId,
      queryRole: input.queryRole,
      useCase: input.useCase,
      queryHash: hashSarQueryIdentity(input.queryIdentity),
      scope: { ...input.scope },
      retention: { ...input.retention },
      exportEligibility: input.exportEligibility,
      handoffStatus: input.handoffStatus,
      seedEntityIds: [...trace.seedEntityIds],
      expansionHops: trace.expansionHops.map((hop) => ({ ...hop })),
      selectedRefs: [...trace.selectedRefs],
      rejectedRefs: trace.rejectedRefs.map((ref) => ({ ...ref })),
      limitations: [...trace.limitations],
      versionRefs: [...trace.versionRefs],
      minimized: false,
      contentHash: stableHash({
        trace,
        queryHash: hashSarQueryIdentity(input.queryIdentity),
        scope: input.scope,
        retention: input.retention,
        handoffStatus: input.handoffStatus,
      }),
      writtenAt: previous?.writtenAt ?? now,
      updatedAt: now,
    };

    this.snapshot.queryTraces[stableId] = minimizeTraceIfExpired(next, now);
    this.snapshot.generatedAt = now;
    this.flush();
    return { persisted: true, issues: [] };
  }

  minimizeExpiredTraces(now = this.now()): void {
    for (const [id, trace] of Object.entries(this.snapshot.queryTraces)) {
      this.snapshot.queryTraces[id] = minimizeTraceIfExpired(trace, now);
    }
    this.snapshot.generatedAt = now;
    this.flush();
  }

  exportSafeSnapshot(now = this.now()): SarPersistenceExport {
    const activeEvents = Object.values(this.snapshot.events)
      .filter((record) => isExportableScope(record.privacyScope));
    const activeEntities = Object.values(this.snapshot.entities)
      .filter((record) => isExportableScope(record.privacyScope));
    const eventIds = new Set(activeEvents.map((record) => record.stableId));
    const entityIds = new Set(activeEntities.map((record) => record.stableId));

    return deepClone({
      schemaVersion: this.snapshot.schemaVersion,
      generatedAt: this.snapshot.generatedAt,
      exportedAt: now,
      events: activeEvents,
      entities: activeEntities,
      relations: Object.values(this.snapshot.relations)
        .filter((record) => eventIds.has(record.eventId) && entityIds.has(record.entityId)),
      queryTraces: Object.values(this.snapshot.queryTraces)
        .map((trace) => minimizeTraceIfExpired(trace, now))
        .filter(isExportEligibleQueryTrace)
        .map((trace) => filterTraceRefsForExport(trace, eventIds, entityIds)),
    });
  }

  private loadSnapshot(): SarPersistenceSnapshot | null {
    if (!this.filePath || !existsSync(this.filePath)) return null;
    return JSON.parse(readFileSync(this.filePath, 'utf8')) as SarPersistenceSnapshot;
  }

  private flush(): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(this.snapshot, null, 2)}\n`, 'utf8');
    renameSync(tempPath, this.filePath);
  }
}

function persistResultIntoSnapshot(
  snapshot: SarPersistenceSnapshot,
  result: SarRetrievalResult,
  versionRefs: string[],
  now: string,
): void {
  for (const event of result.events) {
    const key = event.id;
    const previous = snapshot.events[key];
    snapshot.events[key] = {
      stableId: event.id,
      eventType: event.eventType,
      title: event.title,
      safeSummary: event.safeSummary,
      sourceRef: sanitizeSourceRef(event.sourceRef),
      authorityLevel: event.sourceRef.authorityLevel,
      privacyScope: event.privacyScope,
      freshness: event.sourceRef.freshness,
      contentHash: event.sourceRef.contentHash ?? stableHash(event),
      versionRefs: [...versionRefs],
      writtenAt: previous?.writtenAt ?? now,
      updatedAt: now,
    };
  }

  for (const entity of result.entities) {
    const key = entity.id;
    const previous = snapshot.entities[key];
    snapshot.entities[key] = {
      stableId: entity.id,
      entityType: entity.entityType,
      canonicalRef: entity.canonicalRef,
      label: entity.label,
      aliases: [...entity.aliases],
      privacyScope: entity.privacyScope,
      extraction: entity.extraction,
      contentHash: stableHash(entity),
      versionRefs: [...versionRefs],
      writtenAt: previous?.writtenAt ?? now,
      updatedAt: now,
    };
  }

  for (const relation of result.relations) {
    const key = relationKey(relation);
    const previous = snapshot.relations[key];
    snapshot.relations[key] = {
      stableId: key,
      eventId: relation.eventId,
      entityId: relation.entityId,
      role: relation.role,
      confidence: relation.confidence,
      provenance: relation.provenance,
      source: relation.source,
      contentHash: stableHash(relation),
      versionRefs: [...versionRefs],
      writtenAt: previous?.writtenAt ?? now,
      updatedAt: now,
    };
  }
}

function validateSnapshot(snapshot: SarPersistenceSnapshot): SarValidationIssue[] {
  if (!isRecord(snapshot)) {
    return [{ code: 'invalid-object', path: 'snapshot', message: 'SAR persistence snapshot must be an object.' }];
  }
  return [
    ...validateAllowedKeys(snapshot, SNAPSHOT_KEYS, 'snapshot'),
    ...validateSnapshotShape(snapshot),
    ...recordValues(snapshot.events).flatMap(validatePersistedEventRecord),
    ...recordValues(snapshot.entities).flatMap(validatePersistedEntityRecord),
    ...recordValues(snapshot.relations).flatMap(validatePersistedRelationRecord),
    ...recordValues(snapshot.queryTraces).flatMap(validatePersistedQueryTraceRecord),
  ];
}

function validateSnapshotShape(snapshot: Record<string, unknown>): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  if (snapshot.schemaVersion !== 'sar-persistence.v1') {
    issues.push({ code: 'invalid-object', path: 'schemaVersion', message: 'SAR persistence snapshot schemaVersion is unsupported.' });
  }
  if (!isIsoDate(snapshot.generatedAt)) {
    issues.push({ code: 'missing-required-field', path: 'generatedAt', message: 'SAR persistence snapshot generatedAt must be an ISO timestamp.' });
  }
  for (const key of ['events', 'entities', 'relations', 'queryTraces']) {
    if (!isRecord(snapshot[key])) {
      issues.push({ code: 'invalid-object', path: key, message: `${key} must be a record map.` });
    }
  }
  return issues;
}

function validatePersistedEventRecord(record: unknown): SarValidationIssue[] {
  if (!isRecord(record)) {
    return [{ code: 'invalid-object', path: 'events', message: 'Persisted event must be an object.' }];
  }
  return [
    ...validateAllowedKeys(record, PERSISTED_EVENT_RECORD_KEYS, `events.${String(record.stableId ?? 'unknown')}`),
    ...validatePersistedRecordFields(record, `events.${String(record.stableId ?? 'unknown')}`, ['stableId', 'contentHash'], ['writtenAt', 'updatedAt']),
    ...validateVersionRefs(record.versionRefs, `events.${String(record.stableId ?? 'unknown')}.versionRefs`),
    ...validatePersistedEventDerivedFields(record),
    ...validatePersistedTextBoundary(record, `events.${String(record.stableId ?? 'unknown')}`),
    ...validateSarEvent({
      id: record.stableId,
      eventType: record.eventType,
      title: record.title,
      safeSummary: record.safeSummary,
      sourceRef: isRecord(record.sourceRef) ? {
        id: record.sourceRef.id,
        owner: record.sourceRef.owner,
        authorityLevel: record.sourceRef.authorityLevel,
        freshness: record.sourceRef.freshness,
        contentHash: record.sourceRef.contentHash,
      } : record.sourceRef,
      privacyScope: record.privacyScope,
    }).issues,
    ...validatePersistedSourceRef(record.sourceRef),
  ];
}

function validatePersistedEntityRecord(record: unknown): SarValidationIssue[] {
  if (!isRecord(record)) {
    return [{ code: 'invalid-object', path: 'entities', message: 'Persisted entity must be an object.' }];
  }
  return [
    ...validateAllowedKeys(record, PERSISTED_ENTITY_RECORD_KEYS, `entities.${String(record.stableId ?? 'unknown')}`),
    ...validatePersistedRecordFields(record, `entities.${String(record.stableId ?? 'unknown')}`, ['stableId', 'contentHash'], ['writtenAt', 'updatedAt']),
    ...validateVersionRefs(record.versionRefs, `entities.${String(record.stableId ?? 'unknown')}.versionRefs`),
    ...validatePersistedTextBoundary(record, `entities.${String(record.stableId ?? 'unknown')}`),
    ...validateSarEntity({
      id: record.stableId,
      entityType: record.entityType,
      canonicalRef: record.canonicalRef,
      label: record.label,
      aliases: record.aliases,
      privacyScope: record.privacyScope,
      extraction: record.extraction,
    }).issues,
  ];
}

function validatePersistedRelationRecord(record: unknown): SarValidationIssue[] {
  if (!isRecord(record)) {
    return [{ code: 'invalid-object', path: 'relations', message: 'Persisted relation must be an object.' }];
  }
  return [
    ...validateAllowedKeys(record, PERSISTED_RELATION_RECORD_KEYS, `relations.${String(record.stableId ?? 'unknown')}`),
    ...validatePersistedRecordFields(record, `relations.${String(record.stableId ?? 'unknown')}`, ['stableId', 'contentHash'], ['writtenAt', 'updatedAt']),
    ...validateVersionRefs(record.versionRefs, `relations.${String(record.stableId ?? 'unknown')}.versionRefs`),
    ...validatePersistedTextBoundary(record, `relations.${String(record.stableId ?? 'unknown')}`),
    ...validateSarRelation({
      eventId: record.eventId,
      entityId: record.entityId,
      role: record.role,
      confidence: record.confidence,
      provenance: record.provenance,
      source: record.source,
    }).issues,
  ];
}

function validateTracePersistenceInput(input: SarPersistQueryTraceInput): SarValidationIssue[] {
  return [
    ...validateRetention(input.retention),
    ...validateScopeRef(input.scope),
    ...validateTraceEnums(input.exportEligibility, input.handoffStatus),
    ...validateQueryTraceIdentity(input.queryRole, input.useCase, hashSarQueryIdentity(input.queryIdentity)),
    ...validateVersionRefs(input.result.trace.versionRefs),
    ...validateTraceTextBoundary(input.result.trace),
  ];
}

function validatePersistedQueryTraceRecord(record: unknown): SarValidationIssue[] {
  if (!isRecord(record)) {
    return [{ code: 'invalid-trace', path: 'queryTraces', message: 'Persisted query trace must be an object.' }];
  }
  const issues: SarValidationIssue[] = [];
  for (const key of Object.keys(record)) {
    if (!QUERY_TRACE_RECORD_KEYS.has(key)) {
      issues.push({
        code: 'invalid-trace',
        path: `queryTraces.${String(record.stableId ?? 'unknown')}.${key}`,
        message: 'Persisted query trace contains a field outside the hash-only trace contract.',
      });
    }
  }
  issues.push(...validatePersistedRecordFields(record, `queryTraces.${String(record.stableId ?? 'unknown')}`, ['stableId', 'queryHash', 'contentHash'], ['writtenAt', 'updatedAt'], ['minimized']));
  issues.push(...validateVersionRefs(record.versionRefs, `queryTraces.${String(record.stableId ?? 'unknown')}.versionRefs`));
  issues.push(...validateScopeRef(record.scope));
  issues.push(...validateRetention(record.retention));
  if (record.aggregateCounts !== undefined) {
    issues.push(...validateAggregateCounts(record.aggregateCounts));
  }
  issues.push(...validateTraceEnums(record.exportEligibility, record.handoffStatus));
  issues.push(...validateQueryTraceIdentity(record.queryRole, record.useCase, record.queryHash));
  issues.push(...validateSarTrace({
    id: record.stableId,
    seedEntityIds: record.seedEntityIds,
    expansionHops: record.expansionHops,
    selectedRefs: record.selectedRefs,
    rejectedRefs: record.rejectedRefs,
    limitations: record.limitations,
    versionRefs: record.versionRefs,
  }).issues);
  issues.push(...validatePersistedTextBoundary({
    queryRole: record.queryRole,
    useCase: record.useCase,
  }, `queryTraces.${String(record.stableId ?? 'unknown')}`));
  issues.push(...validateTraceTextBoundary(record));
  return issues;
}

function validatePersistedEventDerivedFields(record: Record<string, unknown>): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  if (isRecord(record.sourceRef)) {
    if (record.authorityLevel !== record.sourceRef.authorityLevel) {
      issues.push({
        code: 'invalid-reference',
        path: 'events.authorityLevel',
        message: 'Persisted event authorityLevel must match sourceRef.authorityLevel.',
      });
    }
    if (record.freshness !== record.sourceRef.freshness) {
      issues.push({
        code: 'invalid-reference',
        path: 'events.freshness',
        message: 'Persisted event freshness must match sourceRef.freshness.',
      });
    }
    if (record.sourceRef.contentHash !== undefined && record.contentHash !== record.sourceRef.contentHash) {
      issues.push({
        code: 'invalid-reference',
        path: 'events.contentHash',
        message: 'Persisted event contentHash must match sourceRef.contentHash when sourceRef provides one.',
      });
    }
  }
  return issues;
}

function validatePersistedRecordFields(
  record: Record<string, unknown>,
  path: string,
  stringFields: readonly string[],
  isoFields: readonly string[],
  booleanFields: readonly string[] = [],
): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  for (const field of stringFields) {
    if (typeof record[field] !== 'string' || record[field].trim() === '') {
      issues.push({ code: 'missing-required-field', path: `${path}.${field}`, message: `${field} must be a non-empty string.` });
    }
  }
  for (const field of isoFields) {
    if (!isIsoDate(record[field])) {
      issues.push({ code: 'missing-required-field', path: `${path}.${field}`, message: `${field} must be an ISO timestamp.` });
    }
  }
  for (const field of booleanFields) {
    if (typeof record[field] !== 'boolean') {
      issues.push({ code: 'missing-required-field', path: `${path}.${field}`, message: `${field} must be a boolean.` });
    }
  }
  return issues;
}

function validatePersistedSourceRef(sourceRef: SarPersistedSourceRef): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  if (!isRecord(sourceRef)) {
    return [{ code: 'invalid-reference', path: 'sourceRef', message: 'Persisted sourceRef must be an object.' }];
  }
  for (const key of Object.keys(sourceRef)) {
    if (!PERSISTED_SOURCE_REF_KEYS.has(key)) {
      issues.push({
        code: 'invalid-reference',
        path: `sourceRef.${key}`,
        message: 'Persisted sourceRef contains a field outside the hash-only source contract.',
      });
    }
  }
  if (sourceRef.ownerUserIdHash !== undefined && !isHashRef(sourceRef.ownerUserIdHash)) {
    issues.push({ code: 'invalid-reference', path: 'sourceRef.ownerUserIdHash', message: 'ownerUserIdHash must be hash-only.' });
  }
  if (sourceRef.classIdHash !== undefined && !isHashRef(sourceRef.classIdHash)) {
    issues.push({ code: 'invalid-reference', path: 'sourceRef.classIdHash', message: 'classIdHash must be hash-only.' });
  }
  return issues;
}

function validateAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      issues.push({
        code: 'restricted-raw-content',
        path: `${path}.${key}`,
        message: `${path}.${key} is outside the SAR persistence boundary.`,
      });
    }
  }
  return issues;
}

function validatePersistedTextBoundary(record: Record<string, unknown>, path: string): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  for (const [key, value] of Object.entries(record)) {
    collectRestrictedTraceText(value, `${path}.${key}`, issues);
  }
  return issues;
}

function validateScopeRef(scopeRef: unknown): SarValidationIssue[] {
  if (!isRecord(scopeRef) || typeof scopeRef.scope !== 'string') {
    return [{ code: 'invalid-trace', path: 'scope', message: 'Trace scope is required.' }];
  }
  const issues: SarValidationIssue[] = [
    ...validateAllowedKeys(scopeRef, QUERY_TRACE_SCOPE_REF_KEYS, 'scope'),
    ...validatePersistedTextBoundary(scopeRef, 'scope'),
  ];
  if (!QUERY_TRACE_SCOPES.has(scopeRef.scope as SarQueryTraceScope)) {
    issues.push({ code: 'invalid-trace', path: 'scope.scope', message: 'Trace scope must use a governed value.' });
  }
  if (scopeRef.studentIdHash !== undefined && !isHashRef(scopeRef.studentIdHash)) {
    issues.push({ code: 'invalid-trace', path: 'scope.studentIdHash', message: 'studentIdHash must be hash-only.' });
  }
  if (scopeRef.classIdHash !== undefined && !isHashRef(scopeRef.classIdHash)) {
    issues.push({ code: 'invalid-trace', path: 'scope.classIdHash', message: 'classIdHash must be hash-only.' });
  }
  if (scopeRef.teacherIdHash !== undefined && !isHashRef(scopeRef.teacherIdHash)) {
    issues.push({ code: 'invalid-trace', path: 'scope.teacherIdHash', message: 'teacherIdHash must be hash-only.' });
  }
  if (scopeRef.scope === 'student' && !isHashRef(scopeRef.studentIdHash)) {
    issues.push({ code: 'invalid-trace', path: 'scope.studentIdHash', message: 'Student-scoped traces require hash-only student identity.' });
  }
  if (scopeRef.scope === 'class' && !isHashRef(scopeRef.classIdHash)) {
    issues.push({ code: 'invalid-trace', path: 'scope.classIdHash', message: 'Class-scoped traces require hash-only class identity.' });
  }
  return issues;
}

function validateQueryTraceIdentity(queryRole: unknown, useCase: unknown, queryHash: unknown): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  if (typeof queryRole !== 'string' || queryRole.trim() === '') {
    issues.push({ code: 'invalid-trace', path: 'queryRole', message: 'Query trace role is required.' });
  }
  if (typeof useCase !== 'string' || useCase.trim() === '') {
    issues.push({ code: 'invalid-trace', path: 'useCase', message: 'Query trace use case is required.' });
  }
  if (typeof queryHash !== 'string' || !queryHash.startsWith('sar:query:sha256:')) {
    issues.push({ code: 'invalid-trace', path: 'queryHash', message: 'Query trace must store hash-only query identity.' });
  }
  return issues;
}

function validateTraceEnums(exportEligibility: unknown, handoffStatus: unknown): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  if (!EXPORT_ELIGIBILITY.has(exportEligibility as SarQueryTraceExportEligibility)) {
    issues.push({ code: 'invalid-trace', path: 'exportEligibility', message: 'Query trace export eligibility must use a governed value.' });
  }
  if (!HANDOFF_STATUS.has(handoffStatus as SarQueryTraceHandoffStatus)) {
    issues.push({ code: 'invalid-trace', path: 'handoffStatus', message: 'Query trace handoff status must use a governed value.' });
  }
  return issues;
}

function validateRetention(retention: unknown): SarValidationIssue[] {
  if (!isRecord(retention)) {
    return [{ code: 'invalid-trace', path: 'retention', message: 'Trace retention is required.' }];
  }
  const issues: SarValidationIssue[] = [
    ...validateAllowedKeys(retention, QUERY_TRACE_RETENTION_KEYS, 'retention'),
    ...validatePersistedTextBoundary(retention, 'retention'),
  ];
  if (!isIsoDate(retention.storedAt)) {
    issues.push({ code: 'missing-required-field', path: 'retention.storedAt', message: 'Trace retention requires storedAt.' });
  }
  if (!isIsoDate(retention.retainUntil)) {
    issues.push({ code: 'missing-required-field', path: 'retention.retainUntil', message: 'Trace retention requires retainUntil.' });
  }
  if (retention.minimizeAfter !== undefined && !isIsoDate(retention.minimizeAfter)) {
    issues.push({ code: 'missing-required-field', path: 'retention.minimizeAfter', message: 'Trace retention minimizeAfter must be an ISO timestamp.' });
  }
  if (!MINIMIZATION_POLICIES.has(retention.minimizationPolicy as SarQueryTraceMinimizationPolicy)) {
    issues.push({ code: 'invalid-trace', path: 'retention.minimizationPolicy', message: 'Trace retention minimization policy must use a governed value.' });
  }
  if (isIsoDate(retention.storedAt) && isIsoDate(retention.retainUntil)) {
    const storedAt = new Date(retention.storedAt).getTime();
    const retainUntil = new Date(retention.retainUntil).getTime();
    if (retainUntil < storedAt) {
      issues.push({ code: 'invalid-trace', path: 'retention.retainUntil', message: 'Trace retention boundary must not precede storedAt.' });
    }
  }
  if (
    isIsoDate(retention.storedAt)
    && isIsoDate(retention.retainUntil)
    && retention.minimizeAfter !== undefined
    && isIsoDate(retention.minimizeAfter)
  ) {
    const storedAt = new Date(retention.storedAt).getTime();
    const retainUntil = new Date(retention.retainUntil).getTime();
    const minimizeAfter = new Date(retention.minimizeAfter).getTime();
    if (minimizeAfter < storedAt || minimizeAfter > retainUntil) {
      issues.push({ code: 'invalid-trace', path: 'retention.minimizeAfter', message: 'Trace minimization boundary must stay within the retention window.' });
    }
  }
  return issues;
}

function validateAggregateCounts(aggregateCounts: unknown): SarValidationIssue[] {
  if (!isRecord(aggregateCounts)) {
    return [{ code: 'invalid-trace', path: 'aggregateCounts', message: 'Trace aggregateCounts must be an object when provided.' }];
  }
  const issues: SarValidationIssue[] = [
    ...validateAllowedKeys(aggregateCounts, QUERY_TRACE_AGGREGATE_COUNTS_KEYS, 'aggregateCounts'),
    ...validatePersistedTextBoundary(aggregateCounts, 'aggregateCounts'),
  ];
  for (const [key, value] of Object.entries(aggregateCounts)) {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      issues.push({ code: 'invalid-trace', path: `aggregateCounts.${key}`, message: 'Trace aggregateCounts values must be non-negative numbers.' });
    }
  }
  return issues;
}

function validateTraceTextBoundary(traceLike: Pick<
  SarPersistedQueryTraceRecord,
  'seedEntityIds' | 'expansionHops' | 'selectedRefs' | 'rejectedRefs' | 'limitations' | 'versionRefs'
> | SarRetrievalTrace): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  collectRestrictedTraceText(traceLike.seedEntityIds, 'seedEntityIds', issues);
  collectRestrictedTraceText(traceLike.expansionHops, 'expansionHops', issues);
  collectRestrictedTraceText(traceLike.selectedRefs, 'selectedRefs', issues);
  collectRestrictedTraceText(traceLike.limitations, 'limitations', issues);
  collectRestrictedTraceText(traceLike.versionRefs, 'versionRefs', issues);
  if (Array.isArray(traceLike.rejectedRefs)) {
    traceLike.rejectedRefs.forEach((ref, index) => {
      if (isRecord(ref)) {
        collectRestrictedTraceText(ref.ref, `rejectedRefs.${index}.ref`, issues);
        collectRestrictedTraceText(ref.reason, `rejectedRefs.${index}.reason`, issues);
      }
    });
  }
  return issues;
}

function validateVersionRefs(versionRefs: unknown, path = 'versionRefs'): SarValidationIssue[] {
  const issues: SarValidationIssue[] = [];
  if (!Array.isArray(versionRefs) || versionRefs.some((ref) => typeof ref !== 'string')) {
    issues.push({ code: 'invalid-trace', path, message: 'versionRefs must be a string array.' });
    return issues;
  }
  collectRestrictedTraceText(versionRefs, path, issues);
  return issues;
}

function minimizeTraceIfExpired(
  trace: SarPersistedQueryTraceRecord,
  now: string,
): SarPersistedQueryTraceRecord {
  const boundary = trace.retention.minimizeAfter ?? trace.retention.retainUntil;
  if (new Date(now).getTime() < new Date(boundary).getTime()) return trace;
  if (trace.minimized) return trace;
  const base = {
    ...trace,
    seedEntityIds: [],
    expansionHops: [],
    selectedRefs: [],
    rejectedRefs: [],
    minimized: true,
    exportEligibility: 'excluded',
    updatedAt: now,
  } satisfies SarPersistedQueryTraceRecord;
  if (trace.retention.minimizationPolicy === 'aggregate-after-retention') {
    return {
      ...base,
      aggregateCounts: {
        seedEntityIds: trace.seedEntityIds.length,
        expansionHops: trace.expansionHops.length,
        selectedRefs: trace.selectedRefs.length,
        rejectedRefs: trace.rejectedRefs.length,
      },
    };
  }
  if (trace.retention.minimizationPolicy === 'redact-details-after-retention') {
    return {
      ...base,
      limitations: [
        ...trace.limitations,
        'Trace details redacted after SAR retention boundary.',
      ],
      aggregateCounts: undefined,
    };
  }
  return {
    ...base,
    limitations: [],
    aggregateCounts: undefined,
  };
}

function isExportEligibleQueryTrace(trace: SarPersistedQueryTraceRecord): boolean {
  return !trace.minimized && (
    trace.exportEligibility === 'admin-export'
    || trace.exportEligibility === 'teacher-export'
  );
}

function filterTraceRefsForExport(
  trace: SarPersistedQueryTraceRecord,
  eventIds: ReadonlySet<string>,
  entityIds: ReadonlySet<string>,
): SarPersistedQueryTraceRecord {
  return {
    ...trace,
    seedEntityIds: trace.seedEntityIds.filter((id) => entityIds.has(id)),
    expansionHops: trace.expansionHops.filter((hop) => (
      entityIds.has(hop.fromEntityId)
      && entityIds.has(hop.toEntityId)
      && (hop.viaEventId === undefined || eventIds.has(hop.viaEventId))
    )),
    selectedRefs: trace.selectedRefs.filter((ref) => isExportableTraceRef(ref, eventIds, entityIds)),
    rejectedRefs: trace.rejectedRefs.filter((ref) => isExportableTraceRef(ref.ref, eventIds, entityIds)),
  };
}

function isExportableTraceRef(
  ref: string,
  eventIds: ReadonlySet<string>,
  entityIds: ReadonlySet<string>,
): boolean {
  if (ref.startsWith('sar:event:')) return eventIds.has(ref);
  if (ref.startsWith('sar:entity:')) return entityIds.has(ref);
  return true;
}

function sanitizeSourceRef(sourceRef: SarRetrievalEvent['sourceRef']): SarPersistedSourceRef {
  return {
    id: sourceRef.id,
    owner: sourceRef.owner,
    authorityLevel: sourceRef.authorityLevel,
    freshness: sourceRef.freshness,
    contentHash: sourceRef.contentHash,
    ownerUserIdHash: sourceRef.ownerUserId ? hashScopedRef('owner-user', sourceRef.ownerUserId) : undefined,
    classIdHash: sourceRef.classId ? hashScopedRef('class', sourceRef.classId) : undefined,
  };
}

function hashScopedRef(scope: string, value: string): string {
  return `sar:${scope}:sha256:${stableHash(value)}`;
}

function collectRestrictedTraceText(
  value: unknown,
  path: string,
  issues: SarValidationIssue[],
): void {
  if (typeof value === 'string') {
    if (RESTRICTED_TRACE_TEXT.some((pattern) => pattern.test(value))) {
      issues.push({ code: 'restricted-raw-content', path, message: `${path} contains restricted raw content.` });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRestrictedTraceText(item, `${path}.${index}`, issues));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, child]) => collectRestrictedTraceText(child, `${path}.${key}`, issues));
  }
}

function isExportableScope(scope: SarRetrievalEvent['privacyScope']): boolean {
  return scope !== 'audit-only' && scope !== 'system-internal';
}

function relationKey(relation: SarRetrievalEventEntity): string {
  return [
    relation.eventId,
    relation.entityId,
    relation.role,
    relation.provenance,
  ].map(encodeURIComponent).join('|');
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function isIsoDate(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(new Date(value).getTime());
}

function isHashRef(value: unknown): value is string {
  return typeof value === 'string' && /^sar:[a-z-]+:sha256:[A-Za-z0-9_-]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function recordValues(value: unknown): unknown[] {
  return isRecord(value) ? Object.values(value) : [];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

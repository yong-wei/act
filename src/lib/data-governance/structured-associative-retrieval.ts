import type {
  SarRetrievalEntity,
  SarRetrievalEvent,
  SarRetrievalEventEntity,
  SarRetrievalResult,
  SarRetrievalTrace,
} from './structured-associative-retrieval-types';

export type {
  SarAuthorityLevel,
  SarEntityType,
  SarEventType,
  SarPrivacyScope,
  SarRelationProvenance,
  SarRelationRole,
  SarRetrievalEntity,
  SarRetrievalEvent,
  SarRetrievalEventEntity,
  SarRetrievalResult,
  SarRetrievalTrace,
  SarSourceRef,
  SarTraceHop,
} from './structured-associative-retrieval-types';

export type SarValidationIssueCode =
  | 'invalid-object'
  | 'missing-event-source-ref'
  | 'missing-entity-canonical-ref'
  | 'missing-required-field'
  | 'invalid-privacy-scope'
  | 'invalid-confidence'
  | 'llm-candidate-high-confidence'
  | 'restricted-raw-content'
  | 'citation-boundary-violation'
  | 'invalid-trace'
  | 'invalid-reference';

export interface SarValidationIssue {
  code: SarValidationIssueCode;
  path: string;
  message: string;
}

export interface SarValidationResult {
  valid: boolean;
  issues: SarValidationIssue[];
}

const PRIVACY_SCOPES = new Set([
  'student-visible',
  'teacher-scoped',
  'admin-scoped',
  'audit-only',
  'system-internal',
]);

const EVENT_TYPES = new Set([
  'graph-node',
  'resource-node',
  'corpus-chunk-summary',
  'learning-fact-summary',
  'grading-artifact',
  'simulation-summary',
  'arena-summary',
  'path-summary',
  'diagnosis-summary',
  'teacher-report',
  'konling-memory-summary',
  'prep-pack-item',
]);

const ENTITY_TYPES = new Set([
  'learning-goal',
  'kaq-objective',
  'graph-node',
  'portrait-dimension',
  'resource-node',
  'planning-unit',
  'path-node',
  'learning-fact',
  'rubric-criterion',
  'citation-target',
  'student',
  'class',
]);

const AUTHORITY_LEVELS = new Set([
  'platform-verified',
  'teacher-approved',
  'metadata-projected',
  'llm-extracted',
]);

const RELATION_ROLES = new Set([
  'about',
  'supports',
  'requires',
  'evidence-for',
  'generated-from',
  'candidate-for',
  'rejects',
]);

const RELATION_PROVENANCE = new Set([
  'deterministic-id',
  'metadata-projection',
  'teacher-approval',
  'llm-extraction',
]);

const RESTRICTED_KEYS = new Set([
  'rawContent',
  'raw_content',
  'rawEvidence',
  'rawLearnerSubmission',
  'rawLearnerSubmissions',
  'rawSubmission',
  'rawSubmissions',
  'raw_submission',
  'raw_submissions',
  'rawAnswer',
  'rawAnswers',
  'rawAnswerBody',
  'rawAnswerBodies',
  'rawTrace',
  'rawTraceJson',
  'rawTraces',
  'rawTracePayload',
  'learnerSubmission',
  'learnerSubmissions',
  'hiddenArenaInternals',
  'hiddenArenaEvaluationInternals',
  'hiddenEvaluationInternals',
  'privateKonlingMemory',
  'auditOnlyTrace',
]);

const RESTRICTED_KEY_PREFIXES = new Set([
  'rawLearnerSubmission',
  'rawLearnerSubmissions',
  'rawSubmission',
  'rawSubmissions',
  'rawAnswer',
  'rawAnswers',
  'rawEvidence',
  'hiddenArenaInternals',
  'hiddenArenaEvaluationInternals',
  'hiddenEvaluationInternals',
  'privateKonlingMemory',
  'auditOnlyTrace',
]);

const RESTRICTED_TEXT = [
  /\braw[_ -]?answer[_ -]?bod(?:y|ies)\b/i,
  /\braw[_ -]?answers?\b/i,
  /\braw[_ -]?evidence\b/i,
  /\braw[_ -]?learner[_ -]?submissions?\b/i,
  /\braw[_ -]?submissions?\b/i,
  /\braw[_ -]?trace(?:s|[_ -]?payload)?\b/i,
  /\bhidden[_ -]?arena[_ -]?evaluation[_ -]?internals?\b/i,
  /\bhidden[_ -]?arena[_ -]?internals?\b/i,
  /\bhidden[_ -]?evaluation[_ -]?internals?\b/i,
  /\barena[_ -]?internal\b/i,
  /\bprivate[_ -]?konling[_ -]?memory\b/i,
  /\bkonling[_ -]?private\b/i,
  /\baudit[_ -]?only[_ -]?trace\b/i,
  /\baudit[_ -]?trace\b/i,
];

// SAR only exposes associative refs and limitations. Final citation verification,
// address resolution, and CitationChip payload construction stay in the governed
// LearningEvidence or Source Pack citation layer.
const CITATION_PAYLOAD_KEYS = new Set([
  'citationAddress',
  'citationAddresses',
  'citationChip',
  'CitationChip',
  'citation_chip',
  'citationPayload',
  'citationRef',
  'citationRefs',
  'verifiedCitation',
  'verifiedCitations',
  'verifiedCitationRef',
  'verifiedCitationRefs',
]);

const CITATION_PAYLOAD_KEY_PREFIXES = new Set([
  'citationAddress',
  'citationAddresses',
  'citationChip',
  'citationPayload',
  'citationRef',
  'citationRefs',
  'verifiedCitation',
  'verifiedCitations',
  'verifiedCitationRef',
  'verifiedCitationRefs',
]);

export function validateSarEvent(event: unknown): SarValidationResult {
  const issues: SarValidationIssue[] = [];
  if (!isRecord(event)) return result(issue('invalid-object', 'event', 'Event must be an object.'));

  requireString(event, 'id', issues);
  requireEnum(event.eventType, EVENT_TYPES, 'eventType', issues);
  requireString(event, 'title', issues);
  requireString(event, 'safeSummary', issues);
  requirePrivacyScope(event.privacyScope, 'privacyScope', issues);

  if (!isRecord(event.sourceRef)) {
    issues.push(issue('missing-event-source-ref', 'sourceRef', 'Event sourceRef is required.'));
  } else {
    requireString(event.sourceRef, 'id', issues, 'sourceRef.id', 'missing-event-source-ref');
    requireString(event.sourceRef, 'owner', issues, 'sourceRef.owner');
    requireEnum(event.sourceRef.authorityLevel, AUTHORITY_LEVELS, 'sourceRef.authorityLevel', issues);
    requireString(event.sourceRef, 'freshness', issues, 'sourceRef.freshness');
    if (
      event.sourceRef.contentHash !== undefined
      && (typeof event.sourceRef.contentHash !== 'string' || event.sourceRef.contentHash.trim() === '')
    ) {
      issues.push(issue('missing-required-field', 'sourceRef.contentHash', 'contentHash must be non-empty when provided.'));
    }
  }

  scanRestricted(event.safeSummary, 'safeSummary', issues);
  scanRestricted(event.title, 'title', issues);
  if (event.metadata !== undefined) scanMetadata(event.metadata, 'metadata', issues);

  return result(...issues);
}

export function validateSarEntity(entity: unknown): SarValidationResult {
  const issues: SarValidationIssue[] = [];
  if (!isRecord(entity)) return result(issue('invalid-object', 'entity', 'Entity must be an object.'));

  requireString(entity, 'id', issues);
  requireEnum(entity.entityType, ENTITY_TYPES, 'entityType', issues);
  requireString(entity, 'label', issues);
  requirePrivacyScope(entity.privacyScope, 'privacyScope', issues);
  if (!Array.isArray(entity.aliases) || entity.aliases.some((item) => typeof item !== 'string')) {
    issues.push(issue('missing-required-field', 'aliases', 'aliases must be a string array.'));
  }
  if (typeof entity.canonicalRef !== 'string' || entity.canonicalRef.trim() === '') {
    issues.push(issue('missing-entity-canonical-ref', 'canonicalRef', 'Entity canonicalRef is required.'));
  }
  if (entity.extraction !== 'platform-stable-id' && entity.extraction !== 'llm-candidate') {
    issues.push(issue('missing-required-field', 'extraction', 'extraction must identify platform-stable-id or llm-candidate.'));
  }

  return result(...issues);
}

export function validateSarRelation(
  relation: unknown,
  entities: readonly Pick<SarRetrievalEntity, 'id' | 'extraction'>[] = [],
): SarValidationResult {
  const issues: SarValidationIssue[] = [];
  if (!isRecord(relation)) return result(issue('invalid-object', 'relation', 'Relation must be an object.'));

  requireString(relation, 'eventId', issues);
  requireString(relation, 'entityId', issues);
  requireEnum(relation.role, RELATION_ROLES, 'role', issues);
  requireEnum(relation.provenance, RELATION_PROVENANCE, 'provenance', issues);
  requireString(relation, 'source', issues);
  validateConfidence(relation.confidence, 'confidence', issues);

  const targetEntity = entities.find((entity) => entity.id === relation.entityId);
  if (
    (targetEntity?.extraction === 'llm-candidate' || relation.provenance === 'llm-extraction')
    && typeof relation.confidence === 'number'
    && relation.confidence > 0.6
  ) {
    issues.push(issue(
      'llm-candidate-high-confidence',
      'confidence',
      'LLM candidate relations must remain low-confidence until canonicalized.',
    ));
  }

  return result(...issues);
}

export function validateSarTrace(trace: unknown): SarValidationResult {
  const issues: SarValidationIssue[] = [];
  if (!isRecord(trace)) return result(issue('invalid-object', 'trace', 'Trace must be an object.'));

  requireString(trace, 'id', issues);
  requireStringArray(trace.seedEntityIds, 'seedEntityIds', issues, 'invalid-trace');
  requireStringArray(trace.selectedRefs, 'selectedRefs', issues, 'invalid-trace');
  requireStringArray(trace.limitations, 'limitations', issues, 'invalid-trace');
  requireStringArray(trace.versionRefs, 'versionRefs', issues, 'invalid-trace');
  if (!Array.isArray(trace.expansionHops)) {
    issues.push(issue('invalid-trace', 'expansionHops', 'expansionHops must be an array.'));
  } else {
    trace.expansionHops.forEach((hop, index) => {
      if (!isRecord(hop)) {
        issues.push(issue('invalid-trace', `expansionHops.${index}`, 'Trace hop must be an object.'));
        return;
      }
      requireString(hop, 'fromEntityId', issues, `expansionHops.${index}.fromEntityId`, 'invalid-trace');
      requireString(hop, 'toEntityId', issues, `expansionHops.${index}.toEntityId`, 'invalid-trace');
      if (hop.viaEventId !== undefined) {
        requireString(hop, 'viaEventId', issues, `expansionHops.${index}.viaEventId`, 'invalid-trace');
      }
      requireEnum(hop.relationRole, RELATION_ROLES, `expansionHops.${index}.relationRole`, issues, 'invalid-trace');
      validateConfidence(hop.confidence, `expansionHops.${index}.confidence`, issues);
    });
  }
  if (!Array.isArray(trace.rejectedRefs)) {
    issues.push(issue('invalid-trace', 'rejectedRefs', 'rejectedRefs must be an array.'));
  } else {
    trace.rejectedRefs.forEach((ref, index) => {
      if (!isRecord(ref)) {
        issues.push(issue('invalid-trace', `rejectedRefs.${index}`, 'Rejected ref must be an object.'));
        return;
      }
      requireString(ref, 'ref', issues, `rejectedRefs.${index}.ref`, 'invalid-trace');
      requireString(ref, 'reason', issues, `rejectedRefs.${index}.reason`, 'invalid-trace');
    });
  }

  return result(...issues);
}

export function validateSarResult(resultValue: unknown): SarValidationResult {
  const issues: SarValidationIssue[] = [];
  if (!isRecord(resultValue)) return result(issue('invalid-object', 'result', 'Result must be an object.'));

  requireString(resultValue, 'id', issues);
  const resultRecord = resultValue as Partial<SarRetrievalResult>;
  issues.push(...validateSarTrace(resultRecord.trace).issues.map(prefixIssue('trace')));
  issues.push(...validateArray(resultRecord.events, 'events', validateSarEvent));
  issues.push(...validateArray(resultRecord.entities, 'entities', validateSarEntity));

  const entities = safeEntities(resultRecord.entities);
  issues.push(...validateArray(resultRecord.relations, 'relations', (relation) => validateSarRelation(relation, entities)));
  issues.push(...validateRelationReferences(resultRecord));
  issues.push(...validateTraceReferences(resultRecord));
  requireStringArray(resultRecord.citationTargetRefs, 'citationTargetRefs', issues);
  requireStringArray(resultRecord.retrievalChunkRefs, 'retrievalChunkRefs', issues);
  requireStringArray(resultRecord.limitations, 'limitations', issues);
  enforceUnverifiedRefs(resultRecord.citationTargetRefs, 'citationTargetRefs', issues);
  enforceUnverifiedRefs(resultRecord.retrievalChunkRefs, 'retrievalChunkRefs', issues);

  return result(...issues);
}

function validateRelationReferences(resultRecord: Partial<SarRetrievalResult>): SarValidationIssue[] {
  if (
    !Array.isArray(resultRecord.events)
    || !Array.isArray(resultRecord.entities)
    || !Array.isArray(resultRecord.relations)
  ) {
    return [];
  }

  const eventIds = idSet(resultRecord.events);
  const entityIds = idSet(resultRecord.entities);
  return safeRecordsWithIndex(resultRecord.relations).flatMap(({ item: relation, index }) => {
    const issues: SarValidationIssue[] = [];
    if (typeof relation.eventId === 'string' && !eventIds.has(relation.eventId)) {
      issues.push(issue('invalid-reference', `relations.${index}.eventId`, 'Relation eventId must reference a result event.'));
    }
    if (typeof relation.entityId === 'string' && !entityIds.has(relation.entityId)) {
      issues.push(issue('invalid-reference', `relations.${index}.entityId`, 'Relation entityId must reference a result entity.'));
    }
    return issues;
  });
}

function validateTraceReferences(resultRecord: Partial<SarRetrievalResult>): SarValidationIssue[] {
  if (
    !isRecord(resultRecord.trace)
    || !Array.isArray(resultRecord.events)
    || !Array.isArray(resultRecord.entities)
  ) {
    return [];
  }

  const trace = resultRecord.trace;
  const eventIds = idSet(resultRecord.events);
  const entityIds = idSet(resultRecord.entities);
  const candidateRefs = new Set([
    ...stringsOf(resultRecord.citationTargetRefs),
    ...stringsOf(resultRecord.retrievalChunkRefs),
  ]);
  const issues: SarValidationIssue[] = [];

  if (Array.isArray(trace.seedEntityIds)) {
    trace.seedEntityIds.forEach((entityId, index) => {
      if (typeof entityId === 'string' && !entityIds.has(entityId)) {
        issues.push(issue('invalid-reference', `trace.seedEntityIds.${index}`, 'Trace seed entity must reference a result entity.'));
      }
    });
  }

  if (Array.isArray(trace.selectedRefs)) {
    trace.selectedRefs.forEach((ref, index) => {
      if (typeof ref === 'string' && !eventIds.has(ref) && !entityIds.has(ref) && !candidateRefs.has(ref)) {
        issues.push(issue('invalid-reference', `trace.selectedRefs.${index}`, 'Selected ref must reference a result event, entity, citation target, or retrieval chunk.'));
      }
    });
  }

  if (Array.isArray(trace.expansionHops)) {
    safeRecordsWithIndex(trace.expansionHops).forEach(({ item: hop, index }) => {
      if (typeof hop.fromEntityId === 'string' && !entityIds.has(hop.fromEntityId)) {
        issues.push(issue('invalid-reference', `trace.expansionHops.${index}.fromEntityId`, 'Trace hop source must reference a result entity.'));
      }
      if (typeof hop.toEntityId === 'string' && !entityIds.has(hop.toEntityId)) {
        issues.push(issue('invalid-reference', `trace.expansionHops.${index}.toEntityId`, 'Trace hop target must reference a result entity.'));
      }
      if (typeof hop.viaEventId === 'string' && !eventIds.has(hop.viaEventId)) {
        issues.push(issue('invalid-reference', `trace.expansionHops.${index}.viaEventId`, 'Trace hop event must reference a result event.'));
      }
    });
  }

  return issues;
}

function idSet(value: unknown): Set<string> {
  return new Set(safeRecords(value).map((item) => item.id).filter((id): id is string => typeof id === 'string'));
}

function safeEntities(value: unknown): Array<Pick<SarRetrievalEntity, 'id' | 'extraction'>> {
  return safeRecords(value).flatMap((item) => (
    typeof item.id === 'string'
      && (item.extraction === 'platform-stable-id' || item.extraction === 'llm-candidate')
      ? [{ id: item.id, extraction: item.extraction }]
      : []
  ));
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function safeRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function safeRecordsWithIndex(value: unknown): Array<{ item: Record<string, unknown>; index: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => (isRecord(item) ? [{ item, index }] : []));
}

function enforceUnverifiedRefs(value: unknown, path: string, issues: SarValidationIssue[]): void {
  if (!Array.isArray(value)) return;
  if (value.some((ref) => typeof ref === 'string' && ref.startsWith('verified:'))) {
    issues.push(issue('citation-boundary-violation', path, 'SAR must not present candidates as verified citations.'));
  }
}

function validateArray<T>(
  value: unknown,
  path: string,
  validator: (item: T) => SarValidationResult,
): SarValidationIssue[] {
  if (!Array.isArray(value)) return [issue('missing-required-field', path, `${path} must be an array.`)];
  return value.flatMap((item, index) => validator(item).issues.map(prefixIssue(`${path}.${index}`)));
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  issues: SarValidationIssue[],
  path = key,
  code: SarValidationIssueCode = 'missing-required-field',
): void {
  if (typeof record[key] !== 'string' || record[key].trim() === '') {
    issues.push(issue(code, path, `${path} is required.`));
  }
}

function requireEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  issues: SarValidationIssue[],
  code: SarValidationIssueCode = 'missing-required-field',
): void {
  if (typeof value !== 'string' || !allowed.has(value)) {
    issues.push(issue(code, path, `${path} is not a supported SAR contract value.`));
  }
}

function requireStringArray(
  value: unknown,
  path: string,
  issues: SarValidationIssue[],
  code: SarValidationIssueCode = 'missing-required-field',
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    issues.push(issue(code, path, `${path} must be a string array.`));
    return;
  }
  for (let i = 0; i < value.length; i++) {
    if ((value[i] as string).trim() === '') {
      issues.push(issue(code, `${path}.${i}`, `${path}[${i}] must not be blank.`));
    }
  }
}

function requirePrivacyScope(value: unknown, path: string, issues: SarValidationIssue[]): void {
  if (typeof value !== 'string' || !PRIVACY_SCOPES.has(value)) {
    issues.push(issue('invalid-privacy-scope', path, `${path} must use a governed ACT privacy scope.`));
  }
}

function validateConfidence(value: unknown, path: string, issues: SarValidationIssue[]): void {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    issues.push(issue('invalid-confidence', path, `${path} must be a number from 0 to 1.`));
  }
}

function scanMetadata(value: unknown, path: string, issues: SarValidationIssue[]): void {
  if (typeof value === 'string') {
    scanRestricted(value, path, issues);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanMetadata(child, `${path}.${index}`, issues));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const normalizedKey = normalizeMetadataKey(key);
    const restrictedKey = hasNormalizedKey(RESTRICTED_KEYS, normalizedKey, RESTRICTED_KEY_PREFIXES);
    const citationKey = hasNormalizedKey(CITATION_PAYLOAD_KEYS, normalizedKey, CITATION_PAYLOAD_KEY_PREFIXES);
    if (restrictedKey || citationKey) {
      issues.push(issue(
        citationKey ? 'citation-boundary-violation' : 'restricted-raw-content',
        childPath,
        `${childPath} is outside the SAR boundary.`,
      ));
    }
    scanMetadata(child, childPath, issues);
  }
}

function scanRestricted(value: unknown, path: string, issues: SarValidationIssue[]): void {
  if (typeof value !== 'string') return;
  if (RESTRICTED_TEXT.some((pattern) => pattern.test(value))) {
    issues.push(issue('restricted-raw-content', path, `${path} contains restricted raw content.`));
  }
}

function hasNormalizedKey(
  keys: ReadonlySet<string>,
  normalizedKey: string,
  prefixes: ReadonlySet<string> = new Set(),
): boolean {
  for (const key of keys) {
    if (normalizeMetadataKey(key) === normalizedKey) return true;
  }
  for (const prefix of prefixes) {
    if (normalizedKey.startsWith(normalizeMetadataKey(prefix))) return true;
  }
  return false;
}

function normalizeMetadataKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function prefixIssue(prefix: string): (item: SarValidationIssue) => SarValidationIssue {
  return (item) => ({ ...item, path: `${prefix}.${item.path}` });
}

function issue(code: SarValidationIssueCode, path: string, message: string): SarValidationIssue {
  return { code, path, message };
}

function result(...issues: SarValidationIssue[]): SarValidationResult {
  return { valid: issues.length === 0, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

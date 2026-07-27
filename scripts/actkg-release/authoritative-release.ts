import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import type { Prisma, PrismaClient } from '@prisma/client';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';

const OUTER_KEYS = [
  'authority',
  'canonical_nodes',
  'contract_hash',
  'evidence_segment_stubs',
  'gates',
  'gold_relations',
  'protocol',
  'release_hash',
  'release_status',
  'release_version',
  'scope',
  'silver_relations',
  'source_mappings',
  'source_object_stubs',
] as const;
const ARRAY_KEYS = [
  'canonical_nodes',
  'source_mappings',
  'gold_relations',
  'silver_relations',
  'source_object_stubs',
  'evidence_segment_stubs',
] as const;
const EXPECTED_PROTOCOL = 'ctkg-m1c-v14p-root-locus-engineering-release-v1';
const EXPECTED_CONTRACT_HASH = '2f12ae211f853737722d89fa407646a40f5e622f58332681f51c9901a5bdbf50';
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;

type JsonObject = Record<string, unknown>;
type ReleaseArrayKey = (typeof ARRAY_KEYS)[number];

export interface ReleaseLockEntry {
  release_id: string;
  release_version: string;
  controlled_path: string;
  contract_hash: string;
  release_hash: string;
  release_json_raw_sha256: string;
  schema_raw_sha256: string;
  release_notes_raw_sha256: string;
}

export interface ReleaseSetLock {
  lock_version: 'actkg-release-set-lock/v1';
  release_set_id: string;
  releases: ReleaseLockEntry[];
}

export interface LineageClaims {
  sourceRun?: string;
  sourceImplementationCommit?: string;
  ctkgDatasetHash?: string;
  ctkgDatasetPublicationIdentity?: string;
  ctkgDatasetResolvableLocation?: string;
  revisionRegistryVersion?: string;
  revisionRegistryHash?: string;
}

export interface ValidatedRelease {
  lock: ReleaseSetLock;
  entry: ReleaseLockEntry;
  release: JsonObject;
  schema: JsonObject;
  normalizedWithoutHash: JsonObject;
  captureRevision: string;
  lockRawHash: string;
  sourceRun: string;
  sourceImplementationCommit: string;
}

export interface ImportCounts {
  canonicalObjects: number;
  sourceMappings: number;
  goldRelations: number;
  silverRelations: number;
  sourceObjects: number;
  evidenceSegments: number;
}

function fail(message: string): never {
  throw new Error(`ActKG Release rejected: ${message}`);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function records(release: JsonObject, key: ReleaseArrayKey): JsonObject[] {
  const value = release[key];
  if (!Array.isArray(value)) fail(`${key} must be an array`);
  return value.map((item, index) => object(item, `${key}[${index}]`));
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('canonical JSON cannot contain a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  fail('canonical JSON contains an unsupported value');
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertRawHash(bytes: Buffer, expected: string, label: string): void {
  if (!SHA256.test(expected) || sha256(bytes) !== expected) fail(`${label} raw-byte hash drift`);
}

function assertUniquePayloads(rows: JsonObject[], collection: string): void {
  const byId = new Map<string, string>();
  for (const [index, row] of rows.entries()) {
    const id = string(row.id, `${collection}[${index}].id`);
    const payload = canonicalJson(row);
    const prior = byId.get(id);
    if (prior !== undefined) {
      fail(prior === payload
        ? `${collection} repeats identity ${id}`
        : `${collection} has inconsistent duplicate identity ${id}`);
    }
    byId.set(id, payload);
  }
}

function extractSchemaVocabulary(schema: JsonObject): { objectTypes: Set<string>; relationTypes: Set<string> } {
  const defs = object(schema.$defs, 'ctkg.schema.json.$defs');
  const objectTypes = new Set(['DomainConcept', 'Formula', 'KnowledgeStatement', 'SystemModel']);
  for (const type of objectTypes) {
    if (!defs[type]) fail(`pinned Schema does not define canonical type ${type}`);
  }
  const relationDefinition = object(defs.SectionGraphRelationType, 'Schema SectionGraphRelationType');
  if (!Array.isArray(relationDefinition.enum)) fail('Schema relation vocabulary is unavailable');
  return {
    objectTypes,
    relationTypes: new Set(relationDefinition.enum.map((value, index) => (
      string(value, `Schema relation vocabulary[${index}]`)
    ))),
  };
}

function nullableRef(ref: string): JsonObject {
  return { anyOf: [{ $ref: ref }, { type: 'null' }] };
}

function compileCurrentReleaseValidators(schema: JsonObject): Record<ReleaseArrayKey, ValidateFunction> {
  const defs = object(schema.$defs, 'ctkg.schema.json.$defs');
  const ref = (name: string): string => {
    if (!defs[name]) fail(`pinned Schema does not define ${name}`);
    return `#/$defs/${name}`;
  };
  const nullableString = { type: ['string', 'null'] };
  const stringArray = { type: 'array', items: { type: 'string' } };
  const preferredLabels = {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['language', 'text'],
      properties: {
        language: { type: 'string', minLength: 1 },
        text: { type: 'string', minLength: 1 },
      },
    },
  };
  const canonicalProperties: JsonObject = {
    id: { type: 'string', minLength: 1 },
    canonical_type: { enum: ['DomainConcept', 'Formula', 'KnowledgeStatement', 'SystemModel'] },
    aliases: stringArray,
    core_ids: stringArray,
    description: nullableString,
    evidence_segment_ids: stringArray,
    formula_latex: nullableString,
    formula_role: nullableRef(ref('FormulaRole')),
    concept_kind: nullableRef(ref('ConceptKind')),
    lifecycle_status: { $ref: ref('LifecycleStatus') },
    linearity: nullableRef(ref('Linearity')),
    model_kind: nullableRef(ref('ModelKind')),
    preferred_labels: preferredLabels,
    publication_status: { $ref: ref('PublicationStatus') },
    representation_type: nullableRef(ref('RepresentationType')),
    represents_model: nullableString,
    review_status: { $ref: ref('ReviewStatus') },
    semantic_name: nullableString,
    source_member_ids: stringArray,
    statement_type: nullableRef(ref('StatementType')),
    stochasticity: nullableRef(ref('Stochasticity')),
    temporal_domain: nullableRef(ref('TemporalDomain')),
    time_variance: nullableRef(ref('TimeVariance')),
  };
  const canonicalRequired = Object.keys(canonicalProperties);
  const canonicalNode = {
    type: 'object',
    additionalProperties: false,
    required: canonicalRequired,
    properties: canonicalProperties,
    allOf: [
      {
        if: { properties: { canonical_type: { const: 'DomainConcept' } }, required: ['canonical_type'] },
        then: { properties: { concept_kind: { $ref: ref('ConceptKind') }, semantic_name: { type: 'string', minLength: 1 } } },
      },
      {
        if: { properties: { canonical_type: { const: 'Formula' } }, required: ['canonical_type'] },
        then: { properties: { formula_latex: { type: 'string', minLength: 1 }, formula_role: { $ref: ref('FormulaRole') } } },
      },
      {
        if: { properties: { canonical_type: { const: 'KnowledgeStatement' } }, required: ['canonical_type'] },
        then: { properties: { statement_type: { $ref: ref('StatementType') } } },
      },
      {
        if: { properties: { canonical_type: { const: 'SystemModel' } }, required: ['canonical_type'] },
        then: {
          properties: {
            model_kind: { $ref: ref('ModelKind') },
            temporal_domain: { $ref: ref('TemporalDomain') },
            linearity: { $ref: ref('Linearity') },
            time_variance: { $ref: ref('TimeVariance') },
            stochasticity: { $ref: ref('Stochasticity') },
          },
        },
      },
    ],
  };
  const relationBase: JsonObject = {
    id: { type: 'string', minLength: 1 },
    source_id: { type: 'string', minLength: 1 },
    target_id: { type: 'string', minLength: 1 },
    relation_type: { $ref: ref('SectionGraphRelationType') },
    direct: { type: 'boolean' },
    evidence_segment_ids: stringArray,
    publication_status: { $ref: ref('PublicationStatus') },
    review_status: { $ref: ref('ReviewStatus') },
    review_decision_ids: stringArray,
    curation_action: nullableString,
    curation_rationale: nullableString,
    lineage: { type: 'string', minLength: 1 },
  };
  const exactObject = (properties: JsonObject, required = Object.keys(properties)): JsonObject => ({
    type: 'object',
    additionalProperties: false,
    required,
    properties,
  });
  const schemas: Record<ReleaseArrayKey, JsonObject> = {
    canonical_nodes: canonicalNode,
    source_mappings: exactObject({
      id: { type: 'string', minLength: 1 },
      source_object_id: { type: 'string', minLength: 1 },
      canonical_id: { type: 'string', minLength: 1 },
      mapping_type: { $ref: ref('MappingType') },
      review_status: { $ref: ref('ReviewStatus') },
      publication_status: { $ref: ref('PublicationStatus') },
    }, ['id', 'source_object_id', 'canonical_id', 'mapping_type', 'review_status']),
    gold_relations: exactObject({
      ...relationBase,
      candidate_id: nullableString,
      core_relation_id: nullableString,
      direction: nullableRef(ref('ProjectionDirection')),
      relation_family: nullableRef(ref('RelationFamily')),
      relation_reference_ids: stringArray,
      source_relation_ids: stringArray,
    }, [
      'id',
      'source_id',
      'target_id',
      'relation_type',
      'direct',
      'evidence_segment_ids',
      'publication_status',
      'review_status',
      'review_decision_ids',
      'lineage',
    ]),
    silver_relations: exactObject({
      ...relationBase,
      candidate_id: { type: 'string', minLength: 1 },
      direction: { $ref: ref('ProjectionDirection') },
      relation_family: { $ref: ref('RelationFamily') },
    }),
    source_object_stubs: exactObject({
      id: { type: 'string', minLength: 1 },
      source_id: nullableString,
      section_id: nullableString,
      node_type: nullableString,
      language: nullableString,
      preferred_label: { type: 'string', minLength: 1 },
      quality_layer: { type: 'string', minLength: 1 },
      review_status: { $ref: ref('ReviewStatus') },
      evidence_segment_ids: stringArray,
    }, ['id', 'preferred_label', 'quality_layer', 'review_status', 'evidence_segment_ids']),
    evidence_segment_stubs: exactObject({
      id: { type: 'string', minLength: 1 },
      source_edition_id: { type: 'string', minLength: 1 },
      section_id: { type: 'string', minLength: 1 },
      ordinal: { type: 'integer', minimum: 0 },
      segment_type: { type: 'string', minLength: 1 },
      content_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    }),
  };
  const ajv = new Ajv({ allErrors: true, strict: true });
  return Object.fromEntries(ARRAY_KEYS.map((key) => [
    key,
    ajv.compile({ $defs: defs, ...schemas[key] }),
  ])) as Record<ReleaseArrayKey, ValidateFunction>;
}

function schemaFailure(key: ReleaseArrayKey, index: number, errors: ErrorObject[] | null | undefined): never {
  const detail = errors?.map((error) => `${error.instancePath || '/'} ${error.message ?? error.keyword}`).join('; ');
  fail(`${key}[${index}] violates pinned current Schema contract${detail ? `: ${detail}` : ''}`);
}

function resolveCaptureRevision(root: string): string {
  const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (status.status !== 0) fail('ACT capture Git status could not be verified');
  if (status.stdout.trim()) fail('ACT capture requires one clean Git HEAD');
  const tracked = spawnSync('git', [
    'ls-files',
    '--error-unmatch',
    'course-content/authoring/knowledge/releases/release-set.lock.json',
    'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1/root-locus-engineering-v0.1.json',
    'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1/ctkg.schema.json',
    'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1/RELEASE-NOTES.md',
    'scripts/actkg-release/authoritative-release.ts',
    'scripts/db/import-authoritative-actkg-release.ts',
  ], { cwd: root, encoding: 'utf8' });
  if (tracked.status !== 0) fail('ACT capture inputs and importer must belong to the same Git HEAD');
  const revision = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const value = revision.stdout.trim();
  if (revision.status !== 0 || !COMMIT.test(value)) fail('ACT capture Git revision is unavailable');
  return value;
}

function parseReleaseNotes(notes: string): { sourceRun: string; sourceImplementationCommit: string } {
  const sourceRun = /^- 来源运行：`([^`]+)`$/mu.exec(notes)?.[1];
  const sourceImplementationCommit = /^- 来源实现提交：`([^`]+)`$/mu.exec(notes)?.[1];
  if (!sourceRun || !/^v14p-[a-f0-9]{24}$/u.test(sourceRun)) fail('RELEASE-NOTES source run is missing or invalid');
  if (!sourceImplementationCommit || !COMMIT.test(sourceImplementationCommit)) {
    fail('RELEASE-NOTES source implementation commit is missing or invalid');
  }
  return { sourceRun, sourceImplementationCommit };
}

function assertNoFabricatedLineage(
  claims: LineageClaims | undefined,
  sourceRun: string,
  sourceImplementationCommit: string,
): void {
  if (!claims) return;
  if (claims.sourceRun !== undefined && claims.sourceRun !== sourceRun) fail('claimed source run conflicts with package metadata');
  if (claims.sourceImplementationCommit !== undefined && claims.sourceImplementationCommit !== sourceImplementationCommit) {
    fail('claimed source implementation commit conflicts with package metadata');
  }
  const unavailable = [
    claims.ctkgDatasetHash,
    claims.ctkgDatasetPublicationIdentity,
    claims.ctkgDatasetResolvableLocation,
    claims.revisionRegistryVersion,
    claims.revisionRegistryHash,
  ];
  if (unavailable.some((value) => value !== undefined && value !== null)) {
    fail('current package does not carry CTKGDataset or RevisionProposalRegistry lineage');
  }
}

function validateEnvelope(release: JsonObject, schema: JsonObject, entry: ReleaseLockEntry): void {
  const keys = Object.keys(release).sort();
  const expectedKeys = [...OUTER_KEYS].sort();
  if (canonicalJson(keys) !== canonicalJson(expectedKeys)) fail('outer envelope keys do not match the pinned current contract');
  if (release.release_version !== entry.release_version) fail('release version does not match lock');
  if (release.release_status !== 'RELEASED') fail('release_status must be RELEASED');
  if (release.protocol !== EXPECTED_PROTOCOL) fail('protocol is not adapted by the current importer');
  if (entry.contract_hash !== EXPECTED_CONTRACT_HASH) fail('lock contract_hash is not adapted by the current importer');
  if (release.contract_hash !== entry.contract_hash) fail('contract_hash is not adapted by the current importer');
  if (release.release_hash !== entry.release_hash) fail('release hash does not match lock');
  string(release.authority, 'authority');
  string(release.scope, 'scope');
  object(release.gates, 'gates');

  const vocabulary = extractSchemaVocabulary(schema);
  const validators = compileCurrentReleaseValidators(schema);
  const nodes = records(release, 'canonical_nodes');
  const sourceObjects = records(release, 'source_object_stubs');
  const evidence = records(release, 'evidence_segment_stubs');
  const mappings = records(release, 'source_mappings');
  const gold = records(release, 'gold_relations');
  const silver = records(release, 'silver_relations');
  for (const [name, rows] of Object.entries({ nodes, sourceObjects, evidence, mappings, gold, silver })) {
    assertUniquePayloads(rows, name);
  }
  for (const key of ARRAY_KEYS) {
    for (const [index, row] of records(release, key).entries()) {
      const validator = validators[key];
      if (!validator(row)) schemaFailure(key, index, validator.errors);
    }
  }

  const nodeIds = new Set(nodes.map((node, index) => {
    const canonicalType = string(node.canonical_type, `canonical_nodes[${index}].canonical_type`);
    if (!vocabulary.objectTypes.has(canonicalType)) fail(`canonical type ${canonicalType} is outside the pinned Schema vocabulary`);
    return string(node.id, `canonical_nodes[${index}].id`);
  }));
  const sourceObjectIds = new Set(sourceObjects.map((row, index) => (
    string(row.id, `source_object_stubs[${index}].id`)
  )));
  const evidenceIds = new Set(evidence.map((row, index) => (
    string(row.id, `evidence_segment_stubs[${index}].id`)
  )));

  const checkEvidence = (row: JsonObject, label: string): void => {
    const ids = row.evidence_segment_ids;
    if (ids === undefined) return;
    if (!Array.isArray(ids)) fail(`${label}.evidence_segment_ids must be an array`);
    for (const [index, id] of ids.entries()) {
      const resolved = string(id, `${label}.evidence_segment_ids[${index}]`);
      if (!evidenceIds.has(resolved)) fail(`${label} references missing evidence ${resolved}`);
    }
  };
  nodes.forEach((row, index) => checkEvidence(row, `canonical_nodes[${index}]`));
  sourceObjects.forEach((row, index) => checkEvidence(row, `source_object_stubs[${index}]`));
  for (const [index, node] of nodes.entries()) {
    const memberIds = node.source_member_ids;
    if (memberIds === undefined) continue;
    if (!Array.isArray(memberIds)) fail(`canonical_nodes[${index}].source_member_ids must be an array`);
    for (const [memberIndex, id] of memberIds.entries()) {
      const sourceObjectId = string(id, `canonical_nodes[${index}].source_member_ids[${memberIndex}]`);
      if (!sourceObjectIds.has(sourceObjectId)) {
        fail(`canonical object references missing source member ${sourceObjectId}`);
      }
    }
  }

  const semanticMappings = new Set<string>();
  for (const [index, mapping] of mappings.entries()) {
    const sourceObjectId = string(mapping.source_object_id, `source_mappings[${index}].source_object_id`);
    const canonicalId = string(mapping.canonical_id, `source_mappings[${index}].canonical_id`);
    if (!sourceObjectIds.has(sourceObjectId)) fail(`source mapping references missing source object ${sourceObjectId}`);
    if (!nodeIds.has(canonicalId)) fail(`source mapping references missing canonical object ${canonicalId}`);
    const identity = `${sourceObjectId}\u001f${canonicalId}\u001f${string(mapping.mapping_type, `source_mappings[${index}].mapping_type`)}`;
    if (semanticMappings.has(identity)) fail(`source mappings contain a semantic identity conflict for ${identity}`);
    semanticMappings.add(identity);
  }

  const semanticRelations = new Set<string>();
  for (const [tier, relations] of [['gold', gold], ['silver', silver]] as const) {
    for (const [index, relation] of relations.entries()) {
      const sourceId = string(relation.source_id, `${tier}_relations[${index}].source_id`);
      const targetId = string(relation.target_id, `${tier}_relations[${index}].target_id`);
      const relationType = string(relation.relation_type, `${tier}_relations[${index}].relation_type`);
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
        fail(`${tier} relation ${string(relation.id, `${tier}_relations[${index}].id`)} has a missing endpoint`);
      }
      if (sourceId === targetId) fail(`${tier} relation cannot reference itself`);
      if (!vocabulary.relationTypes.has(relationType)) fail(`relation type ${relationType} is outside the pinned Schema vocabulary`);
      const identity = `${sourceId}\u001f${targetId}\u001f${relationType}`;
      if (semanticRelations.has(identity)) fail(`relations contain a semantic identity conflict for ${identity}`);
      semanticRelations.add(identity);
      checkEvidence(relation, `${tier}_relations[${index}]`);
    }
  }
}

export async function loadAndValidateRelease(options: {
  root?: string;
  releasePath?: string;
  releaseId?: string;
  lineageClaims?: LineageClaims;
  captureRevision?: string;
} = {}): Promise<ValidatedRelease> {
  const root = path.resolve(options.root ?? process.cwd());
  const lockPath = path.join(root, 'course-content/authoring/knowledge/releases/release-set.lock.json');
  const lockBytes = await readFile(lockPath);
  const lock = object(JSON.parse(lockBytes.toString('utf8')), 'release-set lock') as unknown as ReleaseSetLock;
  if (lock.lock_version !== 'actkg-release-set-lock/v1' || !Array.isArray(lock.releases)) fail('unsupported ReleaseSet lock');
  const captureRevision = options.captureRevision ?? resolveCaptureRevision(root);
  if (!COMMIT.test(captureRevision)) fail('ACT capture Git revision is invalid');
  const lockRawHash = sha256(lockBytes);
  const releaseId = options.releaseId ?? 'root-locus-engineering-v0.1';
  const entry = lock.releases.find((candidate) => candidate.release_id === releaseId);
  if (!entry) fail(`release ${releaseId} is not explicitly locked`);

  const controlledDirectory = path.join(root, entry.controlled_path);
  const requestedDirectory = path.resolve(root, options.releasePath ?? entry.controlled_path);
  if (await realpath(requestedDirectory) !== await realpath(controlledDirectory)) fail('requested package path is not the controlled locked path');
  const releasePath = path.join(requestedDirectory, `${entry.release_version}.json`);
  const schemaPath = path.join(requestedDirectory, 'ctkg.schema.json');
  const notesPath = path.join(requestedDirectory, 'RELEASE-NOTES.md');
  const [releaseBytes, schemaBytes, notesBytes] = await Promise.all([
    readFile(releasePath),
    readFile(schemaPath),
    readFile(notesPath),
  ]);
  assertRawHash(releaseBytes, entry.release_json_raw_sha256, 'Release JSON');
  assertRawHash(schemaBytes, entry.schema_raw_sha256, 'Schema');
  assertRawHash(notesBytes, entry.release_notes_raw_sha256, 'RELEASE-NOTES');
  const release = object(JSON.parse(releaseBytes.toString('utf8')), 'Release');
  const schema = object(JSON.parse(schemaBytes.toString('utf8')), 'Schema');
  validateEnvelope(release, schema, entry);

  const normalizedWithoutHash = structuredClone(release);
  delete normalizedWithoutHash.release_hash;
  if (sha256(canonicalJson(normalizedWithoutHash)) !== entry.release_hash) fail('canonical Release hash drift');
  const lineage = parseReleaseNotes(notesBytes.toString('utf8'));
  assertNoFabricatedLineage(options.lineageClaims, lineage.sourceRun, lineage.sourceImplementationCommit);
  return {
    lock,
    entry,
    release,
    schema,
    normalizedWithoutHash,
    captureRevision,
    lockRawHash,
    ...lineage,
  };
}

function counts(validated: ValidatedRelease): ImportCounts {
  return {
    canonicalObjects: records(validated.release, 'canonical_nodes').length,
    sourceMappings: records(validated.release, 'source_mappings').length,
    goldRelations: records(validated.release, 'gold_relations').length,
    silverRelations: records(validated.release, 'silver_relations').length,
    sourceObjects: records(validated.release, 'source_object_stubs').length,
    evidenceSegments: records(validated.release, 'evidence_segment_stubs').length,
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export async function importValidatedRelease(
  db: PrismaClient,
  validated: ValidatedRelease,
): Promise<ImportCounts> {
  const result = counts(validated);
  const releaseId = validated.entry.release_id;
  await db.$transaction(async (tx) => {
    const existing = await tx.actkgRelease.findUnique({
      where: { id: releaseId },
      include: {
        releaseSet: true,
        originalPayload: true,
        receipt: true,
        objects: { orderBy: { ordinal: 'asc' } },
        sourceMappings: { orderBy: { ordinal: 'asc' } },
        relations: { orderBy: [{ qualityTier: 'asc' }, { ordinal: 'asc' }] },
        sourceObjects: { orderBy: { ordinal: 'asc' } },
        evidence: { orderBy: { ordinal: 'asc' } },
      },
    });
    if (existing) {
      const nodes = records(validated.release, 'canonical_nodes');
      const mappings = records(validated.release, 'source_mappings');
      const sourceObjects = records(validated.release, 'source_object_stubs');
      const evidence = records(validated.release, 'evidence_segment_stubs');
      const expectedRelations = [
        ...records(validated.release, 'gold_relations').map((payload, ordinal) => ({ payload, qualityTier: 'GOLD', ordinal })),
        ...records(validated.release, 'silver_relations').map((payload, ordinal) => ({ payload, qualityTier: 'SILVER', ordinal })),
      ];
      const receipt = existing.receipt;
      const drifted = (
        existing.releaseSetId !== validated.lock.release_set_id
        || existing.releaseSet.id !== validated.lock.release_set_id
        || existing.releaseSet.controlledPath !== validated.entry.controlled_path
        || existing.releaseSet.lockVersion !== validated.lock.lock_version
        || existing.releaseSet.candidateState !== 'CANDIDATE'
        || existing.releaseVersion !== validated.entry.release_version
        || existing.releaseStatus !== validated.release.release_status
        || existing.protocol !== validated.release.protocol
        || existing.authority !== validated.release.authority
        || existing.scope !== validated.release.scope
        || existing.contractHash !== validated.entry.contract_hash
        || existing.releaseHash !== validated.entry.release_hash
        || existing.schemaRawHash !== validated.entry.schema_raw_sha256
        || existing.releaseRawHash !== validated.entry.release_json_raw_sha256
        || existing.notesRawHash !== validated.entry.release_notes_raw_sha256
        || existing.captureRevision !== validated.captureRevision
        || existing.lockRawHash !== validated.lockRawHash
        || !existing.originalPayload
        || existing.originalPayload.normalization !== 'canonical-json/rfc8785-subset-v1'
        || existing.originalPayload.canonicalHash !== validated.entry.release_hash
        || !sameJson(existing.originalPayload.normalizedPayload, validated.normalizedWithoutHash)
        || !sameJson(existing.objects.map((row) => row.payload), nodes)
        || existing.objects.some((row, ordinal) => {
          const payload = nodes[ordinal]!;
          return row.ordinal !== ordinal
            || row.canonicalId !== payload.id
            || row.canonicalType !== payload.canonical_type
            || row.semanticName !== (typeof payload.semantic_name === 'string' ? payload.semantic_name : null)
            || row.reviewStatus !== (typeof payload.review_status === 'string' ? payload.review_status : null)
            || row.publicationStatus !== (typeof payload.publication_status === 'string' ? payload.publication_status : null)
            || row.lifecycleStatus !== (typeof payload.lifecycle_status === 'string' ? payload.lifecycle_status : null);
        })
        || !sameJson(existing.sourceMappings.map((row) => row.payload), mappings)
        || existing.sourceMappings.some((row, ordinal) => {
          const payload = mappings[ordinal]!;
          return row.ordinal !== ordinal
            || row.mappingId !== payload.id
            || row.sourceObjectId !== payload.source_object_id
            || row.canonicalId !== payload.canonical_id
            || row.mappingType !== payload.mapping_type
            || row.reviewStatus !== (typeof payload.review_status === 'string' ? payload.review_status : null);
        })
        || !sameJson(
          existing.relations.map((row) => ({ payload: row.payload, qualityTier: row.qualityTier, ordinal: row.ordinal })),
          expectedRelations,
        )
        || existing.relations.some((row, index) => {
          const expected = expectedRelations[index]!;
          const payload = expected.payload;
          return row.relationId !== payload.id
            || row.sourceId !== payload.source_id
            || row.targetId !== payload.target_id
            || row.relationType !== payload.relation_type
            || row.reviewStatus !== (typeof payload.review_status === 'string' ? payload.review_status : null)
            || row.publicationStatus !== (typeof payload.publication_status === 'string' ? payload.publication_status : null)
            || row.direct !== (typeof payload.direct === 'boolean' ? payload.direct : null);
        })
        || !sameJson(existing.sourceObjects.map((row) => row.payload), sourceObjects)
        || existing.sourceObjects.some((row, ordinal) => {
          const payload = sourceObjects[ordinal]!;
          return row.ordinal !== ordinal
            || row.sourceObjectId !== payload.id
            || row.sourceId !== (typeof payload.source_id === 'string' ? payload.source_id : null)
            || row.sectionId !== (typeof payload.section_id === 'string' ? payload.section_id : null)
            || row.nodeType !== (typeof payload.node_type === 'string' ? payload.node_type : null)
            || row.reviewStatus !== (typeof payload.review_status === 'string' ? payload.review_status : null);
        })
        || !sameJson(existing.evidence.map((row) => row.payload), evidence)
        || existing.evidence.some((row, ordinal) => {
          const payload = evidence[ordinal]!;
          return row.ordinal !== ordinal
            || row.evidenceId !== payload.id
            || row.sourceEditionId !== payload.source_edition_id
            || row.sectionId !== payload.section_id
            || row.segmentOrdinal !== payload.ordinal
            || row.segmentType !== payload.segment_type
            || row.contentHash !== payload.content_hash;
        })
        || !receipt
        || receipt.releaseSetId !== validated.lock.release_set_id
        || receipt.sourceRun !== validated.sourceRun
        || receipt.sourceImplementationCommit !== validated.sourceImplementationCommit
        || receipt.captureRevision !== validated.captureRevision
        || receipt.lockRawHash !== validated.lockRawHash
        || receipt.ctkgDatasetAvailability !== 'UNAVAILABLE'
        || receipt.ctkgDatasetHash !== null
        || receipt.ctkgDatasetPublicationIdentity !== null
        || receipt.ctkgDatasetResolvableLocation !== null
        || receipt.revisionRegistryAvailability !== 'UNAVAILABLE'
        || receipt.revisionRegistryVersion !== null
        || receipt.revisionRegistryHash !== null
        || receipt.objectCount !== result.canonicalObjects
        || receipt.sourceMappingCount !== result.sourceMappings
        || receipt.goldRelationCount !== result.goldRelations
        || receipt.silverRelationCount !== result.silverRelations
        || receipt.sourceObjectCount !== result.sourceObjects
        || receipt.evidenceSegmentCount !== result.evidenceSegments
        || receipt.candidateState !== 'CANDIDATE'
      );
      if (drifted) fail(`release identity ${releaseId} already exists with different authoritative content`);
      return;
    }

    const releaseSet = await tx.actkgReleaseSet.findUnique({ where: { id: validated.lock.release_set_id } });
    if (releaseSet && (
      releaseSet.controlledPath !== validated.entry.controlled_path
      || releaseSet.lockVersion !== validated.lock.lock_version
      || releaseSet.candidateState !== 'CANDIDATE'
    )) fail('ReleaseSet identity conflicts with the locked candidate');
    if (!releaseSet) {
      await tx.actkgReleaseSet.create({
        data: {
          id: validated.lock.release_set_id,
          controlledPath: validated.entry.controlled_path,
          lockVersion: validated.lock.lock_version,
        },
      });
    }
    await tx.actkgRelease.create({
      data: {
        id: releaseId,
        releaseSetId: validated.lock.release_set_id,
        releaseVersion: validated.entry.release_version,
        releaseStatus: string(validated.release.release_status, 'release_status'),
        protocol: string(validated.release.protocol, 'protocol'),
        authority: string(validated.release.authority, 'authority'),
        scope: string(validated.release.scope, 'scope'),
        contractHash: validated.entry.contract_hash,
        releaseHash: validated.entry.release_hash,
        schemaRawHash: validated.entry.schema_raw_sha256,
        releaseRawHash: validated.entry.release_json_raw_sha256,
        notesRawHash: validated.entry.release_notes_raw_sha256,
        captureRevision: validated.captureRevision,
        lockRawHash: validated.lockRawHash,
      },
    });

    const nodes = records(validated.release, 'canonical_nodes');
    const sourceObjects = records(validated.release, 'source_object_stubs');
    const evidence = records(validated.release, 'evidence_segment_stubs');
    await tx.actkgAuthoritativeObject.createMany({
      data: nodes.map((row, ordinal) => ({
        releaseId,
        canonicalId: string(row.id, 'canonical object id'),
        ordinal,
        canonicalType: string(row.canonical_type, 'canonical type'),
        semanticName: typeof row.semantic_name === 'string' ? row.semantic_name : null,
        reviewStatus: typeof row.review_status === 'string' ? row.review_status : null,
        publicationStatus: typeof row.publication_status === 'string' ? row.publication_status : null,
        lifecycleStatus: typeof row.lifecycle_status === 'string' ? row.lifecycle_status : null,
        payload: json(row),
      })),
    });
    await tx.actkgSourceObject.createMany({
      data: sourceObjects.map((row, ordinal) => ({
        releaseId,
        sourceObjectId: string(row.id, 'source object id'),
        ordinal,
        sourceId: typeof row.source_id === 'string' ? row.source_id : null,
        sectionId: typeof row.section_id === 'string' ? row.section_id : null,
        nodeType: typeof row.node_type === 'string' ? row.node_type : null,
        reviewStatus: typeof row.review_status === 'string' ? row.review_status : null,
        payload: json(row),
      })),
    });
    await tx.actkgEvidenceSegment.createMany({
      data: evidence.map((row, ordinal) => ({
        releaseId,
        evidenceId: string(row.id, 'evidence id'),
        ordinal,
        sourceEditionId: string(row.source_edition_id, 'evidence source_edition_id'),
        sectionId: string(row.section_id, 'evidence section_id'),
        segmentOrdinal: Number(row.ordinal),
        segmentType: string(row.segment_type, 'evidence segment_type'),
        contentHash: string(row.content_hash, 'evidence content_hash'),
        payload: json(row),
      })),
    });
    await tx.actkgSourceMapping.createMany({
      data: records(validated.release, 'source_mappings').map((row, ordinal) => ({
        releaseId,
        mappingId: string(row.id, 'source mapping id'),
        ordinal,
        sourceObjectId: string(row.source_object_id, 'source mapping source_object_id'),
        canonicalId: string(row.canonical_id, 'source mapping canonical_id'),
        mappingType: string(row.mapping_type, 'source mapping mapping_type'),
        reviewStatus: typeof row.review_status === 'string' ? row.review_status : null,
        payload: json(row),
      })),
    });
    const relationRows = [
      ...records(validated.release, 'gold_relations').map((payload, ordinal) => ({ payload, ordinal, tier: 'GOLD' })),
      ...records(validated.release, 'silver_relations').map((payload, ordinal) => ({ payload, ordinal, tier: 'SILVER' })),
    ];
    await tx.actkgAuthoritativeRelation.createMany({
      data: relationRows.map(({ payload, ordinal, tier }) => ({
        releaseId,
        relationId: string(payload.id, 'relation id'),
        ordinal,
        qualityTier: tier,
        sourceId: string(payload.source_id, 'relation source_id'),
        targetId: string(payload.target_id, 'relation target_id'),
        relationType: string(payload.relation_type, 'relation type'),
        reviewStatus: typeof payload.review_status === 'string' ? payload.review_status : null,
        publicationStatus: typeof payload.publication_status === 'string' ? payload.publication_status : null,
        direct: typeof payload.direct === 'boolean' ? payload.direct : null,
        payload: json(payload),
      })),
    });
    await tx.actkgOriginalReleasePayload.create({
      data: {
        releaseId,
        normalization: 'canonical-json/rfc8785-subset-v1',
        canonicalHash: validated.entry.release_hash,
        normalizedPayload: json(validated.normalizedWithoutHash),
      },
    });
    await tx.actkgImportReceipt.create({
      data: {
        id: `receipt:${releaseId}`,
        releaseSetId: validated.lock.release_set_id,
        releaseId,
        sourceRun: validated.sourceRun,
        sourceImplementationCommit: validated.sourceImplementationCommit,
        captureRevision: validated.captureRevision,
        lockRawHash: validated.lockRawHash,
        ctkgDatasetAvailability: 'UNAVAILABLE',
        revisionRegistryAvailability: 'UNAVAILABLE',
        objectCount: result.canonicalObjects,
        sourceMappingCount: result.sourceMappings,
        goldRelationCount: result.goldRelations,
        silverRelationCount: result.silverRelations,
        sourceObjectCount: result.sourceObjects,
        evidenceSegmentCount: result.evidenceSegments,
      },
    });
  }, { isolationLevel: 'Serializable' });
  return result;
}

export async function reconstructRelease(db: PrismaClient, releaseId: string): Promise<JsonObject> {
  const release = await db.actkgRelease.findUnique({
    where: { id: releaseId },
    include: {
      originalPayload: true,
      objects: { orderBy: { ordinal: 'asc' } },
      sourceMappings: { orderBy: { ordinal: 'asc' } },
      relations: { orderBy: [{ qualityTier: 'asc' }, { ordinal: 'asc' }] },
      sourceObjects: { orderBy: { ordinal: 'asc' } },
      evidence: { orderBy: { ordinal: 'asc' } },
    },
  });
  if (!release?.originalPayload) fail(`persisted release ${releaseId} is incomplete`);
  const reconstructed = structuredClone(release.originalPayload.normalizedPayload) as JsonObject;
  reconstructed.canonical_nodes = release.objects.map((row) => row.payload);
  reconstructed.source_mappings = release.sourceMappings.map((row) => row.payload);
  reconstructed.gold_relations = release.relations.filter((row) => row.qualityTier === 'GOLD').map((row) => row.payload);
  reconstructed.silver_relations = release.relations.filter((row) => row.qualityTier === 'SILVER').map((row) => row.payload);
  reconstructed.source_object_stubs = release.sourceObjects.map((row) => row.payload);
  reconstructed.evidence_segment_stubs = release.evidence.map((row) => row.payload);
  reconstructed.release_hash = release.releaseHash;
  return reconstructed;
}

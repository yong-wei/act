#!/usr/bin/env tsx

import 'dotenv/config';

import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

import {
  verifyMaterializedSnapshot,
  type AuthorityEngineeringBody,
  type AuthoritySnapshotManifest,
} from '../../src/lib/authoritative-knowledge/authority-snapshot';
import { canonicalJson } from '../actkg-release/authoritative-release';
import {
  buildActiveCourseInventory,
} from '../../src/lib/teaching-projection/active-inventory';
import {
  buildPackageAuthoringFromMigration,
  evaluatePackageReadiness,
} from '../../src/lib/teaching-projection/package-migration';
import { buildTeachingProjection } from '../../src/lib/teaching-projection/builder';
import {
  mapActiveCourseResources,
  migrationStatusDigest,
  summarizeMigrationStatuses,
} from '../../src/lib/teaching-projection/mapping';
import {
  loadLegacyCrosswalk,
} from '../../src/lib/teaching-projection/crosswalk';
import {
  loadAuthorDecisionsFromFile,
  defaultAuthorDecisionsPath,
} from '../../src/lib/teaching-projection/author-decisions';
import {
  loadCardCrosswalk,
} from '../../src/lib/teaching-projection/cards/crosswalk';
import {
  projectionDigest,
} from '../../src/lib/teaching-projection/hash';
import {
  resolveTeachingProjectionStorePaths,
  stageTeachingProjection,
} from '../../src/lib/teaching-projection/store';
import type {
  AuthorityNodeIndexEntry,
} from '../../src/lib/teaching-projection/contracts';
import type {
  ActiveCardMappingEntry,
  ActiveCourseInventory,
  ActiveCourseMigrationReport,
  ActiveCoursePackageReport,
  AuthorityLabelIndexEntry,
  AuthorSemanticDecision,
  LegacyIdCrosswalkEntry,
  MappingContext,
  MigrationStatusRecord,
} from '../../src/lib/teaching-projection/migration-contracts';
import {
  ACTIVE_COURSE_MIGRATION_STATUS_CONTRACT,
} from '../../src/lib/teaching-projection/migration-contracts';
import {
  loadAndBuildTextbookLocatorProjection,
} from '../../src/lib/teaching-projection/textbook-locators/builder';
import {
  buildPrerequisitePublicationFailClosed,
  parseCoreNodesDocument,
} from '../../src/lib/teaching-projection/prerequisites';
import { parseEdgesDocument } from '../../src/lib/teaching-projection/prerequisites/edges';

const COMMIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DEFAULT_PROJECTION_ROOT = 'course-content/runtime/knowledge/projection';
const HISTORICAL_DEFER_COUNT = 4880;
const HISTORICAL_BATCH_COUNT = 34;

export const CUTOVER_PROJECTION_PROTOCOL =
  'actkg-to-act-cutover-teaching-projection/1' as const;

export interface StagedAuthorityInput {
  manifestPath: string;
  manifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
}

export interface TeachingProjectionCandidateInput {
  repoRoot: string;
  authoringRevision: string;
  authority: StagedAuthorityInput;
  /** Existing ACT-owned mapping evidence. No generated mapping is accepted. */
  crosswalk?: readonly LegacyIdCrosswalkEntry[];
  cards?: readonly ActiveCardMappingEntry[];
  authorDecisions?: readonly AuthorSemanticDecision[];
  /** Test seam; the production CLI uses the registry inventory. */
  inventory?: ActiveCourseInventory;
  assertRealInventoryCounts?: boolean;
}

export interface TeachingProjectionCandidateResult {
  inventory: ActiveCourseInventory;
  migration: ActiveCourseMigrationReport;
  packageReports: ActiveCoursePackageReport[];
  packageAuthoring: Array<{
    packageId: string;
    authoring: ReturnType<typeof buildPackageAuthoringFromMigration>;
  }>;
  worklist: WorklistDocument;
  authorityNodes: AuthorityNodeIndexEntry[];
  authorityLabels: AuthorityLabelIndexEntry[];
  mappingEvidence: {
    crosswalkCount: number;
    cardCount: number;
    authorDecisionCount: number;
  };
}

export interface WorklistItem {
  status: 'REVIEW_REQUIRED';
  packageId: string;
  resourceId: string;
  resourceType: string;
  sourcePath: string;
  sourceDigest: string;
  missingEvidence: string[];
}

export interface WorklistDocument {
  contract: 'act-actkg-cutover-teaching-worklist/v1';
  status: 'REVIEW_REQUIRED';
  authoringRevision: string;
  authoritySnapshotId: string;
  authoritySnapshotHash: string;
  inventoryDigest: string;
  historicalCourseCoverageExcluded: {
    batchCount: number;
    deferCount: number;
    includedInDenominator: false;
  };
  items: WorklistItem[];
  itemCount: number;
  inputDigest: string;
}

export interface PrepareCutoverInput extends TeachingProjectionCandidateInput {
  authorityManifestPath?: string;
  authorityRoot?: string;
  authorityCaptureRevision: string;
  admissionDeltaReceiptPath: string;
  outputRoot: string;
  /** CLI defaults true; tests use false and synthetic inventories. */
  assertRealInventoryCounts?: boolean;
}

export interface PrepareCutoverResult {
  outputRoot: string;
  candidate: TeachingProjectionCandidateResult;
  stagedPackages: Array<{
    packageId: string;
    projectionId: string;
    projectionHash: string;
    releaseDir: string;
    reused: boolean;
  }>;
}

export function persistedPackageCandidateReference(input: {
  packageId: string;
  projectionId: string;
  projectionHash: string;
  releaseDir: string;
  reused?: boolean;
}): {
  packageId: string;
  projectionId: string;
  projectionHash: string;
  releaseDir: string;
} {
  return {
    packageId: input.packageId,
    projectionId: input.projectionId,
    projectionHash: input.projectionHash,
    releaseDir: input.releaseDir,
  };
}

function fail(message: string): never {
  throw new Error(`ActKG → ACT Teaching Projection preparation rejected: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function relative(root: string, target: string): string {
  const result = path.relative(path.resolve(root), path.resolve(target));
  return result.length === 0 ? '.' : result.split(path.sep).join('/');
}

function sortStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

/**
 * Inventory contracts use optional object fields. Omit only those undefined
 * fields before canonical serialization; undefined array members still reject
 * because their positional meaning would be ambiguous.
 */
export function omitUndefinedObjectFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item === undefined) {
        fail(`cannot serialize undefined array item at index ${index}`);
      }
      return omitUndefinedObjectFields(item);
    });
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, omitUndefinedObjectFields(item)]),
    );
  }
  return value;
}

function writeCanonical(filePath: string, value: unknown): Promise<void> {
  return mkdir(path.dirname(filePath), { recursive: true })
    .then(() => writeFile(filePath, `${canonicalJson(omitUndefinedObjectFields(value))}\n`, 'utf8'));
}

function rejectDefaultProjectionPath(repoRoot: string, target: string, label: string): void {
  const resolved = path.resolve(target);
  const defaultRoot = path.resolve(repoRoot, DEFAULT_PROJECTION_ROOT);
  const defaultPointer = path.join(defaultRoot, 'current.json');
  if (
    resolved === defaultRoot
    || resolved === defaultPointer
    || resolved.startsWith(`${defaultRoot}${path.sep}`)
  ) {
    fail(`${label} must not resolve to the default Teaching Projection store/current pointer`);
  }
}

export function assertCandidateOutputRoot(repoRoot: string, outputRoot: string): void {
  rejectDefaultProjectionPath(repoRoot, outputRoot, 'outputRoot');
  if (path.basename(path.resolve(outputRoot)) === 'current.json') {
    fail('outputRoot cannot be a current.json path');
  }
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    fail(`cannot read JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function resolveAuthorityManifestPath(input: {
  repoRoot: string;
  authorityRoot?: string;
  authorityManifestPath?: string;
}): Promise<string> {
  if (input.authorityManifestPath) {
    return path.resolve(input.authorityManifestPath);
  }
  if (!input.authorityRoot) fail('authorityRoot or authorityManifestPath is required');
  const root = path.resolve(input.authorityRoot);
  const releases = path.join(root, 'releases');
  const names = (await readdir(releases, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(releases, entry.name, 'manifest.json'))
    .filter((manifestPath) => existsSync(manifestPath))
    .sort();
  if (names.length !== 1) {
    fail(`authorityRoot must contain exactly one staged manifest, found ${names.length}`);
  }
  return names[0]!;
}

export function loadStagedAuthority(input: {
  manifestPath: string;
  authorityCaptureRevision: string;
}): StagedAuthorityInput {
  const manifestPath = path.resolve(input.manifestPath);
  const manifest = readJson(manifestPath) as AuthoritySnapshotManifest;
  const engineeringPath = path.join(path.dirname(manifestPath), 'engineering.json');
  const engineering = readJson(engineeringPath) as AuthorityEngineeringBody;
  try {
    verifyMaterializedSnapshot({ manifest, engineering });
  } catch (error) {
    fail(`staged Authority integrity validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest.lifecycle !== 'staged') fail('Authority manifest is not staged');
  const captureRevision = nonEmptyString(input.authorityCaptureRevision, 'authorityCaptureRevision');
  if (!COMMIT.test(captureRevision)) fail('authorityCaptureRevision must be a 40-character Git SHA');
  if (manifest.captureRevision !== captureRevision) {
    fail(`Authority captureRevision mismatch: manifest=${manifest.captureRevision} input=${captureRevision}`);
  }
  return { manifestPath, manifest, engineering };
}

function payloadRecord(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function authorityIndexes(engineering: AuthorityEngineeringBody): {
  nodes: AuthorityNodeIndexEntry[];
  labels: AuthorityLabelIndexEntry[];
} {
  const nodes: AuthorityNodeIndexEntry[] = [];
  const labels: AuthorityLabelIndexEntry[] = [];
  for (const object of engineering.objects) {
    const payload = payloadRecord(object.payload);
    const nested = payloadRecord(payload.payload);
    const lifecycleStatus = object.lifecycleStatus ?? 'active';
    const successorCanonicalId = [
      payload.successorCanonicalId,
      payload.successor_canonical_id,
      nested.successorCanonicalId,
      nested.successor_canonical_id,
    ].find((value): value is string => typeof value === 'string' && value.length > 0) ?? null;
    nodes.push({ canonicalId: object.canonicalId, lifecycleStatus, successorCanonicalId });
    const labelsForObject = sortStrings([
      object.semanticName,
      payload.displayName,
      payload.display_name,
      nested.displayName,
      nested.display_name,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0));
    labels.push({
      canonicalId: object.canonicalId,
      labels: labelsForObject,
      lifecycleStatus,
    });
  }
  nodes.sort((a, b) => a.canonicalId < b.canonicalId ? -1 : a.canonicalId > b.canonicalId ? 1 : 0);
  labels.sort((a, b) => a.canonicalId < b.canonicalId ? -1 : a.canonicalId > b.canonicalId ? 1 : 0);
  return { nodes, labels };
}

function worklistFromMigration(input: {
  migration: ActiveCourseMigrationReport;
  inventory: ActiveCourseInventory;
  authority: AuthoritySnapshotManifest;
}): WorklistDocument {
  const resourcesById = new Map(
    input.inventory.packages.flatMap((pkg) => pkg.resources).map((resource) => [resource.resourceId, resource]),
  );
  const items: WorklistItem[] = input.migration.records
    .filter((record) => record.status === 'REVIEW_REQUIRED')
    .map((record) => {
      const resource = resourcesById.get(record.resourceId);
      const missingEvidence = sortStrings([
        record.rationale,
        ...(record.candidates.length === 0 ? ['explicit Canonical binding evidence'] : []),
      ]);
      return {
        status: 'REVIEW_REQUIRED' as const,
        packageId: record.packageId,
        resourceId: record.resourceId,
        resourceType: record.resourceType,
        sourcePath: resource?.sourcePath ?? record.sourcePath,
        sourceDigest: resource?.sourceDigest ?? record.sourceDigest,
        missingEvidence,
      };
    })
    .sort((a, b) => a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0);
  const body = {
    contract: 'act-actkg-cutover-teaching-worklist/v1' as const,
    status: 'REVIEW_REQUIRED' as const,
    authoringRevision: input.migration.authoringRevision,
    authoritySnapshotId: input.authority.snapshotId,
    authoritySnapshotHash: input.authority.snapshotHash,
    inventoryDigest: input.inventory.inventoryDigest,
    historicalCourseCoverageExcluded: {
      batchCount: HISTORICAL_BATCH_COUNT,
      deferCount: HISTORICAL_DEFER_COUNT,
      includedInDenominator: false as const,
    },
    items,
    itemCount: items.length,
  };
  return { ...body, inputDigest: projectionDigest(body) };
}

function runCandidateMigration(input: {
  inventory: ActiveCourseInventory;
  mappingContext: MappingContext;
  authority: StagedAuthorityInput;
  authorityNodes: readonly AuthorityNodeIndexEntry[];
}): {
  migration: ActiveCourseMigrationReport;
  packageReports: ActiveCoursePackageReport[];
  packageAuthoring: TeachingProjectionCandidateResult['packageAuthoring'];
} {
  const allRecords: MigrationStatusRecord[] = [];
  const packageReports: ActiveCoursePackageReport[] = [];
  const packageAuthoring: TeachingProjectionCandidateResult['packageAuthoring'] = [];
  for (const pkg of input.inventory.packages) {
    const records = mapActiveCourseResources(
      pkg.resources,
      input.mappingContext,
      { optionalUnboundAsExplicitNone: false },
    );
    allRecords.push(...records);
    const authoring = buildPackageAuthoringFromMigration({
      packageId: pkg.packageId,
      scopeId: pkg.scopeId,
      authoringRevision: input.inventory.authoringRevision,
      authorityReleaseId: input.authority.manifest.releaseId,
      authorityReleaseSetId: input.authority.manifest.releaseSetId,
      authoritySnapshotId: input.authority.manifest.snapshotId,
      authoritySnapshotHash: input.authority.manifest.snapshotHash,
      authorityNodes: input.authorityNodes,
      records,
      lessonKeyByResourceId: new Map(pkg.resources.map((resource) => [
        resource.resourceId,
        { lessonKey: resource.lessonKey, stepId: resource.stepId },
      ])),
    });
    packageAuthoring.push({ packageId: pkg.packageId, authoring });
    let buildError: string | null = null;
    let projectionGatePassed = false;
    let gateStatus: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'NOT_PROJECTED' = 'REVIEW_REQUIRED';
    try {
      const artifacts = buildTeachingProjection(authoring);
      projectionGatePassed = artifacts.gate.passed;
      gateStatus = artifacts.gate.status;
    } catch (error) {
      buildError = error instanceof Error ? error.message : String(error);
    }
    if (records.some((record) => record.status === 'REVIEW_REQUIRED' && record.projectionMode === 'REQUIRED')) {
      projectionGatePassed = false;
      gateStatus = 'REVIEW_REQUIRED';
    }
    packageReports.push(evaluatePackageReadiness({
      packageId: pkg.packageId,
      scopeId: pkg.scopeId,
      records,
      projectionGatePassed,
      gateStatus,
      buildError,
    }));
  }
  allRecords.sort((a, b) => a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0);
  packageReports.sort((a, b) => a.packageId < b.packageId ? -1 : a.packageId > b.packageId ? 1 : 0);
  const summary = summarizeMigrationStatuses(allRecords);
  const migrationBody = {
    contract: ACTIVE_COURSE_MIGRATION_STATUS_CONTRACT,
    authoringRevision: input.inventory.authoringRevision,
    inventoryDigest: input.inventory.inventoryDigest,
    records: allRecords,
    summary: { ...summary, packageCount: input.inventory.packageCount },
  };
  return {
    migration: { ...migrationBody, reportDigest: migrationStatusDigest(allRecords) },
    packageReports,
    packageAuthoring,
  };
}

export function buildTeachingProjectionCandidate(
  input: TeachingProjectionCandidateInput,
): TeachingProjectionCandidateResult {
  const indexes = authorityIndexes(input.authority.engineering);
  const inventory = input.inventory ?? buildActiveCourseInventory({
    repoRoot: input.repoRoot,
    authoringRevision: input.authoringRevision,
  });
  const assertCounts = input.assertRealInventoryCounts === true;
  if (assertCounts && (inventory.packageCount !== 32 || inventory.resourceCount !== 551)) {
    fail(`active inventory count drift: expected 32 packages/551 resources, got ${inventory.packageCount}/${inventory.resourceCount}`);
  }
  const authorityCanonicalIds = new Set(
    indexes.nodes
      .filter((node) => !['retired', 'draft'].includes(String(node.lifecycleStatus).toLowerCase()))
      .map((node) => node.canonicalId),
  );
  const mappingContext: MappingContext = {
    crosswalk: input.crosswalk ?? [],
    cards: input.cards ?? [],
    authorityLabels: indexes.labels,
    authorityCanonicalIds,
    authorDecisions: input.authorDecisions ?? [],
    defaultRole: 'PRACTICES',
  };
  const run = runCandidateMigration({ inventory, mappingContext, authority: input.authority, authorityNodes: indexes.nodes });
  return {
    inventory,
    migration: run.migration,
    packageReports: run.packageReports,
    packageAuthoring: run.packageAuthoring,
    worklist: worklistFromMigration({ migration: run.migration, inventory, authority: input.authority.manifest }),
    authorityNodes: indexes.nodes,
    authorityLabels: indexes.labels,
    mappingEvidence: {
      crosswalkCount: input.crosswalk?.length ?? 0,
      cardCount: input.cards?.length ?? 0,
      authorDecisionCount: input.authorDecisions?.length ?? 0,
    },
  };
}

interface DeltaReceiptDocument {
  order: number;
  candidate?: { releaseId?: string; releaseSetId?: string; releaseHash?: string; evidenceCaptureRevision?: string };
  persisted?: { receiptId?: string; outputDigest?: string; inputDigest?: string };
  computed?: { outputDigest?: string; captureRevision?: string };
}

function loadDeltaReceipts(filePath: string, authorityCaptureRevision: string, authority: AuthoritySnapshotManifest): {
  receipts: DeltaReceiptDocument[];
  finalDigest: string;
} {
  const raw = readJson(filePath);
  const rows = Array.isArray(raw)
    ? raw
    : isObject(raw) && Array.isArray(raw.deltaReceipts)
      ? raw.deltaReceipts
      : null;
  if (!rows || rows.length !== 7) fail(`admission delta receipt must contain exactly 7 hops, got ${rows?.length ?? 0}`);
  const receipts = rows.map((row, index) => {
    if (!isObject(row)) fail(`delta receipt ${index + 1} must be an object`);
    const normalized = row as unknown as DeltaReceiptDocument;
    if (normalized.order !== index + 1) fail(`delta receipt order is not contiguous at hop ${index + 1}`);
    const capture = normalized.computed?.captureRevision ?? normalized.candidate?.evidenceCaptureRevision;
    if (capture !== authorityCaptureRevision) fail(`delta receipt ${index + 1} captureRevision mismatch`);
    return normalized;
  });
  const final = receipts.at(-1)!;
  if (final.candidate?.releaseId !== authority.releaseId) fail('final delta candidate releaseId does not match staged Authority');
  if (final.candidate?.releaseSetId !== authority.releaseSetId) fail('final delta candidate releaseSetId does not match staged Authority');
  const finalDigest = final.persisted?.outputDigest ?? final.computed?.outputDigest;
  if (!finalDigest || !SHA256.test(finalDigest)) fail('final delta output digest is missing or invalid');
  return { receipts, finalDigest };
}

async function writeTextbookAssessment(input: {
  repoRoot: string;
  outputRoot: string;
  authority: AuthoritySnapshotManifest;
  authorityCanonicalIds: ReadonlySet<string>;
}): Promise<void> {
  const projection = loadAndBuildTextbookLocatorProjection({
    scopeId: 'actkg-cutover-candidate',
    repoRoot: input.repoRoot,
    authorityCanonicalIds: input.authorityCanonicalIds,
    projectionBuildId: `cutover-textbook-${input.authority.snapshotHash.slice(0, 16)}`,
  });
  const assessment = {
    contract: 'act-actkg-cutover-textbook-input-assessment/v1',
    validatedVia: 'loadAndBuildTextbookLocatorProjection',
    authorityReleaseId: input.authority.releaseId,
    authoritySnapshotHash: input.authority.snapshotHash,
    status: projection.sliceStatus === 'PUBLISHED' ? 'READY' : 'REVIEW_REQUIRED',
    sliceStatus: projection.sliceStatus,
    summary: projection.summary,
    failures: projection.failures.map((failure) => ({
      ...failure,
      message: failure.message.replace(`${input.repoRoot}/`, ''),
    })),
  };
  await writeCanonical(path.join(input.outputRoot, 'textbook-input-assessment.json'), assessment);
}

async function writePrerequisiteAssessment(input: {
  repoRoot: string;
  outputRoot: string;
  authoringRevision: string;
  authority: AuthoritySnapshotManifest;
  authorityNodes: readonly AuthorityNodeIndexEntry[];
}): Promise<void> {
  const root = path.join(input.repoRoot, 'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory');
  const corePath = path.join(root, 'core-nodes.yaml');
  const edgesPath = path.join(root, 'edges.yaml');
  let result: ReturnType<typeof buildPrerequisitePublicationFailClosed>;
  let inputFiles: string[] = [];
  try {
    if (!existsSync(corePath) || !existsSync(edgesPath)) {
      throw new Error('prerequisite inventory files are missing');
    }
    inputFiles = [relative(input.repoRoot, corePath), relative(input.repoRoot, edgesPath)];
    const core = parseCoreNodesDocument(parseYaml(readFileSync(corePath, 'utf8')));
    const edges = parseEdgesDocument(parseYaml(readFileSync(edgesPath, 'utf8')));
    result = buildPrerequisitePublicationFailClosed({
      scopeId: core.scopeId,
      authoringRevision: input.authoringRevision,
      authorityReleaseId: input.authority.releaseId,
      projectionCaptureId: input.authority.snapshotId,
      authorityNodes: input.authorityNodes,
      coreNodes: core.nodes,
      edges: edges.edges,
      decisions: [],
      candidates: [],
    });
  } catch (error) {
    result = {
      ok: false,
      artifacts: null,
      priorPreserved: false,
      findings: [],
      errorCode: 'input-invalid',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
  const assessment = {
    contract: 'act-actkg-cutover-prerequisite-input-assessment/v1',
    validatedVia: 'parseCoreNodesDocument+parseEdgesDocument+buildPrerequisitePublicationFailClosed',
    authorityReleaseId: input.authority.releaseId,
    authoritySnapshotHash: input.authority.snapshotHash,
    inputFiles,
    status: result.ok && result.artifacts?.gate.passed ? 'READY' : 'REVIEW_REQUIRED',
    gate: result.artifacts?.gate ?? null,
    findings: result.findings,
    errorCode: result.errorCode ?? null,
    errorMessage: result.errorMessage ?? null,
  };
  await writeCanonical(path.join(input.outputRoot, 'prerequisite-input-assessment.json'), assessment);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const option = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const repoRoot = path.resolve(nonEmptyString(option('--repo-root'), '--repo-root'));
  const outputRoot = path.resolve(nonEmptyString(option('--output-root'), '--output-root'));
  const authoringRevision = nonEmptyString(option('--authoring-revision'), '--authoring-revision');
  const authorityCaptureRevision = nonEmptyString(option('--authority-capture-revision'), '--authority-capture-revision');
  const admissionDeltaReceiptPath = path.resolve(nonEmptyString(option('--admission-delta-receipt'), '--admission-delta-receipt'));
  assertCandidateOutputRoot(repoRoot, outputRoot);
  if (!COMMIT.test(authoringRevision)) fail('authoringRevision must be a 40-character Git SHA');
  if (!COMMIT.test(authorityCaptureRevision)) fail('authorityCaptureRevision must be a 40-character Git SHA');
  const authorityManifestPath = await resolveAuthorityManifestPath({
    repoRoot,
    authorityRoot: option('--authority-root'),
    authorityManifestPath: option('--authority-manifest'),
  });
  const authority = loadStagedAuthority({ manifestPath: authorityManifestPath, authorityCaptureRevision });
  const delta = loadDeltaReceipts(admissionDeltaReceiptPath, authorityCaptureRevision, authority.manifest);
  const legacy = loadLegacyCrosswalk(path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection/legacy-crosswalk.jsonl'));
  const cardDocument = loadCardCrosswalk(path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection/cards/card-crosswalk.jsonl'));
  const cards: ActiveCardMappingEntry[] = cardDocument.entries.map((entry) => ({
    cardId: entry.cardId ?? entry.legacyNodeId,
    canonicalId: entry.canonicalId,
    active: !entry.stale,
    legacyNodeId: entry.legacyNodeId,
  }));
  const decisionPath = defaultAuthorDecisionsPath(path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection'));
  const authorDecisions = loadAuthorDecisionsFromFile(decisionPath);
  const candidate = buildTeachingProjectionCandidate({
    repoRoot,
    authoringRevision,
    authority,
    crosswalk: legacy.entries,
    cards,
    authorDecisions,
    assertRealInventoryCounts: true,
  });
  await mkdir(outputRoot, { recursive: true });
  const stagedPackages: PrepareCutoverResult['stagedPackages'] = [];
  for (const packageCandidate of candidate.packageAuthoring) {
    const packageRoot = path.join(outputRoot, 'packages', packageCandidate.packageId);
    const paths = resolveTeachingProjectionStorePaths(packageRoot);
    const staged = stageTeachingProjection(paths, packageCandidate.authoring);
    if (existsSync(paths.currentPointer)) fail(`package ${packageCandidate.packageId} unexpectedly wrote current.json`);
    stagedPackages.push({
      packageId: packageCandidate.packageId,
      projectionId: staged.projectionId,
      projectionHash: staged.projectionHash,
      releaseDir: relative(outputRoot, staged.releaseDir),
      reused: staged.reused,
    });
  }
  const authorityCanonicalIds = new Set(candidate.authorityNodes
    .filter((node) => !['retired', 'draft'].includes(String(node.lifecycleStatus).toLowerCase()))
    .map((node) => node.canonicalId));
  const deltaImpact = {
    contract: 'act-actkg-cutover-delta-impact/v1',
    authorityCaptureRevision,
    authoringRevision,
    authoritySnapshotId: authority.manifest.snapshotId,
    authoritySnapshotHash: authority.manifest.snapshotHash,
    priorProjection: { present: false, status: 'NO_PRIOR_PROJECTION' },
    initialImpactScope: {
      kind: 'active-course-inventory-only',
      packageCount: candidate.inventory.packageCount,
      resourceCount: candidate.inventory.resourceCount,
      unboundAuthorityObjectsIncluded: false,
      reason: 'No prior Teaching Projection exists; only active ACT resources are in scope.',
    },
    admissionDeltaReceipts: delta.receipts,
    hopCount: delta.receipts.length,
    finalDigest: delta.finalDigest,
  };
  await writeCanonical(path.join(outputRoot, 'inventory.json'), candidate.inventory);
  await writeCanonical(path.join(outputRoot, 'delta-impact.json'), deltaImpact);
  await writeCanonical(path.join(outputRoot, 'migration-status.json'), candidate.migration);
  await writeCanonical(path.join(outputRoot, 'package-reports.json'), {
    contract: 'act-actkg-cutover-package-reports/v1',
    reports: candidate.packageReports.map((report) => ({
      ...report,
      candidate: (() => {
        const staged = stagedPackages.find((item) => item.packageId === report.packageId);
        return staged ? persistedPackageCandidateReference(staged) : null;
      })(),
    })),
  });
  await writeCanonical(path.join(outputRoot, 'worklist.json'), candidate.worklist);
  await writeTextbookAssessment({ repoRoot, outputRoot, authority: authority.manifest, authorityCanonicalIds });
  await writePrerequisiteAssessment({
    repoRoot,
    outputRoot,
    authoringRevision,
    authority: authority.manifest,
    authorityNodes: candidate.authorityNodes,
  });
  const result: PrepareCutoverResult = { outputRoot, candidate, stagedPackages };
  process.stdout.write(`${JSON.stringify({
    protocol: CUTOVER_PROJECTION_PROTOCOL,
    outputRoot: relative(repoRoot, outputRoot),
    inventory: {
      packageCount: candidate.inventory.packageCount,
      resourceCount: candidate.inventory.resourceCount,
      inventoryDigest: candidate.inventory.inventoryDigest,
    },
    migration: candidate.migration.summary,
    worklistCount: candidate.worklist.itemCount,
    stagedPackageCount: stagedPackages.length,
    deltaHopCount: delta.receipts.length,
    finalDigest: delta.finalDigest,
  }, null, 2)}\n`);
  void result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

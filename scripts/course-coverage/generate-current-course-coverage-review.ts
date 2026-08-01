#!/usr/bin/env tsx
/**
 * Issue #1180 — freeze the current CourseCoverage review denominator and
 * deterministic B1..Bn batches.  This script consumes only the immutable A
 * v2 admission directory; it never reads the legacy v1/R3 selector path and
 * never writes CourseCoverage decisions or a production selector.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import {
  assertNoCurrentReviewInputDrift,
  assertCurrentDeltaReceiptIdentity,
  assertCurrentReviewProtectedPathsClean,
  buildCurrentCourseCoverageWorklist,
  buildCurrentReviewBatchManifest,
  buildCurrentReviewAssemblyReceipt,
  currentReviewInputFingerprint,
  classifyCurrentCourseEvidenceSource,
  deriveCurrentReviewReleasePaths,
  type CurrentCourseCoverageAuthority,
  type CurrentCourseCoverageEvidenceRef,
  type CurrentReviewBoundaryEvidence,
  type CurrentPriorDecisionRef,
} from '../../src/lib/aggregate-governance/current-course-coverage-review';
import { publishImmutableJsonSet } from '../../src/lib/aggregate-governance/current-course-coverage-review-io';

const ADMISSION_ROOT =
  'course-content/authoring/knowledge/issue-1179-latest-stable-admission-v2';
const OUTPUT_ROOT =
  'course-content/authoring/knowledge/issue-1180-current-course-coverage-review';
const BINDING_PATH = `${ADMISSION_ROOT}/latest-stable-binding.json`;
const ADMISSION_RECEIPT_PATH = `${ADMISSION_ROOT}/admission/admission-receipt.json`;
const DELTA_RECEIPTS_PATH = `${ADMISSION_ROOT}/admission/delta-receipts.json`;
const CHAIN_RECEIPT_PATH = `${ADMISSION_ROOT}/chain/chain-intake-receipt.json`;
const ACTIVE_COVERAGE_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/active/automatic-control.json';
const OUTPUT_FILES = [
  'worklist.json',
  'batch-manifest.json',
  'assembly-receipt.json',
  'gate-summary.json',
] as const;
const FORBIDDEN_AUTHORITY_PATHS = [
  'src/lib/canonical-learning-fact-identity/authority.ts',
  'src/lib/canonical-learning-fact-identity/writer.ts',
  'src/lib/canonical-rag/authority.ts',
  ACTIVE_COVERAGE_PATH,
] as const;

type JsonRecord = Record<string, any>;

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Current review Git command failed: ${args.join(' ')}`);
  return String(result.stdout ?? '').trim();
}

function gitBlob(root: string, revision: string, relativePath: string): string {
  const result = spawnSync('git', ['show', `${revision}:${relativePath}`], {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error(`Current review rejected: protected authority path is unavailable at ${revision}: ${relativePath}`);
  }
  return sha256(result.stdout);
}

async function readJson(root: string, relative: string): Promise<{ value: JsonRecord; digest: string }> {
  const bytes = await readFile(path.join(root, relative));
  return { value: JSON.parse(bytes.toString('utf8')) as JsonRecord, digest: sha256(bytes) };
}

async function readJsonArray(root: string, relative: string): Promise<{ value: any[]; digest: string }> {
  const loaded = await readJson(root, relative);
  if (!Array.isArray(loaded.value)) throw new Error(`Current review input is not an array: ${relative}`);
  return { value: loaded.value, digest: loaded.digest };
}

async function allJsonFiles(root: string, relative: string): Promise<string[]> {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await allJsonFiles(root, child));
    else if (entry.isFile() && entry.name.endsWith('.json')) result.push(child);
  }
  return result;
}

function componentTail(value: string): string {
  return value.replace(/^ctr:(?:release:)?/u, '');
}

function addModuleMembership(target: Map<string, Set<string>>, moduleId: string, ids: Iterable<string>): void {
  for (const id of ids) {
    const canonicalId = String(id).trim();
    if (!canonicalId) continue;
    const modules = target.get(canonicalId) ?? new Set<string>();
    modules.add(moduleId);
    target.set(canonicalId, modules);
  }
}

interface ModuleMembershipLoad {
  membership: Map<string, readonly string[]>;
  sourceDigests: Record<string, string>;
  membershipDigest: string;
}

async function loadModuleMembership(root: string, componentIds: readonly string[]): Promise<ModuleMembershipLoad> {
  const files = await allJsonFiles(root, `${ADMISSION_ROOT}/chain/releases`);
  const matched = new Map<string, Set<string>>();
  const sourceDigests: Record<string, string> = {};
  for (const componentId of componentIds) {
    const tail = componentTail(componentId);
    for (const relative of files) {
      if (!relative.includes(`/${tail}/`) && !relative.endsWith(`/${tail}.json`)) continue;
      const bytes = await readFile(path.join(root, relative));
      sourceDigests[relative] = sha256(bytes);
      let value: JsonRecord;
      try {
        value = JSON.parse(bytes.toString('utf8')) as JsonRecord;
      } catch {
        throw new Error(`Current review rejected: module membership source is invalid JSON ${relative}`);
      }
      const declared = String(value.id ?? value.release_id ?? value.release_version ?? '');
      if (declared && declared !== componentId && declared !== tail && declared !== `ctr:${tail}`) continue;
      const ids: string[] = [];
      if (Array.isArray(value.entries)) {
        for (const row of value.entries) {
          if (String(row?.entity_role ?? row?.entityRole ?? '') === 'knowledge_object') {
            ids.push(String(row.entity ?? row.entityId ?? ''));
          }
        }
      }
      if (Array.isArray(value.included_entities)) ids.push(...value.included_entities.map(String));
      if (Array.isArray(value.canonical_nodes)) ids.push(...value.canonical_nodes.map((row) => String(row?.id ?? '')));
      addModuleMembership(matched, componentId, ids);
    }
  }
  const membership = new Map([...matched.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([id, modules]) => [
      id,
      [...modules].sort((a, b) => a.localeCompare(b, 'en')),
    ]));
  const membershipDigest = sha256(JSON.stringify([...membership.entries()]));
  return { membership, sourceDigests, membershipDigest };
}

function priorRefFromActive(active: JsonRecord, index: number, sourcePath: string, artifactDigest: string): CurrentPriorDecisionRef | null {
  if (!artifactDigest) return null;
  return {
    sourcePath,
    selector: `entries[${index}]`,
    artifactDigest,
    releaseId: active.releaseId == null ? null : String(active.releaseId),
    worklistDigest: null,
    authoringRevision: active.authoringRevision == null ? null : String(active.authoringRevision),
  };
}

function parseCourseEvidenceRef(raw: string): CurrentCourseCoverageEvidenceRef | null {
  const match = raw.match(/^worklist-evidence:([^|]+)\|([^#]+)#([^|]+)\|hash:([a-f0-9]{64})$/u);
  if (!match) return null;
  if (match[2] === 'canonical-profile') return null;
  const sourcePath = match[2]!;
  const classification = classifyCurrentCourseEvidenceSource(sourcePath);
  if (!classification) return null;
  return {
    evidenceId: match[1]!,
    sourcePath,
    selector: match[3]!,
    sourceDigest: match[4]!,
    ...classification,
  };
}

async function loadPriorEvidence(root: string): Promise<{
  refs: Map<string, readonly CurrentPriorDecisionRef[]>;
  evidence: Map<string, readonly CurrentCourseCoverageEvidenceRef[]>;
  sourceDigest: string;
  sourceDigests: Record<string, string>;
}> {
  const loaded = await readJson(root, ACTIVE_COVERAGE_PATH);
  const active = loaded.value;
  const refs = new Map<string, CurrentPriorDecisionRef[]>();
  const evidence = new Map<string, CurrentCourseCoverageEvidenceRef[]>();
  const sourceDigests: Record<string, string> = {};
  for (const [index, entry] of (Array.isArray(active.entries) ? active.entries : []).entries()) {
    const canonicalId = String(entry?.canonicalId ?? '').trim();
    if (!canonicalId) continue;
    const prior = priorRefFromActive(active, index, ACTIVE_COVERAGE_PATH, loaded.digest);
    if (prior) refs.set(canonicalId, [prior]);
    const independent = (Array.isArray(entry?.evidenceRefs) ? entry.evidenceRefs : [])
      .map(String)
      .map(parseCourseEvidenceRef)
      .filter((row): row is CurrentCourseCoverageEvidenceRef => row != null);
    for (const ref of independent) {
      if (ref.digestSemantics !== 'raw-bytes' || !ref.sourcePath.startsWith('course-content/')) continue;
      const sourceBytes = await readFile(path.join(root, ref.sourcePath));
      const sourceDigest = sha256(sourceBytes);
      if (sourceDigest !== ref.sourceDigest) {
        throw new Error(`Current review rejected: course evidence digest drift at ${ref.sourcePath}`);
      }
      const previousDigest = sourceDigests[ref.sourcePath];
      if (previousDigest && previousDigest !== sourceDigest) {
        throw new Error(`Current review rejected: course evidence source is internally inconsistent at ${ref.sourcePath}`);
      }
      sourceDigests[ref.sourcePath] = sourceDigest;
    }
    if (independent.length > 0) evidence.set(canonicalId, independent);
  }
  return { refs, evidence, sourceDigest: loaded.digest, sourceDigests };
}

interface LoadedInputs {
  binding: JsonRecord;
  admission: JsonRecord;
  deltas: any[];
  chain: JsonRecord;
  aggregateProjection: JsonRecord;
  aggregateRelease: JsonRecord;
  aggregateDiff: JsonRecord;
  predecessorProjection: JsonRecord;
  predecessorRelease: JsonRecord;
  prior: Awaited<ReturnType<typeof loadPriorEvidence>>;
  moduleMembership: Map<string, readonly string[]>;
  moduleSourceDigests: Record<string, string>;
  moduleMembershipDigest: string;
  authoringInputDigests: Record<string, string>;
  authoringInputDigest: string;
  digests: Record<string, string>;
  terminal: JsonRecord;
}

function authoringInputDigest(inputDigests: Record<string, string>): string {
  return sha256(JSON.stringify(Object.entries(inputDigests)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))));
}

function assertAuthoringInputsBoundToRevision(
  root: string,
  revision: string,
  inputDigests: Record<string, string>,
): string {
  for (const [relativePath, digest] of Object.entries(inputDigests)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))) {
    const revisionDigest = gitBlob(root, revision, relativePath);
    if (revisionDigest !== digest) {
      throw new Error(`Current review rejected: authoring input bytes are not bound to ${revision}: ${relativePath}`);
    }
  }
  return authoringInputDigest(inputDigests);
}

function identityValue(value: unknown): string | null {
  return value == null ? null : String(value);
}

function assertIdentity(actual: unknown, expected: unknown, field: string): void {
  if (identityValue(actual) !== identityValue(expected)) {
    throw new Error(`Current review rejected: Aggregate identity mismatch at ${field}`);
  }
}

function assertAggregateIdentity(input: {
  binding: JsonRecord;
  terminal: JsonRecord;
  aggregateProjection: JsonRecord;
  aggregateRelease: JsonRecord;
  aggregateDiff: JsonRecord;
  predecessorProjection: JsonRecord;
  predecessorRelease: JsonRecord;
}): void {
  const candidate = input.terminal.candidate;
  const base = input.terminal.base;
  if (!candidate || !base) throw new Error('Current review rejected: Aggregate identity lacks Delta endpoints');
  assertIdentity(input.binding.releaseHash, candidate.releaseHash, 'binding.releaseHash');
  assertIdentity(input.binding.bundleRevision, candidate.bundleRevision, 'binding.bundleRevision');
  assertIdentity(input.binding.sourceDatasetHash, candidate.sourceDatasetHash, 'binding.sourceDatasetHash');
  assertIdentity(input.aggregateRelease.id, candidate.releaseId, 'release.id');
  assertIdentity(input.aggregateRelease.release_version, candidate.releaseVersion, 'release.release_version');
  assertIdentity(input.aggregateRelease.release_hash, candidate.releaseHash, 'release.release_hash');
  assertIdentity(input.aggregateRelease.source_dataset_hash, candidate.sourceDatasetHash, 'release.source_dataset_hash');
  assertIdentity(input.aggregateProjection.id, candidate.runtimeProjectionId, 'projection.id');
  assertIdentity(input.aggregateProjection.version_digest, candidate.runtimeProjectionDigest, 'projection.version_digest');
  assertIdentity(input.aggregateProjection.source_release, candidate.releaseId, 'projection.source_release');
  assertIdentity(input.aggregateProjection.source_release_hash, candidate.releaseHash, 'projection.source_release_hash');
  assertIdentity(input.aggregateProjection.source_dataset_hash, candidate.sourceDatasetHash, 'projection.source_dataset_hash');
  assertIdentity(input.aggregateDiff.target_release?.release_id, candidate.releaseId, 'release-diff.target_release.release_id');
  assertIdentity(input.aggregateDiff.target_release?.release_version, candidate.releaseVersion, 'release-diff.target_release.release_version');
  assertIdentity(input.aggregateDiff.target_release?.release_hash, candidate.releaseHash, 'release-diff.target_release.release_hash');
  assertIdentity(input.aggregateDiff.base_release?.release_id, base.releaseId, 'release-diff.base_release.release_id');
  assertIdentity(input.aggregateDiff.base_release?.release_version, base.releaseVersion, 'release-diff.base_release.release_version');
  assertIdentity(input.aggregateDiff.base_release?.release_hash, base.releaseHash, 'release-diff.base_release.release_hash');
  assertIdentity(input.predecessorRelease.id, base.releaseId, 'predecessor-release.id');
  assertIdentity(input.predecessorRelease.release_version, base.releaseVersion, 'predecessor-release.release_version');
  assertIdentity(input.predecessorRelease.release_hash, base.releaseHash, 'predecessor-release.release_hash');
  assertIdentity(input.predecessorRelease.source_dataset_hash, base.sourceDatasetHash, 'predecessor-release.source_dataset_hash');
  assertIdentity(input.predecessorProjection.id, base.runtimeProjectionId, 'predecessor-projection.id');
  assertIdentity(input.predecessorProjection.version_digest, base.runtimeProjectionDigest, 'predecessor-projection.version_digest');
  assertIdentity(input.predecessorProjection.source_release, base.releaseId, 'predecessor-projection.source_release');
  assertIdentity(input.predecessorProjection.source_release_hash, base.releaseHash, 'predecessor-projection.source_release_hash');
  assertIdentity(input.predecessorProjection.source_dataset_hash, base.sourceDatasetHash, 'predecessor-projection.source_dataset_hash');
}

async function loadInputs(root: string, authoringRevision: string): Promise<LoadedInputs> {
  // The admission directory itself is the only fixed input. Aggregate paths
  // are derived from the immutable binding and terminal Delta identities.
  const [binding, admission, deltas, chain, prior] = await Promise.all([
    readJson(root, BINDING_PATH),
    readJson(root, ADMISSION_RECEIPT_PATH),
    readJsonArray(root, DELTA_RECEIPTS_PATH),
    readJson(root, CHAIN_RECEIPT_PATH),
    loadPriorEvidence(root),
  ]);
  if (binding.value.status !== 'PASS' || admission.value.status !== 'PASS') {
    throw new Error('Current review rejected: A binding/admission is not PASS');
  }
  if (!Array.isArray(admission.value.deltaReceipts)) {
    throw new Error('Current review rejected: admission Delta receipt list is missing');
  }
  assertCurrentDeltaReceiptIdentity(admission.value.deltaReceipts, deltas.value);
  for (const [index, delta] of deltas.value.entries()) {
    if (delta?.persisted?.authorizationState !== 'ACCEPTED' || delta?.computed?.authorizationState !== 'ACCEPTED') {
      throw new Error(`Current review rejected: Delta ${index + 1} is not ACCEPTED`);
    }
    for (const field of ['inputDigest', 'outputDigest', 'naturalKey', 'classification']) {
      if (delta.persisted[field] !== delta.computed[field]) throw new Error(`Current review rejected: Delta ${index + 1} ${field} drift`);
    }
    if (delta.persisted.upstreamCrosscheckStatus !== 'AGREED' || delta.persisted.selectorsUnchanged !== true) {
      throw new Error(`Current review rejected: Delta ${index + 1} upstream/selector gate failed`);
    }
  }
  const terminal = deltas.value[deltas.value.length - 1];
  if (!terminal?.persisted?.receiptId) throw new Error('Current review rejected: terminal Delta receipt is missing');
  if (terminal.candidate.bundleId !== binding.value.bundleId || terminal.candidate.bundleDigest !== binding.value.bundleDigest) {
    throw new Error('Current review rejected: terminal Delta is not the bound Aggregate candidate');
  }
  if (chain.value.resolutionDigest !== binding.value.resolutionDigest) {
    throw new Error('Current review rejected: chain resolutionDigest drift');
  }
  const releasePaths = deriveCurrentReviewReleasePaths({
    admissionRoot: ADMISSION_ROOT,
    binding: binding.value,
    terminal,
  });
  const [aggregateProjection, aggregateRelease, aggregateDiff,
    predecessorProjection, predecessorRelease] = await Promise.all([
    readJson(root, releasePaths.currentProjectionPath),
    readJson(root, releasePaths.currentReleasePath),
    readJson(root, releasePaths.currentDiffPath),
    readJson(root, releasePaths.predecessorProjectionPath),
    readJson(root, releasePaths.predecessorReleasePath),
  ]);
  assertAggregateIdentity({
    binding: binding.value,
    terminal,
    aggregateProjection: aggregateProjection.value,
    aggregateRelease: aggregateRelease.value,
    aggregateDiff: aggregateDiff.value,
    predecessorProjection: predecessorProjection.value,
    predecessorRelease: predecessorRelease.value,
  });
  const componentIds = (aggregateRelease.value.component_releases ?? []).map(String);
  const moduleMembership = await loadModuleMembership(root, componentIds);
  for (const refs of prior.refs.values()) {
    for (const ref of refs) {
      if (ref.artifactDigest !== prior.sourceDigest) {
        throw new Error('Current review rejected: prior decision reference is not bound to ACTIVE_COVERAGE_PATH bytes');
      }
    }
  }
  const authoringInputDigests: Record<string, string> = {
    [BINDING_PATH]: binding.digest,
    [ADMISSION_RECEIPT_PATH]: admission.digest,
    [DELTA_RECEIPTS_PATH]: deltas.digest,
    [CHAIN_RECEIPT_PATH]: chain.digest,
    [ACTIVE_COVERAGE_PATH]: prior.sourceDigest,
    [releasePaths.currentProjectionPath]: aggregateProjection.digest,
    [releasePaths.currentReleasePath]: aggregateRelease.digest,
    [releasePaths.currentDiffPath]: aggregateDiff.digest,
    [releasePaths.predecessorProjectionPath]: predecessorProjection.digest,
    [releasePaths.predecessorReleasePath]: predecessorRelease.digest,
    ...prior.sourceDigests,
    ...moduleMembership.sourceDigests,
  };
  const boundInputDigest = assertAuthoringInputsBoundToRevision(root, authoringRevision, authoringInputDigests);
  const digests: Record<string, string> = {
    binding: binding.digest,
    admission: admission.digest,
    deltas: deltas.digest,
    chain: chain.digest,
    aggregateProjection: aggregateProjection.digest,
    aggregateRelease: aggregateRelease.digest,
    aggregateDiff: aggregateDiff.digest,
    predecessorProjection: predecessorProjection.digest,
    predecessorRelease: predecessorRelease.digest,
    activeCoverage: prior.sourceDigest,
    moduleMembership: moduleMembership.membershipDigest,
    authoringRevision,
    authoringInputDigest: boundInputDigest,
  };
  for (const [relative, digest] of Object.entries(authoringInputDigests)) {
    digests[`authoringInput:${relative}`] = digest;
  }
  for (const [relative, digest] of Object.entries(moduleMembership.sourceDigests)) {
    digests[`moduleSource:${relative}`] = digest;
  }
  return {
    binding: binding.value,
    admission: admission.value,
    deltas: deltas.value,
    chain: chain.value,
    aggregateProjection: aggregateProjection.value,
    aggregateRelease: aggregateRelease.value,
    aggregateDiff: aggregateDiff.value,
    predecessorProjection: predecessorProjection.value,
    predecessorRelease: predecessorRelease.value,
    prior,
    moduleMembership: moduleMembership.membership,
    moduleSourceDigests: moduleMembership.sourceDigests,
    moduleMembershipDigest: moduleMembership.membershipDigest,
    authoringInputDigests,
    authoringInputDigest: boundInputDigest,
    digests,
    terminal,
  };
}

function inputFingerprint(input: LoadedInputs): string {
  return currentReviewInputFingerprint(input.digests);
}

function authorityFrom(input: LoadedInputs, authoringRevision: string): CurrentCourseCoverageAuthority {
  const binding = input.binding;
  const terminal = input.terminal;
  const predecessor = input.predecessorProjection;
  const predecessorRelease = input.predecessorRelease;
  const predecessorBundleId = String(binding.predecessorBundleId);
  const bundleRevision = Number(terminal.candidate.bundleRevision ?? binding.bundleRevision);
  return {
    releaseSetId: String(terminal.candidate.releaseSetId),
    releaseId: String(terminal.candidate.releaseId),
    releaseVersion: String(terminal.candidate.releaseVersion),
    releaseHash: String(terminal.candidate.releaseHash),
    sourceDatasetHash: terminal.candidate.sourceDatasetHash == null ? null : String(terminal.candidate.sourceDatasetHash),
    bundleId: String(terminal.candidate.bundleId),
    bundleRevision,
    bundleDigest: String(terminal.candidate.bundleDigest),
    projectionId: String(terminal.candidate.runtimeProjectionId),
    projectionDigest: String(terminal.candidate.runtimeProjectionDigest),
    bindingPath: BINDING_PATH,
    bindingDigest: input.digests.binding,
    resolutionDigest: String(binding.resolutionDigest),
    admissionReceiptPath: ADMISSION_RECEIPT_PATH,
    admissionReceiptDigest: input.digests.admission,
    chainReceiptPath: CHAIN_RECEIPT_PATH,
    chainReceiptDigest: input.digests.chain,
    captureRevision: String(input.admission.captureRevision),
    terminalDeltaReceiptId: String(terminal.persisted.receiptId),
    terminalDeltaInputDigest: String(terminal.persisted.inputDigest),
    terminalDeltaOutputDigest: String(terminal.persisted.outputDigest),
    terminalDeltaCaptureRevision: String(terminal.computed.captureRevision),
    terminalDeltaClassification: String(terminal.persisted.classification),
    terminalDeltaAcceptedAt: String(terminal.candidate.acceptedAt),
    predecessor: {
      releaseId: String(predecessorRelease.id ?? predecessor.source_release),
      releaseVersion: String(predecessorRelease.release_version ?? ''),
      bundleId: predecessorBundleId,
      projectionId: String(predecessor.id),
      projectionDigest: String(predecessor.version_digest),
      membershipCount: Array.isArray(predecessor.nodes) ? predecessor.nodes.length : 0,
    },
  };
}

function deltaObjectSignals(input: LoadedInputs): { addedIds: string[]; changedIds: string[] } {
  const diff = input.aggregateDiff.objects ?? {};
  return {
    addedIds: Array.isArray(diff.added) ? diff.added.map(String).sort((a: string, b: string) => a.localeCompare(b, 'en')) : [],
    changedIds: Array.isArray(diff.changed) ? diff.changed.map(String).sort((a: string, b: string) => a.localeCompare(b, 'en')) : [],
  };
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}

function statusPath(line: string): string {
  const value = line.slice(3).trim();
  const arrow = value.lastIndexOf(' -> ');
  return arrow >= 0 ? value.slice(arrow + 4) : value;
}

function isAllowedOutput(relative: string): boolean {
  return OUTPUT_FILES.some((file) => relative === path.posix.join(OUTPUT_ROOT, file));
}

function hasPathPrefix(relative: string, prefix: string): boolean {
  return relative === prefix || relative.startsWith(`${prefix}/`);
}

function digestLines(lines: readonly string[]): string {
  return sha256(JSON.stringify([...lines].sort((a, b) => a.localeCompare(b, 'en'))));
}

async function captureBoundarySnapshot(root: string, expectedCoverageDigest: string, captureRevision: string): Promise<{
  coverageDigest: string;
  outsideAllowedWriteSetDigest: string;
  forbiddenAuthorityStatusDigest: string;
  selectorSnapshotDigest: string;
  selectorWorkingTreeDigest: string;
}> {
  const coverageDigest = sha256(await readFile(path.join(root, ACTIVE_COVERAGE_PATH)));
  if (coverageDigest !== expectedCoverageDigest) {
    throw new Error('Current review rejected: ACTIVE_COVERAGE_PATH drifted during boundary capture');
  }
  git(root, ['diff', '--check']);
  const protectedStatus = git(root, [
    'status', '--porcelain=v1', '--untracked-files=all', '--', ...FORBIDDEN_AUTHORITY_PATHS,
  ]);
  assertCurrentReviewProtectedPathsClean(protectedStatus);
  const selectorRows = [];
  for (const relativePath of FORBIDDEN_AUTHORITY_PATHS.slice(0, 3)) {
    const workingTreeDigest = sha256(await readFile(path.join(root, relativePath)));
    const headDigest = gitBlob(root, captureRevision, relativePath);
    if (workingTreeDigest !== headDigest) {
      throw new Error(`Current review rejected: protected selector/writer bytes drift at ${relativePath}`);
    }
    selectorRows.push({ relativePath, workingTreeDigest, headDigest });
  }
  const status = git(root, ['status', '--porcelain=v1', '--untracked-files=all'])
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const outside = status.filter((line) => !isAllowedOutput(statusPath(line)));
  const forbidden = status.filter((line) => FORBIDDEN_AUTHORITY_PATHS.some((prefix) => hasPathPrefix(statusPath(line), prefix)));
  return {
    coverageDigest,
    outsideAllowedWriteSetDigest: digestLines(outside),
    forbiddenAuthorityStatusDigest: digestLines(forbidden),
    selectorSnapshotDigest: sha256(JSON.stringify(selectorRows)),
    selectorWorkingTreeDigest: sha256(JSON.stringify(selectorRows.map((row) => [row.relativePath, row.workingTreeDigest]))),
  };
}

function assertBoundaryStable(
  before: Awaited<ReturnType<typeof captureBoundarySnapshot>>,
  after: Awaited<ReturnType<typeof captureBoundarySnapshot>>,
): void {
  if (before.coverageDigest !== after.coverageDigest
    || before.outsideAllowedWriteSetDigest !== after.outsideAllowedWriteSetDigest
    || before.forbiddenAuthorityStatusDigest !== after.forbiddenAuthorityStatusDigest
    || before.selectorSnapshotDigest !== after.selectorSnapshotDigest
    || before.selectorWorkingTreeDigest !== after.selectorWorkingTreeDigest) {
    throw new Error('Current review rejected: production authority boundary drifted during publication');
  }
}

function makeBoundaryEvidence(
  snapshot: Awaited<ReturnType<typeof captureBoundarySnapshot>>,
  input: LoadedInputs,
  authoringRevision: string,
): CurrentReviewBoundaryEvidence {
  const allowedWriteSet = OUTPUT_FILES.map((file) => path.posix.join(OUTPUT_ROOT, file));
  const forbiddenAuthorityPaths = [...FORBIDDEN_AUTHORITY_PATHS];
  return {
    authoringRevision,
    authoringInputPaths: Object.keys(input.authoringInputDigests).sort((a, b) => a.localeCompare(b, 'en')),
    authoringInputDigest: input.authoringInputDigest,
    currentCoverageArtifactPath: ACTIVE_COVERAGE_PATH,
    currentCoverageArtifactDigest: snapshot.coverageDigest,
    allowedWriteSet,
    allowedWriteSetDigest: sha256(JSON.stringify(allowedWriteSet)),
    forbiddenAuthorityPaths,
    forbiddenAuthorityPathsDigest: sha256(JSON.stringify(forbiddenAuthorityPaths)),
    outsideAllowedWriteSetDigest: snapshot.outsideAllowedWriteSetDigest,
    forbiddenAuthorityStatusDigest: snapshot.forbiddenAuthorityStatusDigest,
    selectorSnapshotDigest: snapshot.selectorSnapshotDigest,
    selectorWorkingTreeDigest: snapshot.selectorWorkingTreeDigest,
    gitDiffCheck: 'PASS',
    verificationProtocol: 'pre-publication-snapshot-and-post-publication-reread',
  };
}

function buildGateSummary(input: {
  worklist: ReturnType<typeof buildCurrentCourseCoverageWorklist>;
  manifest: ReturnType<typeof buildCurrentReviewBatchManifest>;
  inputFingerprint: string;
  boundaryEvidence: CurrentReviewBoundaryEvidence;
}): Record<string, unknown> {
  return {
    schemaVersion: 'current-course-coverage-review-gate-summary/v1',
    protocol: 'current-course-coverage-review-gates/1',
    status: 'PASS',
    worklistInputDigest: input.worklist.worklistInputDigest,
    worklistDigest: input.worklist.worklistDigest,
    manifestDigest: input.manifest.manifestDigest,
    inputFingerprint: input.inputFingerprint,
    productionBoundaryEvidence: input.boundaryEvidence,
    counts: {
      N_current: input.worklist.membership.N_current,
      batchCount: input.manifest.batches.length,
      profileOnly: input.worklist.items.filter((item) => item.profileOnly).length,
      new: input.worklist.items.filter((item) => item.riskFlags.new).length,
      changed: input.worklist.items.filter((item) => item.riskFlags.changed).length,
      highRisk: input.worklist.items.filter((item) => item.riskFlags.highRisk).length,
    },
    gates: {
      ADMITTED_V2_BINDING_GATE: 'PASS',
      TERMINAL_DELTA_ACCEPTED_GATE: 'PASS',
      AGGREGATE_MEMBERSHIP_CLOSURE_GATE: 'PASS',
      CURRENT_WORKLIST_DETERMINISM_GATE: 'PASS',
      EVIDENCE_PROFILE_BOUNDARY_GATE: 'PASS',
      BATCH_DISJOINT_UNION_GATE: 'PASS',
      CHALLENGER_POLICY_GATE: 'PASS',
      PREPUBLICATION_DRIFT_GATE: 'PASS',
      CURRENT_COVERAGE_DECISION_WRITTEN: false,
      PRODUCTION_SELECTOR_CHANGED: false,
      GRAPH_RAG_SELECTOR_CHANGED: false,
      WRITER_FENCE_CHANGED: false,
    },
  };
}

function makeWorklist(input: LoadedInputs, authoringRevision: string) {
  const authority = authorityFrom(input, authoringRevision);
  const projectionNodes = Array.isArray(input.aggregateProjection.nodes)
    ? input.aggregateProjection.nodes
    : [];
  const releaseEntries = Array.isArray(input.aggregateRelease.entries)
    ? input.aggregateRelease.entries
    : [];
  const relations = Array.isArray(input.aggregateProjection.links)
    ? input.aggregateProjection.links
    : [];
  const predecessorNodes = Array.isArray(input.predecessorProjection.nodes)
    ? input.predecessorProjection.nodes
    : [];
  const predecessorRelations = Array.isArray(input.predecessorProjection.links)
    ? input.predecessorProjection.links
    : [];
  if (projectionNodes.length === 0 || releaseEntries.length === 0) {
    throw new Error('Current review rejected: staged Aggregate projection/release is empty');
  }
  return buildCurrentCourseCoverageWorklist({
    courseId: 'automatic-control',
    authority,
    authoringRevision,
    projectionNodes,
    releaseEntries,
    relations,
    predecessorProjectionNodes: predecessorNodes,
    predecessorRelations,
    moduleMembership: input.moduleMembership,
    priorDecisionRefs: input.prior.refs,
    independentEvidence: input.prior.evidence,
    deltaSignals: deltaObjectSignals(input),
  });
}

async function main(): Promise<void> {
  const root = process.cwd();
  const authoringRevision = argValue('--authoring-revision') ?? git(root, ['rev-parse', '--verify', 'HEAD']);
  if (!/^[a-f0-9]{40}$/u.test(authoringRevision)) throw new Error('--authoring-revision must be a 40-hex Git revision');
  const maxMembersPerBatch = Number(argValue('--max-members-per-batch') ?? 500);
  if (!Number.isInteger(maxMembersPerBatch) || maxMembersPerBatch < 1) throw new Error('--max-members-per-batch must be a positive integer');

  const before = await loadInputs(root, authoringRevision);
  const boundaryBefore = await captureBoundarySnapshot(root, before.digests.activeCoverage, authoringRevision);
  const worklist = makeWorklist(before, authoringRevision);
  const manifest = buildCurrentReviewBatchManifest(worklist, { maxMembersPerBatch });
  const after = await loadInputs(root, authoringRevision);
  const afterWorklist = makeWorklist(after, authoringRevision);
  assertNoCurrentReviewInputDrift({
    expected: {
      bindingResolutionDigest: String(before.binding.resolutionDigest),
      aggregateBundleDigest: String(before.binding.bundleDigest),
      terminalDeltaReceiptId: String(before.terminal.persisted.receiptId),
      terminalDeltaInputDigest: String(before.terminal.persisted.inputDigest),
      terminalDeltaOutputDigest: String(before.terminal.persisted.outputDigest),
      terminalDeltaCaptureRevision: String(before.terminal.computed.captureRevision),
      authoringRevision,
      captureRevision: String(before.admission.captureRevision),
      worklistInputDigest: worklist.worklistInputDigest,
    },
    observed: {
      bindingResolutionDigest: String(after.binding.resolutionDigest),
      aggregateBundleDigest: String(after.binding.bundleDigest),
      terminalDeltaReceiptId: String(after.terminal.persisted.receiptId),
      terminalDeltaInputDigest: String(after.terminal.persisted.inputDigest),
      terminalDeltaOutputDigest: String(after.terminal.persisted.outputDigest),
      terminalDeltaCaptureRevision: String(after.terminal.computed.captureRevision),
      authoringRevision,
      captureRevision: String(after.admission.captureRevision),
      worklistInputDigest: afterWorklist.worklistInputDigest,
    },
  });
  if (inputFingerprint(before) !== inputFingerprint(after)) {
    throw new Error('Current review rejected: Aggregate/Delta/authoring input drift before manifest publication');
  }
  if (afterWorklist.worklistInputDigest !== worklist.worklistInputDigest
    || afterWorklist.worklistDigest !== worklist.worklistDigest) {
    throw new Error('Current review rejected: regenerated worklist digest drift before manifest publication');
  }
  const boundaryEvidence = makeBoundaryEvidence(boundaryBefore, before, authoringRevision);
  // The receipt is an immutable, reproducible artifact.  A's terminal Delta
  // acceptance timestamp is the deterministic capture marker; wall-clock
  // generation time would make an identical regeneration differ bytewise.
  const generatedAt = String(before.terminal.candidate.acceptedAt);
  const receipt = buildCurrentReviewAssemblyReceipt({ worklist, manifest, generatedAt, boundaryEvidence });
  const gateSummary = buildGateSummary({
    worklist,
    manifest,
    inputFingerprint: inputFingerprint(before),
    boundaryEvidence,
  });
  const outputs = [
    { relativePath: 'worklist.json', value: worklist },
    { relativePath: 'batch-manifest.json', value: manifest },
    { relativePath: 'assembly-receipt.json', value: receipt },
    { relativePath: 'gate-summary.json', value: gateSummary },
  ];
  const publication = await publishImmutableJsonSet({ root, outputRoot: OUTPUT_ROOT, outputs });
  try {
    const boundaryAfter = await captureBoundarySnapshot(root, before.digests.activeCoverage, authoringRevision);
    assertBoundaryStable(boundaryBefore, boundaryAfter);
  } catch (error) {
    if (publication === 'published') {
      await rm(path.join(root, OUTPUT_ROOT), { recursive: true, force: true });
    }
    throw error;
  }
  console.log(JSON.stringify({
    status: 'PASS',
    publication,
    outputRoot: OUTPUT_ROOT,
    worklist: path.posix.join(OUTPUT_ROOT, 'worklist.json'),
    batchManifest: path.posix.join(OUTPUT_ROOT, 'batch-manifest.json'),
    assemblyReceipt: path.posix.join(OUTPUT_ROOT, 'assembly-receipt.json'),
    gateSummary: path.posix.join(OUTPUT_ROOT, 'gate-summary.json'),
    N_current: worklist.membership.N_current,
    batchCount: manifest.batches.length,
    worklistInputDigest: worklist.worklistInputDigest,
    worklistDigest: worklist.worklistDigest,
    manifestDigest: manifest.manifestDigest,
    authoringRevision,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { link, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  assertCurrentCourseCoverageProductionBoundaryBundle,
  buildCurrentCourseCoverageBatchReceipt,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2,
  sealCurrentCourseCoverageProductionBoundaryAttestation,
  type CurrentCourseCoverageBatchBinding,
  type CurrentCourseCoverageBatchReceipt,
  type CurrentCourseCoverageProtectedPathSnapshot,
  type CurrentCourseCoverageProductionBoundaryAttestation,
  type CurrentCourseCoverageProductionBoundaryProof,
  type CurrentCourseCoverageStageReview,
} from '../../src/lib/aggregate-governance/current-course-coverage-batch-review';
import { stableStringify } from '../../src/lib/aggregate-governance/hash';
import type {
  CurrentCourseCoverageWorklist,
  CurrentReviewBatchManifest,
} from '../../src/lib/aggregate-governance/current-course-coverage-review';

const ROOT = process.cwd();
const DEFAULT_INPUT_ROOT =
  'course-content/authoring/knowledge/issue-1180-current-course-coverage-review';
const FORBIDDEN_OUTPUT_PARTS = [
  '/course-coverage/active/',
  '/course-coverage/aggregate/active/',
  '/canonical-rag/',
  '/canonical-learning-fact-identity/',
];
const PROTECTED_PRODUCTION_AUTHORITY_PATHS = [
  'course-content/authoring/knowledge/course-coverage/active/automatic-control.json',
  'course-content/authoring/knowledge/course-coverage/aggregate/active/automatic-control.json',
  'src/lib/canonical-rag/authority.ts',
  'src/lib/canonical-learning-fact-identity/authority.ts',
  'src/lib/canonical-learning-fact-identity/capability.ts',
  'src/lib/canonical-learning-fact-identity/writer.ts',
] as const;
const ATTESTATION_FILE_NAME = 'batch-boundary-attestation.json';

export interface ProductionAuthoritySnapshot {
  head: string;
  status: string[];
  rows?: CurrentCourseCoverageProtectedPathSnapshot[];
  snapshotDigest: string;
}

interface PublishedReplaySnapshot {
  currentHead: string;
  status: string[];
  rows?: CurrentCourseCoverageProtectedPathSnapshot[];
  snapshotDigest: string;
  replayMode?: PublishedReplayMode;
}

type Publication = 'published' | 'identical';

export type PublishedReplayMode = 'descendant' | 'content-equivalent';

interface IndependentStageSourceMember {
  ordinal: number;
  canonicalId: string;
  canonicalRevision: string;
  stageConclusion: string;
  rationale: string;
  evidenceRefs: Array<string | { selector: string; evidenceId?: string }>;
}

interface IndependentStageSource {
  schemaVersion: string;
  stage: string;
  batchBinding: {
    batchId: string;
    manifestBatchIndex: number;
    sequence: number;
    group: string;
    memberCount: number;
    memberDigest: string;
    manifestDigest: string;
  };
  members: IndependentStageSourceMember[];
}

interface CliOptions {
  worklist: string;
  manifest: string;
  primary: string;
  challenger: string | null;
  third: string | null;
  output: string;
  expectedBinding: CurrentCourseCoverageBatchBinding;
}

function valueAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function required(args: string[], flag: string): string {
  const value = valueAfter(args, flag)?.trim();
  if (!value) throw new Error(`${flag} is required`);
  return value;
}

function integer(args: string[], flag: string): number {
  const parsed = Number(required(args, flag));
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer`);
  return parsed;
}

function options(args: string[]): CliOptions {
  return {
    worklist: valueAfter(args, '--worklist') ?? `${DEFAULT_INPUT_ROOT}/worklist.json`,
    manifest: valueAfter(args, '--manifest') ?? `${DEFAULT_INPUT_ROOT}/batch-manifest.json`,
    primary: required(args, '--primary'),
    challenger: valueAfter(args, '--challenger'),
    third: valueAfter(args, '--third'),
    output: required(args, '--output'),
    expectedBinding: {
      batchId: required(args, '--expected-batch-id'),
      manifestBatchIndex: integer(args, '--batch-index'),
      sequence: integer(args, '--sequence'),
      semanticGroupKey: required(args, '--semantic-group-key'),
      memberCount: integer(args, '--member-count'),
      memberDigest: required(args, '--member-digest'),
      worklistInputDigest: required(args, '--worklist-input-digest'),
      worklistDigest: required(args, '--worklist-digest'),
      manifestDigest: required(args, '--manifest-digest'),
      manifestArtifactSha256: required(args, '--manifest-artifact-sha256'),
    },
  };
}

function absolute(input: string): string {
  return path.resolve(ROOT, input);
}

function repoRelative(input: string): string {
  const relative = path.relative(ROOT, absolute(input)).replaceAll('\\', '/');
  if (!relative || relative === '..' || relative.startsWith('../')) {
    throw new Error('Current batch review rejected: artifact path must remain inside the repository');
  }
  return relative;
}

function attestationOutputFor(receiptOutput: string): string {
  return path.join(path.dirname(receiptOutput), ATTESTATION_FILE_NAME);
}

function git(args: string[], encoding: 'utf8' | 'buffer' = 'utf8'): string | Buffer {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Current batch review Git command failed: ${args.join(' ')}`);
  }
  return result.stdout ?? (encoding === 'buffer' ? Buffer.alloc(0) : '');
}

function statusLines(output: string): string[] {
  return output.split('\n').map((line) => line.trimEnd()).filter(Boolean);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function gitRevisionIsReadable(revision: string): boolean {
  if (!/^[a-f0-9]{40}$/u.test(revision)) return false;
  const result = spawnSync('git', ['cat-file', '-e', `${revision}^{commit}`], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function gitRevisionIsAncestor(ancestor: string, descendant: string): boolean {
  if (!/^[a-f0-9]{40}$/u.test(ancestor) || !/^[a-f0-9]{40}$/u.test(descendant)) {
    throw new Error('Current batch review rejected: replay Git revisions are invalid');
  }
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  return result.status === 0;
}

export function assertGitAncestor(ancestor: string, descendant: string): void {
  if (!gitRevisionIsAncestor(ancestor, descendant)) {
    throw new Error('Current batch review rejected: published receipt capture HEAD is not an ancestor of current HEAD');
  }
}

export function classifyPublishedReplayMode(input: {
  captureHeadIsAncestor: boolean;
  currentRows: readonly CurrentCourseCoverageProtectedPathSnapshot[];
  expectedRows: readonly CurrentCourseCoverageProtectedPathSnapshot[];
}): PublishedReplayMode {
  if (stableStringify(input.currentRows) !== stableStringify(input.expectedRows)) {
    throw new Error('Current batch review rejected: protected authority bytes drifted from published snapshot');
  }
  return input.captureHeadIsAncestor ? 'descendant' : 'content-equivalent';
}

async function capturePublishedReplaySnapshot(
  capturedHead: string,
  expectedRows?: readonly CurrentCourseCoverageProtectedPathSnapshot[],
): Promise<PublishedReplaySnapshot> {
  const currentHead = String(git(['rev-parse', '--verify', 'HEAD'])).trim();
  const hasExpectedRows = expectedRows !== undefined;
  if (!hasExpectedRows && !gitRevisionIsReadable(capturedHead)) {
    throw new Error('Current batch review rejected: published receipt capture HEAD is not readable');
  }
  const captureHeadIsAncestor = !hasExpectedRows
    && gitRevisionIsAncestor(capturedHead, currentHead);
  if (!hasExpectedRows && !captureHeadIsAncestor) {
    throw new Error('Current batch review rejected: published receipt capture HEAD is not an ancestor of current HEAD');
  }
  git(['diff', '--check', '--', ...PROTECTED_PRODUCTION_AUTHORITY_PATHS]);
  const status = statusLines(String(git([
    'status', '--porcelain=v1', '--untracked-files=all', '--', ...PROTECTED_PRODUCTION_AUTHORITY_PATHS,
  ])));
  if (status.length > 0) {
    throw new Error(`Current batch review rejected: protected authority paths are dirty during replay: ${status.join(', ')}`);
  }
  const rows = await Promise.all(PROTECTED_PRODUCTION_AUTHORITY_PATHS.map(async (relativePath) => {
    const workingTreeBytes = await readFile(absolute(relativePath));
    const workingTreeDigest = sha256(workingTreeBytes);
    const expected = expectedRows?.find((row) => row.relativePath === relativePath);
    const captureHeadDigest = expected
      ? expected.headDigest
      : sha256(git(['show', `${capturedHead}:${relativePath}`], 'buffer'));
    return {
      relativePath,
      workingTreeDigest,
      headDigest: captureHeadDigest,
    };
  }));
  const replayMode = hasExpectedRows
    ? 'content-equivalent' as const
    : classifyPublishedReplayMode({
      captureHeadIsAncestor,
      currentRows: rows,
      expectedRows: rows,
    });
  return {
    currentHead,
    status,
    rows,
    snapshotDigest: sha256(stableStringify({ head: capturedHead, rows })),
    replayMode,
  };
}

export function assertPublishedReplaySnapshot(
  receipt: CurrentCourseCoverageBatchReceipt,
  attestation: CurrentCourseCoverageProductionBoundaryAttestation,
  snapshot: PublishedReplaySnapshot,
): void {
  const proof = receipt.productionBoundaryProof;
  if (stableStringify(proof.protectedPaths) !== stableStringify([...PROTECTED_PRODUCTION_AUTHORITY_PATHS])) {
    throw new Error('Current batch review rejected: published protected authority path set drifted');
  }
  if (proof.verificationProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL) {
    if (!('protectedPathSnapshotsBefore' in attestation)
      || stableStringify(snapshot.rows) !== stableStringify(proof.protectedPathSnapshots)
      || stableStringify(snapshot.rows) !== stableStringify(attestation.protectedPathSnapshotsBefore)) {
      throw new Error('Current batch review rejected: published protected authority path bytes drifted');
    }
  }
  if (snapshot.status.length > 0 || snapshot.snapshotDigest !== attestation.authoritySnapshotBeforeDigest) {
    throw new Error('Current batch review rejected: protected authority snapshot drifted during replay');
  }
}

export async function captureProductionAuthoritySnapshot(): Promise<ProductionAuthoritySnapshot> {
  const head = String(git(['rev-parse', '--verify', 'HEAD'])).trim();
  if (!/^[a-f0-9]{40}$/u.test(head)) throw new Error('Current batch review rejected: Git HEAD is not a full revision');
  git(['diff', '--check', '--', ...PROTECTED_PRODUCTION_AUTHORITY_PATHS]);
  const status = statusLines(String(git([
    'status', '--porcelain=v1', '--untracked-files=all', '--', ...PROTECTED_PRODUCTION_AUTHORITY_PATHS,
  ])));
  if (status.length > 0) {
    throw new Error(`Current batch review rejected: production authority paths are dirty: ${status.join(', ')}`);
  }
  const rows = await Promise.all(PROTECTED_PRODUCTION_AUTHORITY_PATHS.map(async (relativePath) => {
    const workingTreeBytes = await readFile(absolute(relativePath));
    const headBytes = git(['show', `${head}:${relativePath}`], 'buffer');
    if (!Buffer.isBuffer(headBytes)) throw new Error(`Current batch review rejected: Git blob is not binary: ${relativePath}`);
    const workingTreeDigest = sha256(workingTreeBytes);
    const headDigest = sha256(headBytes);
    if (workingTreeDigest !== headDigest) {
      throw new Error(`Current batch review rejected: production authority bytes drift at ${relativePath}`);
    }
    return { relativePath, workingTreeDigest, headDigest };
  }));
  return {
    head,
    status,
    rows,
    snapshotDigest: sha256(stableStringify({ head, rows })),
  };
}

export function assertProductionAuthoritySnapshotStable(
  before: ProductionAuthoritySnapshot,
  after: ProductionAuthoritySnapshot,
): void {
  if (before.head !== after.head || before.snapshotDigest !== after.snapshotDigest
    || stableStringify(before.status) !== stableStringify(after.status)
    || stableStringify(before.rows ?? []) !== stableStringify(after.rows ?? [])) {
    throw new Error('Current batch review rejected: Git HEAD or production authority snapshot drifted during publication');
  }
}

function productionBoundaryProof(
  before: ProductionAuthoritySnapshot,
  receiptPath: string,
  attestationPath: string,
): CurrentCourseCoverageProductionBoundaryProof {
  return {
    verificationProtocol: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL,
    receiptPath,
    attestationPath,
    headBefore: before.head,
    protectedPaths: [...PROTECTED_PRODUCTION_AUTHORITY_PATHS],
    protectedPathSnapshots: [...(before.rows ?? [])],
    statusBefore: [...before.status],
    authoritySnapshotBeforeDigest: before.snapshotDigest,
    gitDiffCheck: 'PASS',
    mutationFlags: {
      currentCoverageDecisionWritten: false,
      productionSelectorChanged: false,
      graphRagSelectorChanged: false,
      writerFenceChanged: false,
    },
  };
}

async function json<T>(input: string): Promise<T> {
  return JSON.parse(await readFile(absolute(input), 'utf8')) as T;
}

function sourceEvidenceRef(value: unknown, index: number): { selector: string; evidenceId?: string } {
  if (typeof value === 'string') {
    const parts = value.split('|');
    if (parts.length === 4 && parts[2]) return { selector: parts[2] };
  } else if (value && typeof value === 'object'
    && 'selector' in value && typeof value.selector === 'string' && value.selector) {
    const evidenceId = 'evidenceId' in value
      ? (typeof value.evidenceId === 'string' && value.evidenceId ? value.evidenceId : null)
      : undefined;
    if (evidenceId !== null) return { selector: value.selector, evidenceId };
  }
  throw new Error(`Current batch review rejected: source evidenceRefs[${index}] is malformed`);
}

export function validateCurrentCourseCoverageStageSource(input: {
  document: CurrentCourseCoverageStageReview;
  sourceBytes: string | Buffer;
}): void {
  const binding = input.document.sourceArtifactBinding;
  if (!binding) {
    throw new Error(`Current batch review rejected: ${input.document.stage} source artifact binding is required`);
  }
  let source: IndependentStageSource;
  try {
    source = JSON.parse(input.sourceBytes.toString()) as IndependentStageSource;
  } catch {
    throw new Error('Current batch review rejected: source artifact is not valid JSON');
  }
  if (sha256(input.sourceBytes) !== binding.artifactSha256) {
    throw new Error(`Current batch review rejected: ${input.document.stage} source artifact SHA-256 mismatch`);
  }
  if (source.schemaVersion !== binding.schemaVersion || source.stage !== binding.stage
    || source.stage !== input.document.stage) {
    throw new Error(`Current batch review rejected: ${input.document.stage} source schema/stage binding mismatch`);
  }
  const sourceBinding = source.batchBinding;
  const documentBinding = input.document.batchBinding;
  if (sourceBinding.batchId !== documentBinding.batchId
    || sourceBinding.manifestBatchIndex !== documentBinding.manifestBatchIndex
    || sourceBinding.sequence !== documentBinding.sequence
    || sourceBinding.group !== documentBinding.semanticGroupKey
    || sourceBinding.memberCount !== documentBinding.memberCount
    || sourceBinding.memberDigest !== documentBinding.memberDigest
    || sourceBinding.manifestDigest !== documentBinding.manifestDigest) {
    throw new Error(`Current batch review rejected: ${input.document.stage} source batch binding drift`);
  }
  if (!Array.isArray(source.members) || source.members.length !== input.document.decisions.length) {
    throw new Error(`Current batch review rejected: ${input.document.stage} source member count/order drift`);
  }
  for (const [index, decision] of input.document.decisions.entries()) {
    const member = source.members[index];
    if (!member || member.ordinal !== index || member.canonicalId !== decision.canonicalId
      || member.canonicalRevision !== decision.canonicalRevision
      || member.stageConclusion !== decision.conclusion
      || member.rationale !== decision.rationale
      || !Array.isArray(member.evidenceRefs)) {
      throw new Error(`Current batch review rejected: ${input.document.stage} source semantic closure mismatch at member ${index}`);
    }
    const sourceRefs = member.evidenceRefs.map(sourceEvidenceRef);
    const selectors = sourceRefs.map((ref) => ref.selector);
    if (stableStringify(selectors) !== stableStringify(decision.evidenceSelectors)) {
      throw new Error(`Current batch review rejected: ${input.document.stage} source evidence closure mismatch at member ${index}`);
    }
    if (decision.evidenceIds !== undefined) {
      const evidenceIds = sourceRefs.map((ref) => ref.evidenceId);
      if (evidenceIds.some((evidenceId) => evidenceId === undefined)
        || stableStringify(evidenceIds) !== stableStringify(decision.evidenceIds)) {
        throw new Error(`Current batch review rejected: ${input.document.stage} source evidence identity closure mismatch at member ${index}`);
      }
    }
  }
}

async function validateStageSourceFile(
  document: CurrentCourseCoverageStageReview,
  allowLegacySourceArtifactBinding = false,
): Promise<void> {
  const binding = document.sourceArtifactBinding;
  if (!binding) {
    if (allowLegacySourceArtifactBinding) return;
    throw new Error(`Current batch review rejected: ${document.stage} source artifact binding is required`);
  }
  const artifactPath = absolute(binding.artifactPath);
  const normalizedArtifactPath = repoRelative(artifactPath);
  if (normalizedArtifactPath !== binding.artifactPath.replaceAll('\\', '/')) {
    throw new Error(`Current batch review rejected: ${document.stage} source artifact path must be repository-relative`);
  }
  const sourceBytes = await readFile(artifactPath);
  validateCurrentCourseCoverageStageSource({ document, sourceBytes });
}

export function validateStageProvenanceBinding(
  document: CurrentCourseCoverageStageReview,
  provenance: Record<string, unknown>,
): void {
  const record = provenance[document.stage.toLowerCase()] as Record<string, unknown> | undefined;
  if (!document.sourceArtifactBinding) {
    if (record?.sourceArtifactBinding !== undefined) {
      throw new Error(`Current batch review rejected: ${document.stage} provenance/source binding drift`);
    }
    return;
  }
  const sourceBinding = record?.sourceArtifactBinding;
  if (!sourceBinding || stableStringify(sourceBinding) !== stableStringify(document.sourceArtifactBinding)) {
    throw new Error(`Current batch review rejected: ${document.stage} provenance/source binding drift`);
  }
  if (record?.sourceArtifact !== path.basename(document.sourceArtifactBinding.artifactPath)
    || record?.sourceArtifactSha256 !== document.sourceArtifactBinding.artifactSha256
    || record?.normalizedDocumentDigest !== document.documentDigest) {
    throw new Error(`Current batch review rejected: ${document.stage} provenance/source identity drift`);
  }
}

async function exists(input: string): Promise<boolean> {
  try {
    await stat(input);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function assertSafeOutput(output: string): void {
  const normalized = output.replaceAll('\\', '/');
  if (!normalized.startsWith(`${ROOT.replaceAll('\\', '/')}/course-content/authoring/knowledge/`)) {
    throw new Error('Batch receipt output must remain under course-content/authoring/knowledge');
  }
  if (!normalized.includes('/issue-')) {
    throw new Error('Batch receipt output must remain under an issue review artifact directory');
  }
  if (FORBIDDEN_OUTPUT_PARTS.some((part) => normalized.includes(part))) {
    throw new Error('Batch receipt output targets a forbidden production authority path');
  }
  if (!normalized.endsWith('/batch-receipt.json')) {
    throw new Error('Batch receipt output must end with batch-receipt.json');
  }
}

function assertSafeAttestationOutput(output: string): void {
  const normalized = output.replaceAll('\\', '/');
  if (!normalized.startsWith(`${ROOT.replaceAll('\\', '/')}/course-content/authoring/knowledge/`)) {
    throw new Error('Boundary attestation output must remain under course-content/authoring/knowledge');
  }
  if (!normalized.includes('/issue-')) {
    throw new Error('Boundary attestation output must remain under an issue review artifact directory');
  }
  if (FORBIDDEN_OUTPUT_PARTS.some((part) => normalized.includes(part))) {
    throw new Error('Boundary attestation output targets a forbidden production authority path');
  }
  if (!normalized.endsWith(`/${ATTESTATION_FILE_NAME}`)) {
    throw new Error(`Boundary attestation output must end with ${ATTESTATION_FILE_NAME}`);
  }
}

async function publishImmutable(
  output: string,
  bytes: string,
  kind: 'receipt' | 'attestation' = 'receipt',
): Promise<Publication> {
  if (kind === 'receipt') assertSafeOutput(output);
  else assertSafeAttestationOutput(output);
  if (await exists(output)) {
    const current = await readFile(output, 'utf8');
    if (current !== bytes) throw new Error(`Existing ${kind} is immutable and differs`);
    return 'identical';
  }
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { encoding: 'utf8', flag: 'wx' });
  try {
    await link(temporary, output);
    return 'published';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const current = await readFile(output, 'utf8');
    if (current !== bytes) throw new Error(`Existing ${kind} is immutable and differs`);
    return 'identical';
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function cleanupPublishedArtifacts(input: {
  receiptOutput: string;
  attestationOutput: string;
  receiptPublication: Publication | undefined;
  attestationPublication: Publication | undefined;
  unlinkArtifact: (output: string) => Promise<void>;
}): Promise<void> {
  const failures: string[] = [];
  const cleanup = async (output: string, publication: Publication | undefined): Promise<void> => {
    if (publication !== 'published') return;
    try {
      await input.unlinkArtifact(output);
    } catch (error) {
      failures.push(`${output}: ${formatError(error)}`);
    }
  };
  await cleanup(input.attestationOutput, input.attestationPublication);
  await cleanup(input.receiptOutput, input.receiptPublication);
  if (failures.length > 0) {
    throw new Error(`Current batch review cleanup failed: ${failures.join('; ')}`);
  }
}

export interface PublishCurrentCourseCoverageBatchBundleInput {
  receiptOutput: string;
  attestationOutput: string;
  receiptPath: string;
  attestationPath: string;
  receipt: CurrentCourseCoverageBatchReceipt;
  receiptBytes: string;
  beforeSnapshot: ProductionAuthoritySnapshot;
  captureSnapshot: () => Promise<ProductionAuthoritySnapshot>;
  publishArtifact: (output: string, bytes: string, kind: 'receipt' | 'attestation') => Promise<Publication>;
  readArtifact: (output: string) => Promise<string>;
  existsArtifact: (output: string) => Promise<boolean>;
  unlinkArtifact: (output: string) => Promise<void>;
}

export async function publishCurrentCourseCoverageBatchBundle(
  input: PublishCurrentCourseCoverageBatchBundleInput,
): Promise<{
  receiptPublication: Publication;
  attestationPublication: Publication;
  attestation: CurrentCourseCoverageProductionBoundaryAttestation;
}> {
  const proof = input.receipt.productionBoundaryProof;
  if (proof.receiptPath !== input.receiptPath || proof.attestationPath !== input.attestationPath
    || proof.headBefore !== input.beforeSnapshot.head
    || proof.authoritySnapshotBeforeDigest !== input.beforeSnapshot.snapshotDigest) {
    throw new Error('Current batch review rejected: pre-publication proof does not match the captured snapshot');
  }
  if (proof.verificationProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL
    && stableStringify(proof.protectedPathSnapshots) !== stableStringify(input.beforeSnapshot.rows ?? [])) {
    throw new Error('Current batch review rejected: pre-publication protected path rows do not match the captured snapshot');
  }
  let receiptPublication: Publication | undefined;
  let attestationPublication: Publication | undefined;
  try {
    receiptPublication = await input.publishArtifact(input.receiptOutput, input.receiptBytes, 'receipt');
    if (receiptPublication === 'identical' && !(await input.existsArtifact(input.attestationOutput))) {
      throw new Error('Current batch review rejected: existing receipt is missing its detached boundary attestation');
    }
    const afterReceiptPublication = await input.captureSnapshot();
    assertProductionAuthoritySnapshotStable(input.beforeSnapshot, afterReceiptPublication);
    const attestation = proof.verificationProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL
      ? sealCurrentCourseCoverageProductionBoundaryAttestation({
        schemaVersion: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION,
        protocol: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL,
        receiptPath: input.receiptPath,
        attestationPath: input.attestationPath,
        receiptDigest: input.receipt.receiptDigest,
        batchId: input.receipt.batchBinding.batchId,
        headBefore: proof.headBefore,
        headAfter: afterReceiptPublication.head,
        protectedPaths: [...proof.protectedPaths],
        statusBefore: [...proof.statusBefore],
        statusAfter: [...afterReceiptPublication.status],
        authoritySnapshotBeforeDigest: proof.authoritySnapshotBeforeDigest,
        authoritySnapshotAfterDigest: afterReceiptPublication.snapshotDigest,
        protectedPathSnapshotsBefore: [...proof.protectedPathSnapshots],
        protectedPathSnapshotsAfter: [...(afterReceiptPublication.rows ?? [])],
        gitDiffCheck: 'PASS',
      })
      : sealCurrentCourseCoverageProductionBoundaryAttestation({
        schemaVersion: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1,
        protocol: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1,
        receiptPath: input.receiptPath,
        attestationPath: input.attestationPath,
        receiptDigest: input.receipt.receiptDigest,
        batchId: input.receipt.batchBinding.batchId,
        headBefore: proof.headBefore,
        headAfter: afterReceiptPublication.head,
        protectedPaths: [...proof.protectedPaths],
        statusBefore: [...proof.statusBefore],
        statusAfter: [...afterReceiptPublication.status],
        authoritySnapshotBeforeDigest: proof.authoritySnapshotBeforeDigest,
        authoritySnapshotAfterDigest: afterReceiptPublication.snapshotDigest,
        gitDiffCheck: 'PASS',
      });
    const attestationBytes = `${JSON.stringify(attestation, null, 2)}\n`;
    attestationPublication = await input.publishArtifact(
      input.attestationOutput,
      attestationBytes,
      'attestation',
    );
    const afterAttestationPublication = await input.captureSnapshot();
    assertProductionAuthoritySnapshotStable(afterReceiptPublication, afterAttestationPublication);
    if (attestation.headAfter !== afterAttestationPublication.head
      || attestation.authoritySnapshotAfterDigest !== afterAttestationPublication.snapshotDigest
      || stableStringify(attestation.statusAfter) !== stableStringify(afterAttestationPublication.status)) {
      throw new Error('Current batch review rejected: detached attestation post-publication snapshot drifted');
    }
    if (proof.verificationProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL
      && ('protectedPathSnapshotsAfter' in attestation)
      && stableStringify(attestation.protectedPathSnapshotsAfter)
        !== stableStringify(afterAttestationPublication.rows ?? [])) {
      throw new Error('Current batch review rejected: detached attestation protected path rows drifted');
    }
    const persistedReceipt = JSON.parse(await input.readArtifact(input.receiptOutput)) as CurrentCourseCoverageBatchReceipt;
    const persistedAttestation = JSON.parse(await input.readArtifact(input.attestationOutput)) as CurrentCourseCoverageProductionBoundaryAttestation;
    if (stableStringify(persistedReceipt) !== stableStringify(input.receipt)) {
      throw new Error('Current batch review rejected: persisted receipt differs from assembled receipt');
    }
    assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: persistedReceipt,
      attestation: persistedAttestation,
      receiptPath: input.receiptPath,
      attestationPath: input.attestationPath,
    });
    if (persistedAttestation.headAfter !== afterAttestationPublication.head
      || persistedAttestation.authoritySnapshotAfterDigest !== afterAttestationPublication.snapshotDigest) {
      throw new Error('Current batch review rejected: persisted attestation is not bound to the live post-publication snapshot');
    }
    return { receiptPublication, attestationPublication, attestation: persistedAttestation };
  } catch (error) {
    try {
      await cleanupPublishedArtifacts({
        receiptOutput: input.receiptOutput,
        attestationOutput: input.attestationOutput,
        receiptPublication,
        attestationPublication,
        unlinkArtifact: input.unlinkArtifact,
      });
    } catch (cleanupError) {
      throw new Error(`${formatError(error)}; ${formatError(cleanupError)}`);
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const input = options(process.argv.slice(2));
  const receiptOutput = absolute(input.output);
  assertSafeOutput(receiptOutput);
  const attestationOutput = attestationOutputFor(receiptOutput);
  assertSafeAttestationOutput(attestationOutput);
  const receiptPath = repoRelative(receiptOutput);
  const attestationPath = repoRelative(attestationOutput);
  const manifestBytes = await readFile(absolute(input.manifest));
  const worklist = await json<CurrentCourseCoverageWorklist>(input.worklist);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as CurrentReviewBatchManifest;
  const primary = await json<CurrentCourseCoverageStageReview>(input.primary);
  const challenger = input.challenger
    ? await json<CurrentCourseCoverageStageReview>(input.challenger)
    : null;
  const third = input.third ? await json<CurrentCourseCoverageStageReview>(input.third) : null;
  const provenancePath = path.join(path.dirname(absolute(input.primary)), 'review-provenance.json');
  const provenance = await exists(provenancePath)
    ? await json<Record<string, unknown>>(provenancePath)
    : null;
  const receiptExists = await exists(receiptOutput);
  const attestationExists = await exists(attestationOutput);
  if (receiptExists !== attestationExists) {
    throw new Error('Current batch review rejected: published receipt/attestation pair is incomplete');
  }
  let persistedReceipt: CurrentCourseCoverageBatchReceipt | null = null;
  let persistedAttestation: CurrentCourseCoverageProductionBoundaryAttestation | null = null;
  let allowLegacySourceArtifactBinding = false;
  if (receiptExists && attestationExists) {
    persistedReceipt = JSON.parse(await readFile(receiptOutput, 'utf8')) as CurrentCourseCoverageBatchReceipt;
    persistedAttestation = JSON.parse(await readFile(attestationOutput, 'utf8')) as CurrentCourseCoverageProductionBoundaryAttestation;
    assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: persistedReceipt,
      attestation: persistedAttestation,
      receiptPath,
      attestationPath,
    });
    allowLegacySourceArtifactBinding = persistedReceipt.productionBoundaryProof.verificationProtocol
      === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2
      && persistedAttestation.schemaVersion === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1
      && persistedAttestation.protocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1;
  }
  await validateStageSourceFile(primary, allowLegacySourceArtifactBinding);
  if (provenance) validateStageProvenanceBinding(primary, provenance);
  if (challenger) {
    await validateStageSourceFile(challenger, allowLegacySourceArtifactBinding);
    if (provenance) validateStageProvenanceBinding(challenger, provenance);
  }
  if (third) {
    await validateStageSourceFile(third, allowLegacySourceArtifactBinding);
    if (provenance) validateStageProvenanceBinding(third, provenance);
  }

  const buildReceipt = (
    productionBoundaryProof: CurrentCourseCoverageProductionBoundaryProof,
    allowLegacy = false,
  ): CurrentCourseCoverageBatchReceipt =>
    buildCurrentCourseCoverageBatchReceipt({
      worklist,
      manifest,
      expectedBinding: input.expectedBinding,
      observedManifestArtifactSha256: createHash('sha256').update(manifestBytes).digest('hex'),
      primary,
      challenger,
      third,
      productionBoundaryProof,
      allowLegacySourceArtifactBinding: allowLegacy,
    });

  if (receiptExists && attestationExists) {
    const replayReceipt = persistedReceipt!;
    const replayAttestation = persistedAttestation!;
    const rebuiltReceipt = buildReceipt(replayReceipt.productionBoundaryProof, allowLegacySourceArtifactBinding);
    if (stableStringify(rebuiltReceipt) !== stableStringify(replayReceipt)) {
      throw new Error('Current batch review rejected: published receipt source/stage closure differs from current inputs');
    }
    const expectedRows = replayReceipt.productionBoundaryProof.verificationProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL
      ? replayReceipt.productionBoundaryProof.protectedPathSnapshots
      : undefined;
    const replaySnapshot = await capturePublishedReplaySnapshot(replayAttestation.headBefore, expectedRows);
    assertPublishedReplaySnapshot(replayReceipt, replayAttestation, replaySnapshot);
    process.stdout.write(`${stableStringify({
      status: replayReceipt.status,
      batchId: replayReceipt.batchBinding.batchId,
      receiptDigest: replayReceipt.receiptDigest,
      output: input.output,
      publication: 'identical' as const,
      attestation: attestationPath,
      attestationDigest: replayAttestation.attestationDigest,
      attestationPublication: 'identical' as const,
      replayMode: replaySnapshot.replayMode,
    })}\n`);
    return;
  }

  const boundaryBefore = await captureProductionAuthoritySnapshot();
  const receipt = buildReceipt(productionBoundaryProof(boundaryBefore, receiptPath, attestationPath));
  const bytes = `${JSON.stringify(receipt, null, 2)}\n`;
  const bundle = await publishCurrentCourseCoverageBatchBundle({
    receiptOutput,
    attestationOutput,
    receiptPath,
    attestationPath,
    receipt,
    receiptBytes: bytes,
    beforeSnapshot: boundaryBefore,
    captureSnapshot: captureProductionAuthoritySnapshot,
    publishArtifact: publishImmutable,
    readArtifact: (output) => readFile(output, 'utf8'),
    existsArtifact: exists,
    unlinkArtifact: (output) => unlink(output),
  });
  process.stdout.write(`${stableStringify({
    status: receipt.status,
    batchId: receipt.batchBinding.batchId,
    receiptDigest: receipt.receiptDigest,
    output: input.output,
    publication: bundle.receiptPublication,
    attestation: attestationPath,
    attestationDigest: bundle.attestation.attestationDigest,
    attestationPublication: bundle.attestationPublication,
  })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

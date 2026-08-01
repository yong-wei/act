import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { link, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  assertCurrentCourseCoverageProductionBoundaryBundle,
  buildCurrentCourseCoverageBatchReceipt,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL,
  sealCurrentCourseCoverageProductionBoundaryAttestation,
  type CurrentCourseCoverageBatchBinding,
  type CurrentCourseCoverageBatchReceipt,
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
  snapshotDigest: string;
}

type Publication = 'published' | 'identical';

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
    snapshotDigest: sha256(stableStringify({ head, rows })),
  };
}

export function assertProductionAuthoritySnapshotStable(
  before: ProductionAuthoritySnapshot,
  after: ProductionAuthoritySnapshot,
): void {
  if (before.head !== after.head || before.snapshotDigest !== after.snapshotDigest
    || stableStringify(before.status) !== stableStringify(after.status)) {
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
  let receiptPublication: Publication | undefined;
  let attestationPublication: Publication | undefined;
  try {
    receiptPublication = await input.publishArtifact(input.receiptOutput, input.receiptBytes, 'receipt');
    if (receiptPublication === 'identical' && !(await input.existsArtifact(input.attestationOutput))) {
      throw new Error('Current batch review rejected: existing receipt is missing its detached boundary attestation');
    }
    const afterReceiptPublication = await input.captureSnapshot();
    assertProductionAuthoritySnapshotStable(input.beforeSnapshot, afterReceiptPublication);
    const attestation = sealCurrentCourseCoverageProductionBoundaryAttestation({
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
  const boundaryBefore = await captureProductionAuthoritySnapshot();
  const manifestBytes = await readFile(absolute(input.manifest));
  const worklist = await json<CurrentCourseCoverageWorklist>(input.worklist);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as CurrentReviewBatchManifest;
  const primary = await json<CurrentCourseCoverageStageReview>(input.primary);
  const challenger = input.challenger
    ? await json<CurrentCourseCoverageStageReview>(input.challenger)
    : null;
  const third = input.third ? await json<CurrentCourseCoverageStageReview>(input.third) : null;
  const receipt = buildCurrentCourseCoverageBatchReceipt({
    worklist,
    manifest,
    expectedBinding: input.expectedBinding,
    observedManifestArtifactSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    primary,
    challenger,
    third,
    productionBoundaryProof: productionBoundaryProof(boundaryBefore, receiptPath, attestationPath),
  });
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

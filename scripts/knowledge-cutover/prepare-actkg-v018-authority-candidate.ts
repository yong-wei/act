#!/usr/bin/env tsx

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

import {
  AuthoritativeKnowledgeRepository,
  resolveAuthorityStorePaths,
  stageAuthorityAfterValidatedBundleImport,
  type AuthoritativeKnowledgeDatabase,
  type StagedAuthoritySnapshotFiles,
} from '../../src/lib/authoritative-knowledge';
import { canonicalJson, sha256 } from '../actkg-release/authoritative-release';
import {
  mirrorPinnedV018Release,
  V018_ACT_CONTROLLED_PATH,
  type ActkgV018MirrorReceipt,
} from '../actkg-release/actkg-v018-release-mirror';
import {
  computeV018ImpactReport,
  serializeV018ImpactReport,
  type V018ImpactReport,
} from '../actkg-release/actkg-v018-impact';
import {
  importValidatedActKGBundleV2,
  v2ReleaseSetIdentity,
  type PublicBundleV2ImportCounts,
} from '../actkg-release/public-bundle-v2-import';
import { loadAndValidatePublicBundleV2 } from '../actkg-release/public-bundle-v2';
import type { ValidatedActKGBundleV2 } from '../actkg-release/public-bundle-types';
import {
  assertGitDirectoryMatchesWorkingTree,
  PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
  resolveTrustedCaptureRevision,
} from '../actkg-release/capture-revision';
import {
  assertLocalDatabaseUrl,
  fingerprintPublicSchema,
  schemaExists,
  type PublicSchemaFingerprint,
} from './prepare-actkg-cutover-authority-candidate';
import {
  createIsolatedAdmissionDatabase,
  type IsolatedAdmissionDatabase,
} from './admit-latest-actkg-aggregate';

export const V018_CANDIDATE_RECEIPT_PROTOCOL =
  'actkg-v018-authority-candidate/1' as const;

export const V018_MIRROR_RECEIPT_PATH =
  `${V018_ACT_CONTROLLED_PATH}.mirror-receipt.json` as const;

const COMMIT = /^[a-f0-9]{40}$/u;
const FIXED_STAGED_AT = '1970-01-01T00:00:00.000Z';
const POINTER_PATHS = [
  'course-content/authoring/knowledge/authority/current.json',
  'course-content/runtime/knowledge/projection/current.json',
  'course-content/runtime/knowledge/prerequisites/current.json',
  'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'course-content/runtime/knowledge/consumer-activation/current.json',
  'course-content/runtime/knowledge/production-cutover-transactions/current.json',
] as const;
export const V018_CANDIDATE_CAPTURE_PATHS = [
  'package.json',
  'package-lock.json',
  ...PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
  'prisma.config.ts',
  'prisma/schema.prisma',
  // Prisma migrate deploy reads the complete directory, not only the new
  // candidate migration. The helper and its database/config seams are part of
  // the same execution closure.
  'prisma/migrations',
  'src/lib/prisma-client.ts',
  'scripts/knowledge-cutover/admit-latest-actkg-aggregate.ts',
  'scripts/knowledge-cutover/prepare-actkg-cutover-authority-candidate.ts',
  'scripts/actkg-release/actkg-v018-release-mirror.ts',
  'scripts/actkg-release/actkg-v018-impact.ts',
  'scripts/actkg-release/public-bundle-v2-import.ts',
  'scripts/actkg-release/release-set-delta-compute.ts',
  'scripts/actkg-release/release-set-delta-types.ts',
  'scripts/knowledge-cutover/prepare-actkg-v018-authority-candidate.ts',
  'src/lib/authoritative-knowledge/contracts.ts',
  'src/lib/authoritative-knowledge/index.ts',
  'src/lib/authoritative-knowledge/repository.ts',
  'src/lib/authoritative-knowledge/authority-snapshot.ts',
  'src/lib/authoritative-knowledge/authority-store.ts',
  'src/lib/authoritative-knowledge/engineering-authority-consumers.ts',
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.9',
  // The loader reads the complete controlled Bundle tree; the root is a
  // source input, not a derived candidate output.
  V018_ACT_CONTROLLED_PATH,
  V018_MIRROR_RECEIPT_PATH,
] as const;

export const V018_CANDIDATE_MIGRATIONS_PATH = 'prisma/migrations' as const;

/**
 * The candidate evidence runner has a deliberately local capture contract.
 * The generic Bundle capture helper still requires an exact HEAD; this
 * contract is the only place where an ancestor source commit is admitted, and
 * only when the descendant contains derived output paths.
 */
export const V018_CANDIDATE_SOURCE_CONTRACT_VERSION =
  'actkg-v018-authority-candidate/source/1' as const;
export const V018_CANDIDATE_EVIDENCE_CONTRACT =
  'actkg-v018-authority-candidate/evidence-capture/2' as const;

const GIT_FILE_MODES = new Set(['100644', '100755']);

export interface V018CandidateSourceEntry {
  path: string;
  mode: string;
  objectType: string;
  gitObject: string;
  byteLength: number;
  sha256: string;
}

type CandidateGitEntry = V018CandidateSourceEntry;

export interface V018CandidateOutputSummary {
  path: string;
  mode: '100644' | '100755';
  byteLength: number;
  sha256: string;
  digestScope: 'bytes' | 'receipt-body-without-outputs';
}

export interface V018CandidateEvidenceCaptureContract {
  contract: typeof V018_CANDIDATE_EVIDENCE_CONTRACT;
  sourceContractVersion: typeof V018_CANDIDATE_SOURCE_CONTRACT_VERSION;
  captureRevision: string;
  generationRevision: string;
  sourcePaths: string[];
  derivedPaths: string[];
  sourceManifestDigest: string;
  sourceEntries: CandidateGitEntry[];
  outputs: V018CandidateOutputSummary[];
}

interface PointerState {
  relativePath: string;
  exists: boolean;
  byteLength: number | null;
  sha256: string | null;
  bytes: Buffer | null;
}

interface SerializablePointerState {
  relativePath: string;
  exists: boolean;
  byteLength: number | null;
  sha256: string | null;
}

interface MaterializationResult {
  schemaName: string;
  firstImport: PublicBundleV2ImportCounts;
  secondImport: PublicBundleV2ImportCounts;
  staged: StagedAuthoritySnapshotFiles;
  outputRoot: string;
}

export interface V018AuthorityCandidateReceipt {
  protocol: typeof V018_CANDIDATE_RECEIPT_PROTOCOL;
  status: 'staged';
  mode: 'local-disposable-non-activation';
  deterministic: true;
  nonActivation: true;
  captureRevision: string;
  generationRevision: string;
  sourceContractVersion: typeof V018_CANDIDATE_SOURCE_CONTRACT_VERSION;
  sourceManifestDigest: string;
  sourceEntries: V018CandidateSourceEntry[];
  derivedPaths: string[];
  outputs: V018CandidateOutputSummary[];
  stagedAt: string;
  mirror: ActkgV018MirrorReceipt;
  validated: {
    protocol: ValidatedActKGBundleV2['protocol'];
    releaseSetId: string;
    releaseId: string;
    bundleId: string;
    bundleRevision: number;
    bundleDigest: string;
    releaseEntries: number;
    releaseNodes: number;
    runtimeProjectionNodes: number;
    runtimeProjectionLinks: number;
    profiles: number;
    multilingualLabels: number;
    components: number;
    rawArtifacts: number;
    linkMetadataRows: number;
  };
  replays: Array<{
    name: 'replay-1' | 'replay-2';
    schemaName: string;
    import: PublicBundleV2ImportCounts;
    idempotentImport: PublicBundleV2ImportCounts;
    snapshotId: string;
    snapshotHash: string;
    manifestPath: string;
    engineeringPath: string;
    stageReceiptPath: string;
  }>;
  impact: {
    path: string;
    digest: string;
    directDenominator: 'complete-v0.9-snapshot';
    upstreamDiffStatus: V018ImpactReport['upstreamCrosscheck']['status'];
  };
  publicSchema: {
    before: PublicSchemaFingerprint;
    after: PublicSchemaFingerprint;
    unchanged: true;
  };
  pointers: {
    before: SerializablePointerState[];
    after: SerializablePointerState[];
    unchanged: true;
  };
  replayByteEquivalent: true;
  impactByteEquivalent: true;
}

function fail(message: string): never {
  throw new Error(`ActKG v0.18 Authority candidate rejected: ${message}`);
}

function requiredOption(argv: readonly string[], name: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) fail(`missing ${name}`);
  return value;
}

function optionalOption(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (value?.startsWith('--')) fail(`missing ${name}`);
  return value;
}

function relativePath(repoRoot: string, target: string): string {
  const value = path.relative(repoRoot, path.resolve(target));
  return value === '' ? '.' : value;
}

function gitBlobSha1(bytes: Buffer): string {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.byteLength}\u0000`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function normalizeContractPath(value: string, label: string): string {
  const normalized = value.trim().replaceAll('\\', '/');
  if (
    normalized.length === 0
    || path.posix.isAbsolute(normalized)
    || normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('\u0000')
    || path.posix.normalize(normalized) !== normalized
  ) {
    fail(`${label} must be a normalized repository-relative path`);
  }
  return normalized;
}

function contractGitText(repoRoot: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    fail(`candidate capture Git command failed: git ${args.join(' ')}`);
  }
}

function contractGitEntries(
  repoRoot: string,
  revision: string,
  roots: readonly string[],
  allowEmpty = false,
): Map<string, CandidateGitEntry> {
  const entries = new Map<string, CandidateGitEntry>();
  for (const root of roots) {
    const output = contractGitText(repoRoot, [
      'ls-tree', '-r', '-l', '-z', '--full-tree', revision, '--', root,
    ]);
    for (const record of output.split('\u0000').filter(Boolean)) {
      const separator = record.indexOf('\t');
      if (separator < 0) fail(`candidate capture Git tree entry is malformed for ${root}`);
      const [mode, objectType, gitObject] = record.slice(0, separator).split(' ');
      const relativePath = record.slice(separator + 1).replaceAll('\\', '/');
      if (!mode || !objectType || !gitObject || !relativePath) {
        fail(`candidate capture Git tree entry is incomplete for ${relativePath || root}`);
      }
      if (relativePath !== root && !relativePath.startsWith(`${root}/`)) {
        fail(`candidate capture Git tree path escaped declared root: ${relativePath}`);
      }
      if (objectType !== 'blob' || !GIT_FILE_MODES.has(mode)) {
        fail(`candidate source contains unsupported Git object or mode: ${relativePath}`);
      }
      const bytes = (() => {
        try {
          return execFileSync('git', ['show', `${revision}:${relativePath}`], {
            cwd: repoRoot,
            maxBuffer: 128 * 1024 * 1024,
          });
        } catch {
          fail(`candidate capture Git blob could not be read: ${relativePath}`);
        }
      })();
      const candidate: CandidateGitEntry = {
        path: relativePath,
        mode,
        objectType,
        gitObject,
        byteLength: bytes.byteLength,
        sha256: sha256(bytes),
      };
      const previous = entries.get(relativePath);
      if (previous && canonicalJson(previous) !== canonicalJson(candidate)) {
        fail(`candidate source path was declared more than once with different Git entries: ${relativePath}`);
      }
      entries.set(relativePath, candidate);
    }
  }
  if (entries.size === 0 && !allowEmpty) fail('candidate source roots resolved to no Git files');
  return entries;
}

interface WorkingCandidateEntry {
  path: string;
  mode: '100644' | '100755';
  objectType: 'blob';
  gitObject: string;
  byteLength: number;
  sha256: string;
}

async function workingCandidateEntries(
  repoRoot: string,
  roots: readonly string[],
): Promise<Map<string, WorkingCandidateEntry>> {
  const entries = new Map<string, WorkingCandidateEntry>();
  const visit = async (absolutePath: string, relative: string): Promise<void> => {
    const fileStat = await lstat(absolutePath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        fail(`candidate source path is missing from the working tree: ${relative}`);
      }
      throw error;
    });
    if (fileStat.isDirectory()) {
      for (const child of await readdir(absolutePath)) {
        await visit(path.join(absolutePath, child), path.posix.join(relative, child));
      }
      return;
    }
    if (!fileStat.isFile()) {
      fail(`candidate source contains a symlink or unsupported file type: ${relative}`);
    }
    const mode = (fileStat.mode & 0o111) !== 0 ? '100755' : '100644';
    const bytes = await readFile(absolutePath);
    entries.set(relative, {
      path: relative,
      mode,
      objectType: 'blob',
      gitObject: gitBlobSha1(bytes),
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
    });
  };

  for (const root of roots) {
    await visit(path.join(repoRoot, root), root);
  }
  return entries;
}

function assertEntryMapsEqual(
  expected: ReadonlyMap<string, CandidateGitEntry>,
  actual: ReadonlyMap<string, CandidateGitEntry | WorkingCandidateEntry>,
  label: string,
): void {
  if (expected.size !== actual.size) {
    fail(`${label} path set drift (expected ${expected.size}, got ${actual.size})`);
  }
  for (const [relativePath, expectedEntry] of expected) {
    const actualEntry = actual.get(relativePath);
    if (!actualEntry) fail(`${label} is missing path: ${relativePath}`);
    if (
      actualEntry.mode !== expectedEntry.mode
      || actualEntry.objectType !== expectedEntry.objectType
      || actualEntry.gitObject !== expectedEntry.gitObject
      || actualEntry.byteLength !== expectedEntry.byteLength
      || actualEntry.sha256 !== expectedEntry.sha256
    ) {
      fail(`${label} drift at ${relativePath}`);
    }
  }
  for (const relativePath of actual.keys()) {
    if (!expected.has(relativePath)) fail(`${label} contains undeclared path: ${relativePath}`);
  }
}

function pathWithin(pathValue: string, root: string): boolean {
  return pathValue === root || pathValue.startsWith(`${root}/`);
}

function pathsOverlap(left: string, right: string): boolean {
  return pathWithin(left, right) || pathWithin(right, left);
}

function assertSourceDerivedDisjoint(sourceRoots: readonly string[], derivedRoots: readonly string[]): void {
  for (const source of sourceRoots) {
    for (const derived of derivedRoots) {
      if (pathsOverlap(source, derived)) {
        fail(`candidate source/derived path overlap: ${source} <-> ${derived}`);
      }
    }
  }
}

function gitRevision(repoRoot: string, revision: string, label: string): string {
  if (!COMMIT.test(revision)) fail(`${label} must be a 40-character Git SHA`);
  const resolved = contractGitText(repoRoot, ['rev-parse', '--verify', `${revision}^{commit}`]).trim();
  if (resolved !== revision) fail(`${label} does not resolve to the requested Git commit`);
  return resolved;
}

function assertAncestorAndDerivedDiff(
  repoRoot: string,
  captureRevision: string,
  generationRevision: string,
  derivedRoots: readonly string[],
): void {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', captureRevision, generationRevision], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
  } catch {
    fail('captureRevision is not an ancestor of generationRevision');
  }
  const output = contractGitText(repoRoot, [
    'diff-tree', '--no-commit-id', '--root', '-r', '--name-only', '-z', '--no-renames',
    captureRevision,
    generationRevision,
  ]);
  for (const changedPath of output.split('\u0000').filter(Boolean).map((value) => value.replaceAll('\\', '/'))) {
    if (!derivedRoots.some((root) => pathWithin(changedPath, root))) {
      fail(`capture-to-generation diff contains non-derived path: ${changedPath}`);
    }
  }
}

function assertWorkingTreeChangesBounded(repoRoot: string, derivedRoots: readonly string[]): void {
  const output = contractGitText(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all', '-z']);
  const records = output.split('\u0000').filter(Boolean);
  for (const record of records) {
    const relativePath = record.slice(3).replaceAll('\\', '/');
    if (!relativePath || !derivedRoots.some((root) => pathWithin(relativePath, root))) {
      fail(`working-tree drift is outside derived output paths: ${relativePath || record}`);
    }
  }
}

async function candidateOutputSummaries(
  repoRoot: string,
  derivedRoots: readonly string[],
): Promise<V018CandidateOutputSummary[]> {
  const entries = await workingCandidateEntries(repoRoot, derivedRoots);
  if (entries.size === 0) fail('candidate derived output roots contain no files');
  return Promise.all([...entries.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(async (entry) => {
      if (entry.path.endsWith('/candidate-receipt.json') || entry.path === 'candidate-receipt.json') {
        let parsed: unknown;
        try {
          parsed = JSON.parse((await readFile(path.join(repoRoot, entry.path))).toString('utf8')) as unknown;
        } catch {
          fail(`candidate receipt output is not valid JSON: ${entry.path}`);
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          fail(`candidate receipt output must be a JSON object: ${entry.path}`);
        }
        return {
          path: entry.path,
          mode: entry.mode,
          byteLength: entry.byteLength,
          sha256: sha256(canonicalJson({ ...(parsed as Record<string, unknown>), outputs: [] })),
          digestScope: 'receipt-body-without-outputs' as const,
        };
      }
      return {
        path: entry.path,
        mode: entry.mode,
        byteLength: entry.byteLength,
        sha256: entry.sha256,
        digestScope: 'bytes' as const,
      };
    }));
}

/**
 * Resolve the candidate-only two-commit contract. `captureRevision` is the
 * stable source commit (E); `generationRevision` is the commit being verified
 * (F) and must be the current HEAD. E == F is valid. E < F is valid only when
 * every changed Git path is below one declared derived output root.
 */
export async function assertV018CandidateEvidenceCaptureContract(options: {
  repoRoot: string;
  captureRevision: string;
  generationRevision?: string;
  sourcePaths?: readonly string[];
  derivedPaths: readonly string[];
  /** Generation-time replay may be writing an output root before commit F. */
  allowUncommittedDerived?: boolean;
}): Promise<V018CandidateEvidenceCaptureContract> {
  const repoRoot = path.resolve(options.repoRoot);
  const sourcePaths = [...(options.sourcePaths ?? V018_CANDIDATE_CAPTURE_PATHS)]
    .map((value, index) => normalizeContractPath(value, `sourcePaths[${index}]`));
  const derivedPaths = [...options.derivedPaths]
    .map((value, index) => normalizeContractPath(value, `derivedPaths[${index}]`));
  if (sourcePaths.length === 0) fail('candidate source paths must not be empty');
  if (derivedPaths.length === 0) fail('candidate derived paths must not be empty');
  if (new Set(sourcePaths).size !== sourcePaths.length) fail('candidate source paths must be unique');
  if (new Set(derivedPaths).size !== derivedPaths.length) fail('candidate derived paths must be unique');
  assertSourceDerivedDisjoint(sourcePaths, derivedPaths);

  const captureRevision = gitRevision(repoRoot, options.captureRevision, 'captureRevision');
  const generationRevision = gitRevision(
    repoRoot,
    options.generationRevision ?? contractGitText(repoRoot, ['rev-parse', '--verify', 'HEAD']).trim(),
    'generationRevision',
  );
  const currentHead = contractGitText(repoRoot, ['rev-parse', '--verify', 'HEAD']).trim();
  if (generationRevision !== currentHead) fail('generationRevision must equal the current Git HEAD');
  assertAncestorAndDerivedDiff(repoRoot, captureRevision, generationRevision, derivedPaths);

  const sourceAtCapture = contractGitEntries(repoRoot, captureRevision, sourcePaths);
  const sourceAtGeneration = contractGitEntries(repoRoot, generationRevision, sourcePaths);
  assertEntryMapsEqual(sourceAtCapture, sourceAtGeneration, 'candidate source Git tree');
  const sourceInWorkingTree = await workingCandidateEntries(repoRoot, sourcePaths);
  assertEntryMapsEqual(sourceAtCapture, sourceInWorkingTree, 'candidate source working tree');

  // A normal source/config/lock edit in the worktree is never an output. Git
  // status is used only for bounded path classification; source membership is
  // still proven by the explicit tree/worktree collections above.
  assertWorkingTreeChangesBounded(repoRoot, derivedPaths);
  const derivedAtGeneration = contractGitEntries(repoRoot, generationRevision, derivedPaths, true);
  const derivedInWorkingTree = await workingCandidateEntries(repoRoot, derivedPaths);
  if (options.allowUncommittedDerived) {
    for (const [relativePath, expectedEntry] of derivedAtGeneration) {
      const actualEntry = derivedInWorkingTree.get(relativePath);
      if (!actualEntry) fail(`candidate derived output is missing from the working tree: ${relativePath}`);
      if (
        actualEntry.mode !== expectedEntry.mode
        || actualEntry.objectType !== expectedEntry.objectType
        || actualEntry.gitObject !== expectedEntry.gitObject
      ) {
        fail(`candidate derived output drift at ${relativePath}`);
      }
    }
  } else {
    assertEntryMapsEqual(derivedAtGeneration, derivedInWorkingTree, 'candidate derived output');
  }
  const outputs = await candidateOutputSummaries(repoRoot, derivedPaths);

  return {
    contract: V018_CANDIDATE_EVIDENCE_CONTRACT,
    sourceContractVersion: V018_CANDIDATE_SOURCE_CONTRACT_VERSION,
    captureRevision,
    generationRevision,
    sourcePaths,
    derivedPaths,
    sourceManifestDigest: sha256(canonicalJson({
      contract: V018_CANDIDATE_SOURCE_CONTRACT_VERSION,
      paths: sourcePaths,
      entries: [...sourceAtCapture.values()].sort((left, right) => left.path.localeCompare(right.path)),
    })),
    sourceEntries: [...sourceAtCapture.values()].sort((left, right) => left.path.localeCompare(right.path)),
    outputs,
  };
}

/**
 * Verify a previously generated candidate after the derived-only commit F has
 * been created. This path does not replay PostgreSQL or rewrite evidence; it
 * only proves that the committed outputs still match the source contract and
 * the receipt generated from E (or explicitly rebound to F). Keeping this
 * separate avoids inventing F's final commit SHA inside a self-referential
 * receipt.
 */
export async function verifyV018CandidateEvidence(input: {
  repoRoot: string;
  captureRevision: string;
  generationRevision: string;
  outputRoot: string;
  sourcePaths?: readonly string[];
}): Promise<V018CandidateEvidenceCaptureContract> {
  const repoRoot = path.resolve(input.repoRoot);
  const outputRoot = path.resolve(input.outputRoot);
  const derivedPath = relativePath(repoRoot, outputRoot);
  const contract = await assertV018CandidateEvidenceCaptureContract({
    repoRoot,
    captureRevision: input.captureRevision,
    generationRevision: input.generationRevision,
    sourcePaths: input.sourcePaths,
    derivedPaths: [derivedPath],
  });
  const receiptPath = path.join(outputRoot, 'candidate-receipt.json');
  let parsed: unknown;
  try {
    parsed = JSON.parse((await readFile(receiptPath)).toString('utf8')) as unknown;
  } catch {
    fail('candidate receipt is missing or invalid JSON after derived commit');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('candidate receipt must be a JSON object after derived commit');
  }
  const receipt = parsed as Partial<V018AuthorityCandidateReceipt>;
  if (
    receipt.captureRevision !== contract.captureRevision
    || (
      receipt.generationRevision !== contract.captureRevision
      && receipt.generationRevision !== contract.generationRevision
    )
    || receipt.sourceContractVersion !== contract.sourceContractVersion
    || receipt.sourceManifestDigest !== contract.sourceManifestDigest
    || canonicalJson(receipt.sourceEntries) !== canonicalJson(contract.sourceEntries)
    || canonicalJson(receipt.outputs) !== canonicalJson(contract.outputs)
  ) {
    fail('candidate receipt capture contract does not match the committed source/derived contract');
  }
  if (!receipt.mirror) fail('candidate receipt is missing the mirror closure');
  await assertV018MirrorReceiptMatchesCapture({
    gitRoot: repoRoot,
    revision: contract.captureRevision,
    expected: receipt.mirror,
    fail,
  });
  return contract;
}

/**
 * Compare one captured Git file with the current filesystem, including raw
 * bytes and executable mode. This is intentionally local to the v0.18
 * candidate boundary so the runner and its closeout can share the same
 * single-file closure without widening the generic capture helper contract.
 */
export async function assertGitFileMatchesWorkingTree(options: {
  gitRoot: string;
  revision: string;
  relativePath: string;
  fail: (message: string) => never;
}): Promise<Buffer> {
  const relativePath = options.relativePath.replaceAll('\\', '/');
  if (
    path.posix.isAbsolute(relativePath)
    || relativePath === '..'
    || relativePath.startsWith('../')
    || relativePath.includes('\u0000')
  ) {
    options.fail(`ACT capture file is not repository-relative: ${options.relativePath}`);
  }

  let treeOutput: string;
  try {
    treeOutput = execFileSync(
      'git',
      ['ls-tree', '-l', '-z', options.revision, '--', relativePath],
      { cwd: options.gitRoot, encoding: 'utf8', maxBuffer: 64 * 1024 },
    );
  } catch {
    options.fail(`ACT capture Git file could not be read for ${relativePath}`);
  }
  const records = treeOutput.split('\u0000').filter(Boolean);
  if (records.length !== 1) {
    options.fail(`ACT capture Git file is missing: ${relativePath}`);
  }
  const match = /^(\d{6}) blob ([a-f0-9]{40})\s+(\d+)\t(.+)$/u.exec(records[0]!);
  if (!match || match[4] !== relativePath) {
    options.fail(`ACT capture Git file entry is malformed: ${relativePath}`);
  }
  const [, expectedMode, expectedObject, expectedLength] = match;
  if (!expectedMode || !expectedObject || !expectedLength) {
    options.fail(`ACT capture Git file entry is incomplete: ${relativePath}`);
  }

  let workingStat;
  try {
    workingStat = await lstat(path.join(options.gitRoot, relativePath));
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      options.fail(`ACT capture Git file is missing from working tree: ${relativePath}`);
    }
    throw error;
  }
  if (!workingStat.isFile()) options.fail(`ACT capture Git file is not a regular file: ${relativePath}`);
  const actualMode = (workingStat.mode & 0o111) !== 0 ? '100755' : '100644';
  if (actualMode !== expectedMode) options.fail(`ACT capture Git file mode drift: ${relativePath}`);

  const bytes = await readFile(path.join(options.gitRoot, relativePath));
  if (bytes.byteLength !== Number(expectedLength) || gitBlobSha1(bytes) !== expectedObject) {
    options.fail(`ACT capture Git file content drift: ${relativePath}`);
  }
  return bytes;
}

export async function assertV018MirrorReceiptMatchesCapture(options: {
  gitRoot: string;
  revision: string;
  expected: ActkgV018MirrorReceipt;
  fail: (message: string) => never;
}): Promise<ActkgV018MirrorReceipt> {
  const bytes = await assertGitFileMatchesWorkingTree({
    gitRoot: options.gitRoot,
    revision: options.revision,
    relativePath: V018_MIRROR_RECEIPT_PATH,
    fail: options.fail,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    options.fail('ACT v0.18 mirror receipt is not valid JSON');
  }
  if (canonicalJson(parsed) !== canonicalJson(options.expected)) {
    options.fail('ACT v0.18 mirror receipt semantic drift');
  }
  return parsed as ActkgV018MirrorReceipt;
}

/**
 * Close out a candidate only after the capture-bound mirror receipt has been
 * checked again. The outer runner already owns this output root, so a failed
 * closeout removes every partial candidate artifact before propagating the
 * rejection.
 */
export async function writeV018CandidateReceiptAfterCaptureCheck(options: {
  repoRoot: string;
  captureRevision: string;
  expectedMirrorReceipt: ActkgV018MirrorReceipt;
  outputRoot: string;
  receipt: V018AuthorityCandidateReceipt;
  captureContract?: V018CandidateEvidenceCaptureContract;
  allowUncommittedDerived?: boolean;
}): Promise<V018AuthorityCandidateReceipt> {
  let outputPublished = false;
  try {
    const mirror = await assertV018MirrorReceiptMatchesCapture({
      gitRoot: options.repoRoot,
      revision: options.captureRevision,
      expected: options.expectedMirrorReceipt,
      fail,
    });
    let receipt: V018AuthorityCandidateReceipt = { ...options.receipt, mirror };
    if (options.captureContract) {
      if (
        receipt.captureRevision !== options.captureContract.captureRevision
        || receipt.generationRevision !== options.captureContract.generationRevision
        || receipt.sourceManifestDigest !== options.captureContract.sourceManifestDigest
        || receipt.sourceContractVersion !== options.captureContract.sourceContractVersion
        || canonicalJson(receipt.sourceEntries) !== canonicalJson(options.captureContract.sourceEntries)
      ) {
        fail('candidate receipt capture contract does not match the verified source contract');
      }
      const receiptRelativePath = relativePath(
        options.repoRoot,
        path.join(options.outputRoot, 'candidate-receipt.json'),
      );
      const outputs = options.captureContract.outputs.filter((output) => output.path !== receiptRelativePath);
      const receiptSummary = {
        path: receiptRelativePath,
        mode: '100644' as const,
        byteLength: 0,
        sha256: '',
        digestScope: 'receipt-body-without-outputs' as const,
      };
      receipt = { ...receipt, outputs: [...outputs, receiptSummary].sort((left, right) => left.path.localeCompare(right.path)) };
      // The receipt is itself a derived output. Its digest intentionally covers
      // the canonical receipt body with `outputs` removed, avoiding an
      // impossible self-referential hash while retaining an auditable summary.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const digest = sha256(canonicalJson({ ...receipt, outputs: [] }));
        const bytes = Buffer.from(`${canonicalJson({ ...receipt, outputs: receipt.outputs.map((output) => (
          output.path === receiptRelativePath
            ? { ...output, sha256: digest }
            : output
        )) })}\n`);
        const nextLength = bytes.byteLength;
        const current = receipt.outputs.find((output) => output.path === receiptRelativePath);
        if (!current) fail('candidate receipt output summary is missing itself');
        receipt = {
          ...receipt,
          outputs: receipt.outputs.map((output) => output.path === receiptRelativePath
            ? { ...output, sha256: digest, byteLength: nextLength }
            : output),
        };
        if (current.byteLength === nextLength && current.sha256 === digest) break;
      }
    }
    await writeFile(
      path.join(options.outputRoot, 'candidate-receipt.json'),
      `${canonicalJson(receipt)}\n`,
      { mode: 0o644 },
    );
    if (options.captureContract) {
      const verified = await assertV018CandidateEvidenceCaptureContract({
        repoRoot: options.repoRoot,
        captureRevision: options.captureContract.captureRevision,
        generationRevision: options.captureContract.generationRevision,
        sourcePaths: options.captureContract.sourcePaths,
        derivedPaths: options.captureContract.derivedPaths,
        allowUncommittedDerived: options.allowUncommittedDerived,
      });
      if (canonicalJson(verified.outputs) !== canonicalJson(receipt.outputs)) {
        fail('candidate receipt output summaries drifted during publication');
      }
    }
    outputPublished = true;
    return receipt;
  } finally {
    if (!outputPublished) await rm(options.outputRoot, { recursive: true, force: true });
  }
}

async function requireAbsent(target: string, label: string): Promise<void> {
  try {
    await stat(target);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  fail(`${label} already exists; clean replay requires a new output root`);
}

async function capturePointers(repoRoot: string): Promise<PointerState[]> {
  const states: PointerState[] = [];
  for (const relativePath of POINTER_PATHS) {
    try {
      const bytes = await readFile(path.join(repoRoot, relativePath));
      states.push({
        relativePath,
        exists: true,
        byteLength: bytes.byteLength,
        sha256: sha256(bytes),
        bytes,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        states.push({ relativePath, exists: false, byteLength: null, sha256: null, bytes: null });
        continue;
      }
      throw error;
    }
  }
  return states;
}

function serializePointers(states: readonly PointerState[]): SerializablePointerState[] {
  return states.map(({ bytes: _bytes, ...state }) => state);
}

function assertPointersUnchanged(before: readonly PointerState[], after: readonly PointerState[]): void {
  if (before.length !== after.length) fail('pointer observation count changed');
  for (let index = 0; index < before.length; index += 1) {
    const left = before[index];
    const right = after[index];
    if (!left || !right || left.relativePath !== right.relativePath) fail('pointer observation order changed');
    const bytesEqual = left.bytes === null
      ? right.bytes === null
      : right.bytes !== null && left.bytes.equals(right.bytes);
    if (left.exists !== right.exists || left.byteLength !== right.byteLength
      || left.sha256 !== right.sha256 || !bytesEqual) {
      fail(`non-activation pointer changed: ${left.relativePath}`);
    }
  }
}

export function assertV018CandidateBundleCounts(bundle: ValidatedActKGBundleV2): void {
  const counts = [
    { name: 'releaseNodes', expected: 7061, actual: bundle.statistics.releaseNodes },
    { name: 'projectionNodes', expected: 6843, actual: bundle.statistics.projectionNodes },
    { name: 'publishedRelations', expected: 2811, actual: bundle.statistics.publishedRelations },
    { name: 'terminologyAssertions', expected: 1909, actual: bundle.statistics.terminologyAssertions },
  ] as const;
  for (const count of counts) {
    if (count.actual !== count.expected) {
      fail(`registered v0.18 count ${count.name}=${count.actual} != ${count.expected}`);
    }
  }
  if (bundle.projectionProfiles.length !== 3) fail('v0.18 must retain all three typed projection profiles');
  if (bundle.multilingualLabels.length !== 1909) fail('v0.18 multilingual labels are incomplete');
  if (bundle.rawArtifacts.length < 2) fail('v0.18 raw Artifact evidence is incomplete');
}

async function cleanupFailureProbe(repoRoot: string, baseClient: Client): Promise<void> {
  let isolated: IsolatedAdmissionDatabase | undefined;
  let schemaName: string | undefined;
  try {
    isolated = await createIsolatedAdmissionDatabase(repoRoot, { schemaOnly: true });
    schemaName = isolated.name;
    throw new Error('forced-v018-cleanup-probe');
  } catch (error) {
    if (!(error instanceof Error && error.message === 'forced-v018-cleanup-probe')) throw error;
  } finally {
    await isolated?.cleanup();
  }
  if (!schemaName || await schemaExists(baseClient, schemaName)) fail('failure-path disposable schema cleanup failed');
}

async function materializeReplay(input: {
  repoRoot: string;
  outputRoot: string;
  bundle: ValidatedActKGBundleV2;
  captureRevision: string;
  stagedAt: string;
  baseClient: Client;
  replayName: 'replay-1' | 'replay-2';
}): Promise<MaterializationResult> {
  const replayRoot = path.join(input.outputRoot, input.replayName);
  const authorityRoot = path.join(replayRoot, 'authority');
  let isolated: IsolatedAdmissionDatabase | undefined;
  try {
    isolated = await createIsolatedAdmissionDatabase(input.repoRoot, { schemaOnly: true });
    const firstImport = await importValidatedActKGBundleV2(isolated.db, input.bundle);
    const secondImport = await importValidatedActKGBundleV2(isolated.db, input.bundle);
    if (secondImport.mode !== 'idempotent') fail(`${input.replayName} second import was not idempotent`);
    const identity = v2ReleaseSetIdentity(input.bundle);
    const repository = new AuthoritativeKnowledgeRepository(
      isolated.db as unknown as AuthoritativeKnowledgeDatabase,
    );
    const candidate = await repository.read({
      authorityState: 'candidate',
      releaseSetId: identity.releaseSetId,
      releaseId: identity.releaseId,
    });
    if (candidate.status !== 'available' || candidate.diagnostics.length !== 0) {
      fail(`${input.replayName} repository reconstruction failed: ${JSON.stringify(candidate.diagnostics)}`);
    }
    const staged = stageAuthorityAfterValidatedBundleImport({
      paths: resolveAuthorityStorePaths(authorityRoot),
      repositorySnapshot: candidate.snapshot,
      captureRevision: input.captureRevision,
      stagedAt: input.stagedAt,
      receiptId: `stage-v018-${sha256(`${identity.bundleDigest}:${input.stagedAt}`)}`,
    });
    if (staged.manifest.lifecycle !== 'staged' || staged.stageReceipt.stagedAt !== input.stagedAt) {
      fail(`${input.replayName} Authority Snapshot was not staged at the fixed time`);
    }
    if (staged.manifest.releaseId !== identity.releaseId || staged.manifest.releaseSetId !== identity.releaseSetId) {
      fail(`${input.replayName} snapshot identity does not match the V2 candidate`);
    }
    await stat(resolveAuthorityStorePaths(authorityRoot).currentPointer).then(
      () => fail(`${input.replayName} wrote an active Authority pointer`),
      (error: unknown) => {
        if (!(error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT')) throw error;
      },
    );
    const schemaName = isolated.name;
    await isolated.cleanup();
    isolated = undefined;
    if (await schemaExists(input.baseClient, schemaName)) fail(`${input.replayName} schema was not dropped`);
    return { schemaName, firstImport, secondImport, staged, outputRoot: replayRoot };
  } finally {
    await isolated?.cleanup();
  }
}

async function readStageBytes(staged: StagedAuthoritySnapshotFiles): Promise<Buffer[]> {
  return Promise.all([staged.manifestPath, staged.engineeringPath, staged.stageReceiptPath].map((file) => readFile(file)));
}

export async function prepareV018AuthorityCandidate(input: {
  repoRoot: string;
  upstreamGitRoot: string;
  captureRevision: string;
  outputRoot: string;
  v09Root?: string;
  stagedAt?: string;
}): Promise<V018AuthorityCandidateReceipt> {
  const repoRoot = path.resolve(input.repoRoot);
  const outputRoot = path.resolve(input.outputRoot);
  if (!COMMIT.test(input.captureRevision)) fail('captureRevision must be a Git SHA');
  if (path.resolve(repoRoot, V018_ACT_CONTROLLED_PATH) === outputRoot) fail('outputRoot cannot be the controlled release path');
  await requireAbsent(outputRoot, 'candidate outputRoot');
  const stagedAt = input.stagedAt ?? FIXED_STAGED_AT;
  if (Number.isNaN(Date.parse(stagedAt)) || new Date(stagedAt).toISOString() !== stagedAt) {
    fail('stagedAt must be a canonical ISO timestamp');
  }

  const mirror = await mirrorPinnedV018Release({
    upstreamGitRoot: input.upstreamGitRoot,
    repoRoot,
    receiptPath: path.join(repoRoot, V018_MIRROR_RECEIPT_PATH),
  });
  const captureRevision = resolveTrustedCaptureRevision({
    gitRoot: repoRoot,
    trackedPaths: [...V018_CANDIDATE_CAPTURE_PATHS],
    expectedCaptureRevision: input.captureRevision,
    fail: (reason) => fail(reason),
  });
  if (captureRevision !== input.captureRevision) fail('captureRevision drifted during candidate preparation');
  if (relativePath(repoRoot, mirror.receiptPath) !== V018_MIRROR_RECEIPT_PATH) {
    fail('v0.18 mirror receipt path drifted from the capture contract');
  }
  await assertV018MirrorReceiptMatchesCapture({
    gitRoot: repoRoot,
    revision: captureRevision,
    expected: mirror.receipt,
    fail,
  });
  await assertGitDirectoryMatchesWorkingTree({
    gitRoot: repoRoot,
    revision: captureRevision,
    relativeDirectory: V018_CANDIDATE_MIGRATIONS_PATH,
    fail: (reason) => fail(reason),
  });
  const bundle = await loadAndValidatePublicBundleV2({
    root: repoRoot,
    bundlePath: V018_ACT_CONTROLLED_PATH,
    gitRoot: repoRoot,
    captureRevision,
  });
  assertV018CandidateBundleCounts(bundle);

  const sourceUrl = process.env.DATABASE_URL?.trim();
  if (!sourceUrl) fail('DATABASE_URL is not configured');
  assertLocalDatabaseUrl(sourceUrl);
  const baseClient = new Client({ connectionString: sourceUrl });
  let outputPublished = false;
  try {
    await baseClient.connect();
    const publicBefore = await fingerprintPublicSchema(baseClient);
    const pointersBefore = await capturePointers(repoRoot);
    await cleanupFailureProbe(repoRoot, baseClient);
    const replay1 = await materializeReplay({
      repoRoot, outputRoot, bundle, captureRevision, stagedAt, baseClient, replayName: 'replay-1',
    });
    const replay2 = await materializeReplay({
      repoRoot, outputRoot, bundle, captureRevision, stagedAt, baseClient, replayName: 'replay-2',
    });
    const firstBytes = await readStageBytes(replay1.staged);
    const secondBytes = await readStageBytes(replay2.staged);
    if (firstBytes.some((bytes, index) => !bytes.equals(secondBytes[index]!))) {
      fail('clean replay Authority Snapshot bytes differ');
    }
    const identity = v2ReleaseSetIdentity(bundle);
    const impact1 = await computeV018ImpactReport({
      repoRoot,
      captureGitRoot: repoRoot,
      v09Root: input.v09Root,
      candidate: bundle,
      candidateReleaseSetId: identity.releaseSetId,
      captureRevision,
    });
    const impact2 = await computeV018ImpactReport({
      repoRoot,
      captureGitRoot: repoRoot,
      v09Root: input.v09Root,
      candidate: bundle,
      candidateReleaseSetId: identity.releaseSetId,
      captureRevision,
    });
    const impactBytes1 = Buffer.from(serializeV018ImpactReport(impact1));
    const impactBytes2 = Buffer.from(serializeV018ImpactReport(impact2));
    if (!impactBytes1.equals(impactBytes2)) fail('clean replay impact reports differ');
    const finalMirrorReceipt = await assertV018MirrorReceiptMatchesCapture({
      gitRoot: repoRoot,
      revision: captureRevision,
      expected: mirror.receipt,
      fail,
    });
    const impactPath = path.join(outputRoot, 'impact-report.json');
    await writeFile(impactPath, impactBytes1, { mode: 0o644 });
    const captureContract = await assertV018CandidateEvidenceCaptureContract({
      repoRoot,
      captureRevision,
      generationRevision: captureRevision,
      derivedPaths: [relativePath(repoRoot, outputRoot)],
      allowUncommittedDerived: true,
    });
    const publicAfter = await fingerprintPublicSchema(baseClient);
    const pointersAfter = await capturePointers(repoRoot);
    assertPointersUnchanged(pointersBefore, pointersAfter);
    if (canonicalJson(publicBefore) !== canonicalJson(publicAfter)) fail('shared public schema changed');

    const receipt: V018AuthorityCandidateReceipt = {
      protocol: V018_CANDIDATE_RECEIPT_PROTOCOL,
      status: 'staged',
      mode: 'local-disposable-non-activation',
      deterministic: true,
      nonActivation: true,
      captureRevision,
      generationRevision: captureContract.generationRevision,
      sourceContractVersion: captureContract.sourceContractVersion,
      sourceManifestDigest: captureContract.sourceManifestDigest,
      sourceEntries: captureContract.sourceEntries,
      derivedPaths: captureContract.derivedPaths,
      outputs: captureContract.outputs,
      stagedAt,
      mirror: finalMirrorReceipt,
      validated: {
        protocol: bundle.protocol,
        ...identity,
        bundleId: bundle.bundleIdentity.bundleId,
        bundleRevision: bundle.bundleIdentity.bundleRevision,
        releaseEntries: bundle.statistics.releaseEntries,
        releaseNodes: bundle.statistics.releaseNodes,
        runtimeProjectionNodes: bundle.statistics.projectionNodes,
        runtimeProjectionLinks: bundle.statistics.projectionLinks,
        profiles: bundle.projectionProfiles.length,
        multilingualLabels: bundle.multilingualLabels.length,
        components: bundle.components.length,
        rawArtifacts: bundle.rawArtifacts.length,
        linkMetadataRows: bundle.runtimeLinkMetadata.length,
      },
      replays: [replay1, replay2].map((replay, index) => ({
        name: index === 0 ? 'replay-1' : 'replay-2',
        schemaName: replay.schemaName,
        import: replay.firstImport,
        idempotentImport: replay.secondImport,
        snapshotId: replay.staged.snapshotId,
        snapshotHash: replay.staged.snapshotHash,
        manifestPath: relativePath(repoRoot, replay.staged.manifestPath),
        engineeringPath: relativePath(repoRoot, replay.staged.engineeringPath),
        stageReceiptPath: relativePath(repoRoot, replay.staged.stageReceiptPath),
      })),
      impact: {
        path: relativePath(repoRoot, impactPath),
        digest: impact1.reportDigest,
        directDenominator: 'complete-v0.9-snapshot',
        upstreamDiffStatus: impact1.upstreamCrosscheck.status,
      },
      publicSchema: { before: publicBefore, after: publicAfter, unchanged: true },
      pointers: {
        before: serializePointers(pointersBefore),
        after: serializePointers(pointersAfter),
        unchanged: true,
      },
      replayByteEquivalent: true,
      impactByteEquivalent: true,
    };
    const publishedReceipt = await writeV018CandidateReceiptAfterCaptureCheck({
      repoRoot,
      captureRevision,
      expectedMirrorReceipt: mirror.receipt,
      outputRoot,
      receipt,
      captureContract,
      allowUncommittedDerived: true,
    });
    outputPublished = true;
    return publishedReceipt;
  } finally {
    await baseClient.end().catch(() => undefined);
    if (!outputPublished) await rm(outputRoot, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--verify-derived')) {
    const contract = await verifyV018CandidateEvidence({
      repoRoot: requiredOption(argv, '--repo-root'),
      captureRevision: requiredOption(argv, '--capture-revision'),
      generationRevision: requiredOption(argv, '--generation-revision'),
      outputRoot: requiredOption(argv, '--output-root'),
    });
    process.stdout.write(`${canonicalJson(contract)}\n`);
    return;
  }
  const receipt = await prepareV018AuthorityCandidate({
    repoRoot: requiredOption(argv, '--repo-root'),
    upstreamGitRoot: requiredOption(argv, '--upstream-git-root'),
    captureRevision: requiredOption(argv, '--capture-revision'),
    outputRoot: requiredOption(argv, '--output-root'),
    v09Root: optionalOption(argv, '--v09-root'),
    stagedAt: optionalOption(argv, '--staged-at'),
  });
  process.stdout.write(`${canonicalJson(receipt)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

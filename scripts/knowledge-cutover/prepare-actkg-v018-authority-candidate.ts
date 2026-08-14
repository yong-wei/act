#!/usr/bin/env tsx

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
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
] as const;

export const V018_CANDIDATE_MIGRATIONS_PATH = 'prisma/migrations' as const;

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
  });
  const captureRevision = resolveTrustedCaptureRevision({
    gitRoot: repoRoot,
    trackedPaths: [
      ...V018_CANDIDATE_CAPTURE_PATHS,
      V018_ACT_CONTROLLED_PATH,
    ],
    expectedCaptureRevision: input.captureRevision,
    fail: (reason) => fail(reason),
  });
  if (captureRevision !== input.captureRevision) fail('captureRevision drifted during candidate preparation');
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
    const impactPath = path.join(outputRoot, 'impact-report.json');
    await writeFile(impactPath, impactBytes1, { mode: 0o644 });
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
      stagedAt,
      mirror: mirror.receipt,
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
    await writeFile(path.join(outputRoot, 'candidate-receipt.json'), `${canonicalJson(receipt)}\n`, { mode: 0o644 });
    outputPublished = true;
    return receipt;
  } finally {
    await baseClient.end().catch(() => undefined);
    if (!outputPublished) await rm(outputRoot, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
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

#!/usr/bin/env tsx

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

import {
  admitLatestActkgAggregate,
  createIsolatedAdmissionDatabase,
  writeVerifiedJson,
  type AdmissionResult,
  type ChainAdmissionReceipt,
  type IsolatedAdmissionDatabase,
} from './admit-latest-actkg-aggregate';
import {
  AuthoritativeKnowledgeRepository,
  resolveAuthorityStorePaths,
  stageAuthorityAfterValidatedBundleImport,
  type AuthoritativeKnowledgeDatabase,
  type StagedAuthoritySnapshotFiles,
} from '../../src/lib/authoritative-knowledge';
import { canonicalJson, sha256 } from '../actkg-release/authoritative-release';

export const CUTOVER_CANDIDATE_RECEIPT_PROTOCOL =
  'actkg-to-act-cutover-authority-candidate/1' as const;

const COMMIT = /^[a-f0-9]{40}$/u;
const ACTKG_RELATION = /^Actkg[A-Za-z0-9_]*$/u;
const MIGRATION_RELATION = '_prisma_migrations';
const DEFAULT_POINTERS = [
  'course-content/authoring/knowledge/authority/current.json',
  'course-content/runtime/knowledge/projection/current.json',
  'course-content/runtime/knowledge/consumer-activation/current.json',
  'course-content/runtime/knowledge/legacy-retirement/current.json',
] as const;

interface PublicSchemaMigration {
  migrationName: string;
  checksum: string;
  finishedAt: string | null;
}

export interface PublicSchemaRelation {
  name: string;
  rowCount: string;
}

export interface PublicSchemaFingerprint {
  schema: 'public';
  migrations: PublicSchemaMigration[];
  actkgRelations: PublicSchemaRelation[];
  digest: string;
}

interface PointerState {
  relativePath: string;
  exists: boolean;
  byteLength: number | null;
  sha256: string | null;
  bytes: Buffer | null;
}

export interface SerializablePointerState {
  relativePath: string;
  exists: boolean;
  byteLength: number | null;
  sha256: string | null;
}

export interface CutoverCandidateReceipt {
  protocol: typeof CUTOVER_CANDIDATE_RECEIPT_PROTOCOL;
  status: 'staged';
  capturedAt: string;
  mode: 'local-disposable-non-activation';
  local: true;
  disposable: true;
  nonActivation: true;
  repoRoot: string;
  captureRoot: string;
  captureRevision: string;
  bindingPath: string;
  chainReceiptPath: string;
  outputRoot: string;
  schemaName: string;
  schemaDropped: true;
  release: {
    releaseSetId: string;
    releaseId: string;
    releaseHash: string;
    bundleId: string;
    bundleDigest: string;
  };
  admission: {
    protocol: AdmissionResult['protocol'];
    status: AdmissionResult['status'];
    candidates: string[];
    deltaReceiptIds: string[];
    deltaReceipts: Array<{
      order: number;
      receiptId: string;
      inputDigest: string;
      outputDigest: string;
      upstreamDiffDigest: string;
    }>;
    gates: AdmissionResult['gates'];
  };
  snapshot: {
    snapshotId: string;
    snapshotHash: string;
    lifecycle: 'staged';
    manifestPath: string;
    engineeringPath: string;
    stageReceiptPath: string;
    stageReceiptId: string;
    stagedAt: string;
  };
  publicSchema: {
    before: PublicSchemaFingerprint;
    after: PublicSchemaFingerprint;
    unchanged: true;
  };
  defaultPointers: {
    before: SerializablePointerState[];
    after: SerializablePointerState[];
    unchanged: true;
  };
  authority: {
    root: string;
    currentPointerPresent: false;
  };
}

function fail(message: string): never {
  throw new Error(`ActKG → ACT cutover candidate rejected: ${message}`);
}

/**
 * This runner performs DDL and is intentionally local-only. Validate the
 * connection target before constructing any Client or invoking any admission
 * helper that could create/drop a schema. Unix-socket URLs are not accepted
 * because this runner currently has no explicit socket-path allow-list.
 */
export function assertLocalDatabaseUrl(databaseUrl: string): void {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    fail('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    fail('DATABASE_URL must use the PostgreSQL URL scheme');
  }
  const hostname = url.hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
    fail('DATABASE_URL must target a local loopback PostgreSQL host');
  }
}

function quoteControlledIdentifier(identifier: string): string {
  if (!ACTKG_RELATION.test(identifier) && identifier !== MIGRATION_RELATION) {
    fail(`unexpected PostgreSQL relation name: ${identifier}`);
  }
  return `"${identifier}"`;
}

function normalizeFinishedAt(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Capture only public migration and ActKG relation identities/counts. Table
 * names are accepted from a strict database result allow-list before they are
 * used as quoted identifiers; no caller-provided SQL identifier is accepted.
 */
export async function fingerprintPublicSchema(client: Client): Promise<PublicSchemaFingerprint> {
  const migrationTable = await client.query<{ exists: boolean }>(
    `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS exists`,
  );
  const migrations: PublicSchemaMigration[] = [];
  if (migrationTable.rows[0]?.exists === true) {
    const result = await client.query<{
      migration_name: string;
      checksum: string;
      finished_at: Date | string | null;
    }>(
      `SELECT migration_name, checksum, finished_at
       FROM "public"."_prisma_migrations"
       ORDER BY migration_name`,
    );
    for (const row of result.rows) {
      migrations.push({
        migrationName: row.migration_name,
        checksum: row.checksum,
        finishedAt: normalizeFinishedAt(row.finished_at),
      });
    }
  }

  const relationResult = await client.query<{ name: string }>(
    `SELECT c.relname AS name
     FROM pg_class AS c
     JOIN pg_namespace AS n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND c.relname LIKE 'Actkg%'
     ORDER BY c.relname`,
  );
  const actkgRelations: PublicSchemaRelation[] = [];
  for (const row of relationResult.rows) {
    const relation = row.name;
    const quotedRelation = quoteControlledIdentifier(relation);
    const countResult = await client.query<{ row_count: string }>(
      `SELECT count(*)::text AS row_count FROM "public".${quotedRelation}`,
    );
    actkgRelations.push({
      name: relation,
      rowCount: countResult.rows[0]?.row_count ?? '0',
    });
  }
  const body = {
    schema: 'public' as const,
    migrations,
    actkgRelations,
  };
  return {
    ...body,
    digest: sha256(canonicalJson(body)),
  };
}

export async function captureDefaultPointerState(repoRoot: string): Promise<PointerState[]> {
  const states: PointerState[] = [];
  for (const relativePath of DEFAULT_POINTERS) {
    const target = path.resolve(repoRoot, relativePath);
    try {
      const bytes = await readFile(target);
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

export function serializePointerState(states: readonly PointerState[]): SerializablePointerState[] {
  return states.map(({ bytes: _bytes, ...state }) => state);
}

export function assertPointerStatesUnchanged(
  before: readonly PointerState[],
  after: readonly PointerState[],
): void {
  if (before.length !== after.length) fail('default pointer observation count changed');
  for (let index = 0; index < before.length; index += 1) {
    const left = before[index];
    const right = after[index];
    if (!left || !right || left.relativePath !== right.relativePath) {
      fail('default pointer observation order changed');
    }
    const bytesEqual = left.bytes === null
      ? right.bytes === null
      : right.bytes !== null && left.bytes.equals(right.bytes);
    if (
      left.exists !== right.exists
      || left.byteLength !== right.byteLength
      || left.sha256 !== right.sha256
      || !bytesEqual
    ) {
      fail(`default pointer changed: ${left.relativePath}`);
    }
  }
}

export async function schemaExists(client: Client, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_namespace WHERE nspname = $1
     ) AS exists`,
    [name],
  );
  return result.rows[0]?.exists === true;
}

async function requireAbsent(target: string, label: string): Promise<void> {
  try {
    await stat(target);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  fail(`${label} already exists; rerun is refused`);
}

function requiredOption(argv: readonly string[], name: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) fail(`missing ${name}`);
  return value;
}

async function readChainReceipt(filePath: string): Promise<ChainAdmissionReceipt> {
  const value = JSON.parse(await readFile(filePath, 'utf8')) as ChainAdmissionReceipt;
  if (!Array.isArray(value.chain) || value.chain.length === 0) fail('chain receipt has no admission entries');
  return value;
}

async function runCleanupProbe(repoRoot: string, baseClient: Client): Promise<void> {
  let isolated: IsolatedAdmissionDatabase | undefined;
  let schemaName: string | undefined;
  try {
    isolated = await createIsolatedAdmissionDatabase(repoRoot, { schemaOnly: true });
    schemaName = isolated.name;
    throw new Error('forced schema cleanup probe');
  } catch (error) {
    if (!(error instanceof Error && error.message === 'forced schema cleanup probe')) throw error;
  } finally {
    await isolated?.cleanup();
  }
  if (!schemaName || await schemaExists(baseClient, schemaName)) {
    fail('schema-only failure cleanup did not drop the disposable schema');
  }
}

function relativePath(repoRoot: string, target: string): string {
  const value = path.relative(repoRoot, path.resolve(target));
  return value === '' ? '.' : value;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const repoRoot = path.resolve(requiredOption(argv, '--repo-root'));
  const bindingPath = path.resolve(requiredOption(argv, '--binding'));
  const chainReceiptPath = path.resolve(requiredOption(argv, '--chain-receipt'));
  const outputRoot = path.resolve(requiredOption(argv, '--output-root'));
  const captureRevision = requiredOption(argv, '--capture-revision');
  const captureRoot = path.resolve(requiredOption(argv, '--capture-root'));
  if (!COMMIT.test(captureRevision)) fail('captureRevision must be a 40-character commit SHA');
  const capturedHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: captureRoot,
    encoding: 'utf8',
  }).trim();
  if (capturedHead !== captureRevision) {
    fail(`captureRoot HEAD ${capturedHead} does not match captureRevision ${captureRevision}`);
  }
  await requireAbsent(outputRoot, 'cutover candidate outputRoot');
  const authorityRoot = path.join(outputRoot, 'authority');
  const defaultAuthorityRoot = path.resolve(repoRoot, 'course-content/authoring/knowledge/authority');
  if (path.resolve(authorityRoot) === defaultAuthorityRoot) {
    fail('outputRoot would resolve to the default Authority store');
  }

  const stagedAt = new Date().toISOString();
  const sourceUrl = process.env.DATABASE_URL?.trim();
  if (!sourceUrl) fail('DATABASE_URL is not configured');
  assertLocalDatabaseUrl(sourceUrl);
  const baseClient = new Client({ connectionString: sourceUrl });
  let isolated: IsolatedAdmissionDatabase | undefined;
  try {
    await baseClient.connect();
    const publicBefore = await fingerprintPublicSchema(baseClient);
    const pointersBefore = await captureDefaultPointerState(repoRoot);
    await runCleanupProbe(repoRoot, baseClient);

    isolated = await createIsolatedAdmissionDatabase(repoRoot, { schemaOnly: true });
    const admission = await admitLatestActkgAggregate({
      repoRoot,
      bindingPath,
      chainReceiptPath,
      outputRoot: path.join(outputRoot, 'admission'),
      captureRevision,
      captureRoot,
      db: isolated.db,
    });
    const chainReceipt = await readChainReceipt(chainReceiptPath);
    const finalEntry = chainReceipt.chain.at(-1);
    if (!finalEntry) fail('chain receipt final entry is missing');
    if (admission.candidates.at(-1) !== finalEntry.bundleId) {
      fail('admission final Bundle identity does not match the chain receipt');
    }

    const repository = new AuthoritativeKnowledgeRepository(
      isolated.db as unknown as AuthoritativeKnowledgeDatabase,
    );
    const candidate = await repository.read({
      authorityState: 'candidate',
      releaseSetId: finalEntry.releaseSetId,
      releaseId: finalEntry.releaseId,
    });
    if (candidate.status !== 'available' || candidate.diagnostics.length !== 0) {
      fail(`candidate repository read failed: ${JSON.stringify(candidate)}`);
    }
    const staged = stageAuthorityAfterValidatedBundleImport({
      paths: resolveAuthorityStorePaths(authorityRoot),
      repositorySnapshot: candidate.snapshot,
      deltaReceiptIds: admission.deltaReceipts.map((receipt) => receipt.persisted.receiptId),
      predecessorReleaseId: chainReceipt.chain.at(-2)?.releaseId ?? null,
      captureRevision,
      stagedAt,
    });
    if (staged.manifest.lifecycle !== 'staged' || staged.stageReceipt.stagedAt !== stagedAt) {
      fail('Authority Snapshot did not materialize as the fixed-time staged lifecycle');
    }
    const authorityPaths = resolveAuthorityStorePaths(authorityRoot);
    await requireAbsent(authorityPaths.currentPointer, 'staged Authority current pointer');
    if (
      staged.manifest.releaseSetId !== finalEntry.releaseSetId
      || staged.manifest.releaseId !== finalEntry.releaseId
      || staged.manifest.releaseHash !== finalEntry.releaseHash
      || staged.manifest.provenance.bundleId !== finalEntry.bundleId
      || staged.manifest.bundleDigest !== finalEntry.bundleDigest
    ) {
      fail('staged Authority Snapshot identity does not match the admitted Release/Bundle');
    }

    const schemaName = isolated.name;
    await isolated.cleanup();
    isolated = undefined;
    if (await schemaExists(baseClient, schemaName)) {
      fail(`disposable schema still exists after successful cleanup: ${schemaName}`);
    }
    const publicAfter = await fingerprintPublicSchema(baseClient);
    const pointersAfter = await captureDefaultPointerState(repoRoot);
    assertPointerStatesUnchanged(pointersBefore, pointersAfter);
    if (publicBefore.digest !== publicAfter.digest || canonicalJson(publicBefore) !== canonicalJson(publicAfter)) {
      fail('shared public schema fingerprint changed during candidate preparation');
    }

    const receipt: CutoverCandidateReceipt = {
      protocol: CUTOVER_CANDIDATE_RECEIPT_PROTOCOL,
      status: 'staged',
      capturedAt: stagedAt,
      mode: 'local-disposable-non-activation',
      local: true,
      disposable: true,
      nonActivation: true,
      repoRoot: relativePath(repoRoot, repoRoot),
      captureRoot: relativePath(repoRoot, captureRoot),
      captureRevision,
      bindingPath: relativePath(repoRoot, bindingPath),
      chainReceiptPath: relativePath(repoRoot, chainReceiptPath),
      outputRoot: relativePath(repoRoot, outputRoot),
      schemaName,
      schemaDropped: true,
      release: {
        releaseSetId: finalEntry.releaseSetId,
        releaseId: finalEntry.releaseId,
        releaseHash: finalEntry.releaseHash,
        bundleId: finalEntry.bundleId,
        bundleDigest: finalEntry.bundleDigest,
      },
      admission: {
        protocol: admission.protocol,
        status: admission.status,
        candidates: admission.candidates,
        deltaReceiptIds: admission.deltaReceipts.map((receipt) => receipt.persisted.receiptId),
        deltaReceipts: admission.deltaReceipts.map((receipt) => ({
          order: receipt.order,
          receiptId: receipt.persisted.receiptId,
          inputDigest: receipt.persisted.inputDigest,
          outputDigest: receipt.persisted.outputDigest,
          upstreamDiffDigest: receipt.upstreamDiffDigest,
        })),
        gates: admission.gates,
      },
      snapshot: {
        snapshotId: staged.snapshotId,
        snapshotHash: staged.snapshotHash,
        lifecycle: staged.manifest.lifecycle,
        manifestPath: relativePath(repoRoot, staged.manifestPath),
        engineeringPath: relativePath(repoRoot, staged.engineeringPath),
        stageReceiptPath: relativePath(repoRoot, staged.stageReceiptPath),
        stageReceiptId: staged.stageReceipt.receiptId,
        stagedAt: staged.stageReceipt.stagedAt,
      },
      publicSchema: {
        before: publicBefore,
        after: publicAfter,
        unchanged: true,
      },
      defaultPointers: {
        before: serializePointerState(pointersBefore),
        after: serializePointerState(pointersAfter),
        unchanged: true,
      },
      authority: {
        root: relativePath(repoRoot, authorityRoot),
        currentPointerPresent: false,
      },
    };
    await writeVerifiedJson(path.join(outputRoot, 'cutover-candidate-receipt.json'), receipt);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } finally {
    await isolated?.cleanup();
    await baseClient.end().catch(() => undefined);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

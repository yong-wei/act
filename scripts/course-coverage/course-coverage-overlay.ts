import { spawnSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import type { PrismaClient } from '@prisma/client';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';

import {
  canonicalJson,
  loadAndValidateRelease,
  sha256,
  type ValidatedRelease,
} from '../actkg-release/authoritative-release';

export const COURSE_COVERAGE_CONTROLLED_PATH =
  'course-content/authoring/knowledge/course-coverage/active/automatic-control.json';
export const COURSE_COVERAGE_SCHEMA_PATH =
  'course-content/authoring/knowledge/course-coverage/course-coverage-overlay.schema.json';
export const COURSE_COVERAGE_IMPORTER_PATH =
  'scripts/course-coverage/course-coverage-overlay.ts';
export const COURSE_COVERAGE_IMPORT_CLI_PATH =
  'scripts/db/import-course-coverage-overlay.ts';
export const COURSE_COVERAGE_SCHEMA_VERSION = 'act-course-coverage-overlay/v1';
export const COURSE_COVERAGE_OVERLAY_ID = 'automatic-control-root-locus-coverage-v1';
export const COURSE_COVERAGE_COURSE_ID = 'automatic-control';
export const COURSE_COVERAGE_RELEASE_SET_ID = 'actkg-authoritative-candidate-v1';
export const COURSE_COVERAGE_RELEASE_ID = 'root-locus-engineering-v0.1';

const COMMIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const ROLE_VALUES = [
  'formal_objective',
  'necessary_prerequisite',
  'explicit_extension',
] as const;

export type CourseCoverageRole = (typeof ROLE_VALUES)[number];

export interface CourseCoverageEntry {
  canonicalId: string;
  role: CourseCoverageRole;
}

export interface CourseCoverageOverlay {
  schemaVersion: typeof COURSE_COVERAGE_SCHEMA_VERSION;
  overlayId: typeof COURSE_COVERAGE_OVERLAY_ID;
  overlayVersion: string;
  courseId: typeof COURSE_COVERAGE_COURSE_ID;
  releaseSetId: typeof COURSE_COVERAGE_RELEASE_SET_ID;
  releaseId: typeof COURSE_COVERAGE_RELEASE_ID;
  authoringRevision: string;
  sourceHash: string;
  releaseHash: string;
  lockRawHash: string;
  entries: CourseCoverageEntry[];
}

export interface ValidatedCourseCoverageOverlay {
  overlay: CourseCoverageOverlay;
  entries: CourseCoverageEntry[];
  versionId: string;
  captureRevision: string;
}

function fail(message: string): never {
  throw new Error(`Course coverage Overlay rejected: ${message}`);
}

function schemaError(errors: ErrorObject[] | null | undefined): never {
  const detail = errors?.map((error) => (
    `${error.instancePath || '/'} ${error.message ?? error.keyword}`
  )).join('; ');
  fail(`authoring schema validation failed${detail ? `: ${detail}` : ''}`);
}

function compareEntry(left: CourseCoverageEntry, right: CourseCoverageEntry): number {
  return left.canonicalId.localeCompare(right.canonicalId) || left.role.localeCompare(right.role);
}

export function computeCourseCoverageSourceHash(overlay: CourseCoverageOverlay): string {
  const withoutHash = { ...overlay } as Partial<CourseCoverageOverlay>;
  delete withoutHash.sourceHash;
  return sha256(canonicalJson(withoutHash));
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) fail(`Git verification failed for ${args.join(' ')}`);
  return result.stdout.trim();
}

function assertCleanGitCapture(root: string, overlay: CourseCoverageOverlay): string {
  if (git(root, ['status', '--porcelain=v1', '--untracked-files=all'])) {
    fail('authoring capture requires one clean Git HEAD');
  }
  const revision = git(root, ['rev-parse', '--verify', 'HEAD']);
  const ancestor = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', overlay.authoringRevision, revision],
    { cwd: root, encoding: 'utf8' },
  );
  if (ancestor.status !== 0) fail('authoring revision is not an ancestor of clean Git HEAD');
  git(root, [
    'ls-files',
    '--error-unmatch',
    COURSE_COVERAGE_CONTROLLED_PATH,
    COURSE_COVERAGE_SCHEMA_PATH,
    COURSE_COVERAGE_IMPORTER_PATH,
    COURSE_COVERAGE_IMPORT_CLI_PATH,
  ]);
  const committed = git(root, ['show', `${revision}:${COURSE_COVERAGE_CONTROLLED_PATH}`]);
  let committedOverlay: unknown;
  try {
    committedOverlay = JSON.parse(committed);
  } catch {
    fail('committed authoring Overlay is not valid JSON');
  }
  if (canonicalJson(committedOverlay) !== canonicalJson(overlay)) {
    fail('authoring source does not match its capture revision');
  }
  return revision;
}

export async function validateCourseCoverageOverlay(
  value: unknown,
  validatedRelease: ValidatedRelease,
  schema: unknown,
  options: {
    captureRevision?: string;
  } = {},
): Promise<ValidatedCourseCoverageOverlay> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema as Record<string, unknown>);
  if (!validate(value)) schemaError(validate.errors);
  const overlay = value as CourseCoverageOverlay;

  if (!COMMIT.test(overlay.authoringRevision)) fail('authoringRevision is invalid');
  const captureRevision = options.captureRevision ?? overlay.authoringRevision;
  if (!COMMIT.test(captureRevision)) fail('captureRevision is invalid');
  if (
    !SHA256.test(overlay.sourceHash)
    || overlay.sourceHash !== computeCourseCoverageSourceHash(overlay)
  ) {
    fail('source hash drift');
  }
  if (
    overlay.releaseSetId !== validatedRelease.lock.release_set_id
    || overlay.releaseId !== validatedRelease.entry.release_id
    || overlay.releaseHash !== validatedRelease.entry.release_hash
    || overlay.lockRawHash !== validatedRelease.lockRawHash
  ) {
    fail('pinned Release identity drift');
  }

  const canonicalIds = new Set(
    (validatedRelease.release.canonical_nodes as Array<{ id: string }>).map((row) => row.id),
  );
  const identities = new Set<string>();
  for (const entry of overlay.entries) {
    if (!canonicalIds.has(entry.canonicalId)) {
      fail(`entry references missing Canonical Object ${entry.canonicalId}`);
    }
    const identity = `${entry.canonicalId}\u001f${entry.role}`;
    if (identities.has(identity)) fail(`duplicate Canonical Object and role ${identity}`);
    identities.add(identity);
  }
  const entries = [...overlay.entries].sort(compareEntry);
  return {
    overlay,
    entries,
    versionId: `${overlay.overlayId}@${overlay.overlayVersion}`,
    captureRevision,
  };
}

export async function loadAndValidateCourseCoverageOverlay(options: {
  root?: string;
  overlayPath?: string;
  captureRevision?: string;
  requireCleanGit?: boolean;
} = {}): Promise<ValidatedCourseCoverageOverlay> {
  const root = path.resolve(options.root ?? process.cwd());
  const controlledPath = path.join(root, COURSE_COVERAGE_CONTROLLED_PATH);
  const requestedPath = path.resolve(root, options.overlayPath ?? COURSE_COVERAGE_CONTROLLED_PATH);
  if (await realpath(requestedPath) !== await realpath(controlledPath)) {
    fail('requested authoring source is not the controlled active Overlay path');
  }
  const [overlayBytes, schemaBytes] = await Promise.all([
    readFile(requestedPath),
    readFile(path.join(root, COURSE_COVERAGE_SCHEMA_PATH)),
  ]);
  const overlay = JSON.parse(overlayBytes.toString('utf8')) as CourseCoverageOverlay;
  const schema = JSON.parse(schemaBytes.toString('utf8')) as unknown;
  const captureRevision = options.requireCleanGit !== false
    ? assertCleanGitCapture(root, overlay)
    : options.captureRevision ?? overlay.authoringRevision;
  const validatedRelease = await loadAndValidateRelease({
    root,
    releaseId: COURSE_COVERAGE_RELEASE_ID,
    captureRevision,
  });
  return validateCourseCoverageOverlay(overlay, validatedRelease, schema, {
    captureRevision,
  });
}

function sameEntries(
  actual: Array<{ canonicalId: string; role: string; ordinal: number; releaseId: string }>,
  expected: CourseCoverageEntry[],
  releaseId: string,
): boolean {
  return actual.length === expected.length && actual.every((row, ordinal) => (
    row.ordinal === ordinal
    && row.releaseId === releaseId
    && row.canonicalId === expected[ordinal]!.canonicalId
    && row.role === expected[ordinal]!.role
  ));
}

export async function importCourseCoverageOverlay(
  db: PrismaClient,
  validated: ValidatedCourseCoverageOverlay,
): Promise<{ versionId: string; entryCount: number }> {
  const { overlay, versionId, entries, captureRevision } = validated;
  await db.$transaction(async (tx) => {
    const release = await tx.actkgRelease.findUnique({
      where: { id: overlay.releaseId },
      include: { releaseSet: true },
    });
    if (
      !release
      || release.releaseSetId !== overlay.releaseSetId
      || release.releaseSet.id !== overlay.releaseSetId
      || release.releaseHash !== overlay.releaseHash
      || release.lockRawHash !== overlay.lockRawHash
    ) {
      fail('persisted Release identity drift');
    }

    const existing = await tx.courseCoverageOverlayVersion.findUnique({
      where: { id: versionId },
      include: {
        entries: { orderBy: [{ ordinal: 'asc' }, { canonicalId: 'asc' }] },
        receipt: true,
      },
    });
    if (existing) {
      const receipt = existing.receipt;
      const conflict = (
        existing.schemaVersion !== overlay.schemaVersion
        || existing.overlayId !== overlay.overlayId
        || existing.overlayVersion !== overlay.overlayVersion
        || existing.courseId !== overlay.courseId
        || existing.releaseSetId !== overlay.releaseSetId
        || existing.releaseId !== overlay.releaseId
        || existing.authoringRevision !== overlay.authoringRevision
        || existing.captureRevision !== captureRevision
        || existing.sourceHash !== overlay.sourceHash
        || existing.releaseHash !== overlay.releaseHash
        || existing.lockRawHash !== overlay.lockRawHash
        || !sameEntries(existing.entries, entries, overlay.releaseId)
        || !receipt
        || receipt.authoringRevision !== overlay.authoringRevision
        || receipt.captureRevision !== captureRevision
        || receipt.sourceHash !== overlay.sourceHash
        || receipt.releaseHash !== overlay.releaseHash
        || receipt.lockRawHash !== overlay.lockRawHash
        || receipt.entryCount !== entries.length
      );
      if (conflict) fail(`Overlay identity ${versionId} already exists with different content`);
      return;
    }

    await tx.courseCoverageOverlayVersion.create({
      data: {
        id: versionId,
        schemaVersion: overlay.schemaVersion,
        overlayId: overlay.overlayId,
        overlayVersion: overlay.overlayVersion,
        courseId: overlay.courseId,
        releaseSetId: overlay.releaseSetId,
        releaseId: overlay.releaseId,
        authoringRevision: overlay.authoringRevision,
        captureRevision,
        sourceHash: overlay.sourceHash,
        releaseHash: overlay.releaseHash,
        lockRawHash: overlay.lockRawHash,
      },
    });
    await tx.courseCoverageOverlayEntry.createMany({
      data: entries.map((entry, ordinal) => ({
        overlayVersionId: versionId,
        releaseId: overlay.releaseId,
        canonicalId: entry.canonicalId,
        role: entry.role,
        ordinal,
      })),
    });
    await tx.courseCoverageImportReceipt.create({
      data: {
        id: `${versionId}:receipt`,
        overlayVersionId: versionId,
        authoringRevision: overlay.authoringRevision,
        captureRevision,
        sourceHash: overlay.sourceHash,
        releaseHash: overlay.releaseHash,
        lockRawHash: overlay.lockRawHash,
        entryCount: entries.length,
      },
    });
  }, { isolationLevel: 'Serializable' });
  return { versionId, entryCount: entries.length };
}

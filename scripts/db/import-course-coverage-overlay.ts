import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  AuthoritativeKnowledgeRepository,
  type AuthoritativeKnowledgeDatabase,
  type CourseCoverageSelector,
} from '../../src/lib/authoritative-knowledge';
import {
  COURSE_COVERAGE_CONTROLLED_PATH,
  importCourseCoverageOverlay,
  loadAndValidateCourseCoverageOverlay,
  type CourseCoverageOverlay,
} from '../course-coverage/course-coverage-overlay';

const COMMIT = /^[a-f0-9]{40}$/u;

async function imageRevision(): Promise<string | undefined> {
  const environmentRevision = process.env.APP_REVISION?.trim();
  const revisionPath = path.resolve(process.env.APP_REVISION_FILE ?? '.app-revision');
  const fileRevision = await readFile(revisionPath, 'utf8')
    .then((value) => value.trim())
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
  if (environmentRevision && fileRevision && environmentRevision !== fileRevision) {
    throw new Error('APP_REVISION does not match the immutable image revision file');
  }
  const revision = fileRevision ?? environmentRevision;
  if (revision !== undefined && !COMMIT.test(revision)) {
    throw new Error('image APP_REVISION must be 40 lowercase hexadecimal characters');
  }
  return revision;
}

function selector(overlay: CourseCoverageOverlay): CourseCoverageSelector {
  return {
    courseId: overlay.courseId,
    overlayId: overlay.overlayId,
    overlayVersion: overlay.overlayVersion,
    releaseSetId: overlay.releaseSetId,
    releaseId: overlay.releaseId,
  };
}

async function main(): Promise<void> {
  const validateOnly = process.argv.includes('--validate-only');
  const verifyOnly = process.argv.includes('--verify-only');
  if (validateOnly && verifyOnly) throw new Error('choose only one of --validate-only or --verify-only');
  if (validateOnly) {
    const validated = await loadAndValidateCourseCoverageOverlay();
    console.log(JSON.stringify({
      mode: 'validate-only',
      versionId: validated.versionId,
      captureRevision: validated.captureRevision,
      entryCount: validated.entries.length,
    }));
    return;
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required');
  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const rawOverlay = JSON.parse(await readFile(
      path.resolve(COURSE_COVERAGE_CONTROLLED_PATH),
      'utf8',
    )) as CourseCoverageOverlay;
    const existing = await db.courseCoverageOverlayVersion.findUnique({
      where: {
        overlayId_overlayVersion: {
          overlayId: rawOverlay.overlayId,
          overlayVersion: rawOverlay.overlayVersion,
        },
      },
      select: { captureRevision: true },
    });
    const captureRevision = existing?.captureRevision ?? await imageRevision();
    const validated = captureRevision
      ? await loadAndValidateCourseCoverageOverlay({
          captureRevision,
          requireCleanGit: false,
        })
      : await loadAndValidateCourseCoverageOverlay();
    const imported = verifyOnly
      ? undefined
      : await importCourseCoverageOverlay(db, validated);
    const result = await new AuthoritativeKnowledgeRepository(
      db as unknown as AuthoritativeKnowledgeDatabase,
    ).readCourseCoverage(selector(validated.overlay));
    if (result.status !== 'available' || result.diagnostics.length !== 0) {
      throw new Error(`persisted CourseCoverage verification failed: ${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify({
      mode: verifyOnly ? 'verify-only' : 'import',
      ...imported,
      versionId: validated.versionId,
      captureRevision: validated.captureRevision,
      entryCount: validated.entries.length,
      repositoryStatus: result.status,
    }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Course coverage Overlay import failed');
  process.exitCode = 1;
});

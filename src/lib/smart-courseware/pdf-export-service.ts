import { createHash, randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { contentHash } from '@/lib/smart-lesson-plan/domain';

import { SmartCoursewareError, type SmartCoursewareActor } from './domain';
import {
  SMART_COURSEWARE_PDF_RENDERER_VERSION,
  createPublishedCoursewarePdf,
} from './pdf-export';

type PdfExportDb = PrismaClient;

export async function exportSmartCoursewarePdf(db: PdfExportDb, input: {
  actor: SmartCoursewareActor;
  publicationRevisionId: string;
  idempotencyKey: string;
}) {
  const actor = validateActor(input.actor);
  const publicationRevisionId = validateId(input.publicationRevisionId, 'pdf-export-publication-id-invalid');
  const idempotencyKey = validateId(input.idempotencyKey, 'pdf-export-idempotency-key-invalid');
  const replay = await db.smartCoursewarePdfExport.findUnique({
    where: { ownerId_idempotencyKey: { ownerId: actor.id, idempotencyKey } },
  });
  if (replay) return assertStoredArtifact(replay, publicationRevisionId);

  const publication = await db.smartCoursewarePublicationRevision.findFirst({
    where: { id: publicationRevisionId, ownerId: actor.id },
    select: {
      id: true,
      ownerId: true,
      revisionNumber: true,
      planRevisionNumber: true,
      manifestSnapshot: true,
      manifestHash: true,
      contentHash: true,
    },
  });
  if (!publication) throw new SmartCoursewareError('pdf-export-published-revision-not-found', 404);

  const existing = await db.smartCoursewarePdfExport.findFirst({
    where: {
      ownerId: actor.id,
      publicationRevisionId: publication.id,
      rendererVersion: SMART_COURSEWARE_PDF_RENDERER_VERSION,
    },
  });
  if (existing) return assertStoredArtifact(existing, publicationRevisionId);

  const requestHash = contentHash({
    publicationRevisionId: publication.id,
    manifestHash: publication.manifestHash,
    contentHash: publication.contentHash,
    rendererVersion: SMART_COURSEWARE_PDF_RENDERER_VERSION,
  });
  const generated = await createPublishedCoursewarePdf({
    publicationRevisionId: publication.id,
    revisionNumber: publication.revisionNumber,
    planRevisionNumber: publication.planRevisionNumber,
    manifestHash: publication.manifestHash,
    contentHash: publication.contentHash,
    manifest: publication.manifestSnapshot,
  });

  try {
    return await db.smartCoursewarePdfExport.create({ data: {
      id: randomUUID(),
      ownerId: actor.id,
      publicationRevisionId: publication.id,
      idempotencyKey,
      requestHash,
      rendererVersion: generated.artifact.rendererVersion,
      manifestHash: publication.manifestHash,
      contentHash: publication.contentHash,
      projectionHash: generated.artifact.projectionHash,
      pageCount: generated.artifact.pageCount,
      artifactHash: generated.artifact.artifactHash,
      artifactBytes: Buffer.from(generated.artifact.bytes),
      artifactSizeBytes: generated.artifact.bytes.byteLength,
      createdById: actor.id,
    } });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const recovered = await db.smartCoursewarePdfExport.findFirst({
      where: {
        ownerId: actor.id,
        publicationRevisionId: publication.id,
        rendererVersion: SMART_COURSEWARE_PDF_RENDERER_VERSION,
      },
    });
    if (!recovered) throw new SmartCoursewareError('pdf-export-conflict', 409);
    return assertStoredArtifact(recovered, publicationRevisionId);
  }
}

function assertStoredArtifact(
  value: {
    publicationRevisionId: string;
    requestHash: string;
    artifactHash: string;
    artifactBytes: Uint8Array;
    artifactSizeBytes: number;
  },
  publicationRevisionId: string,
) {
  if (value.publicationRevisionId !== publicationRevisionId) {
    throw new SmartCoursewareError('pdf-export-idempotency-conflict', 409);
  }
  const actualHash = createHash('sha256').update(value.artifactBytes).digest('hex');
  if (actualHash !== value.artifactHash || value.artifactBytes.byteLength !== value.artifactSizeBytes) {
    throw new SmartCoursewareError('pdf-export-artifact-integrity-invalid', 409);
  }
  return value;
}

function validateActor(value: SmartCoursewareActor) {
  if (!value?.id?.trim() || (value.role !== 'TEACHER' && value.role !== 'ADMIN')) {
    throw new SmartCoursewareError('pdf-export-actor-invalid', 403);
  }
  return value;
}

function validateId(value: string, code: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    throw new SmartCoursewareError(code, 400);
  }
  return value;
}

function isUniqueConstraint(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

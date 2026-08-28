import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient, CourseBundleRevision } from '@prisma/client';

import {
  COURSE_BUNDLE_PLAN_PROJECTION_QUALIFICATION,
  COURSE_BUNDLE_REVISION_QUALIFICATION,
  CourseBundleDriftError,
  canonicalJson,
  generatedCoursewareBundleId,
  sha256Hex,
  type CourseBundleIdentity,
  type SessionBundleBinding,
} from './contract';
import { captureRuntimeCourseBundleIdentity } from './capture';

export const DB_LESSON_PLAN_RELEASE_ID = 'db-lesson-plan';

export interface PlanProjectionItemShape {
  stage: string;
  order: number;
  resourceId: string | null;
  knowledgeNodeId: string | null;
  overrideConfig: unknown;
}

/**
 * Content-addressed identity for a classroom started from a pure DB BOPPPS
 * plan with no runtime binding: the digest covers the immutable projection of
 * plan items (stage, order, resource/knowledge references, override config).
 * The mutable plan title never enters the identity.
 */
export function planProjectionBundleIdentity(
  planId: string,
  items: PlanProjectionItemShape[],
): CourseBundleIdentity {
  const projection = items
    .slice()
    .sort((left, right) => (left.stage === right.stage ? left.order - right.order : left.stage < right.stage ? -1 : 1))
    .map((item) => ({
      stage: item.stage,
      order: item.order,
      resourceId: item.resourceId,
      knowledgeNodeId: item.knowledgeNodeId,
      overrideConfig: item.overrideConfig ?? null,
    }));
  const bundleDigest = sha256Hex(canonicalJson({ planId, items: projection }));
  return {
    bundleId: `plan:${planId}`,
    canonicalLessonId: `plan:${planId}`,
    runtimeReleaseId: DB_LESSON_PLAN_RELEASE_ID,
    runtimeTreeSha256: bundleDigest,
    runtimeManifestSha256: null,
    runtimeSourceRevision: 'db',
    runtimeObjectLocator: { domain: 'db-lesson-plan' },
    bundleDigest,
    identityProjectionHash: sha256Hex(canonicalJson({ planId, itemCount: items.length })),
    manifestHash: null,
    resourceHashes: {
      schemaVersion: 'course-bundle-resource-hashes.v1',
      media: bundleDigest,
    },
    qualification: COURSE_BUNDLE_PLAN_PROJECTION_QUALIFICATION,
  };
}

export function sessionBundleBindingFromRevision(revision: {
  canonicalLessonId: string;
  runtimeReleaseId: string;
  bundleDigest: string;
  manifestHash: string | null;
  resourceHashes: unknown;
}): SessionBundleBinding {
  return {
    canonicalLessonId: revision.canonicalLessonId,
    runtimeReleaseId: revision.runtimeReleaseId,
    bundleDigest: revision.bundleDigest,
    manifestHash: revision.manifestHash,
    resourceHashes: revision.resourceHashes as SessionBundleBinding['resourceHashes'],
  };
}

type BundleDb = Pick<PrismaClient, 'courseBundleRevision' | 'classSessionIntegrityIncident'>;
type BundleTx = Pick<Prisma.TransactionClient, 'courseBundleRevision'>;

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && String((error as { code?: unknown }).code).includes('P2002');
}

/**
 * Idempotent, append-only persistence. A revision is reused only when both the
 * content digest and the exact release locator identity match; identical bytes
 * published under a different release get a new revision so a session can never
 * inherit a stale locator. A referenced revision is never mutated.
 */
export async function persistCourseBundleRevision(
  tx: BundleTx,
  identity: CourseBundleIdentity,
): Promise<CourseBundleRevision> {
  const existing = await tx.courseBundleRevision.findUnique({
    where: {
      bundleId_bundleDigest_runtimeReleaseId_runtimeTreeSha256: {
        bundleId: identity.bundleId,
        bundleDigest: identity.bundleDigest,
        runtimeReleaseId: identity.runtimeReleaseId,
        runtimeTreeSha256: identity.runtimeTreeSha256,
      },
    },
  });
  if (existing) return existing;

  const latest = await tx.courseBundleRevision.aggregate({
    where: { bundleId: identity.bundleId },
    _max: { bundleRevision: true },
  });
  const nextRevision = (latest._max.bundleRevision ?? 0) + 1;
  try {
    return await tx.courseBundleRevision.create({
      data: {
        bundleId: identity.bundleId,
        canonicalLessonId: identity.canonicalLessonId,
        bundleRevision: nextRevision,
        runtimeReleaseId: identity.runtimeReleaseId,
        runtimeTreeSha256: identity.runtimeTreeSha256,
        runtimeManifestSha256: identity.runtimeManifestSha256,
        runtimeSourceRevision: identity.runtimeSourceRevision,
        runtimeObjectLocator: identity.runtimeObjectLocator as Prisma.InputJsonValue,
        bundleDigest: identity.bundleDigest,
        identityProjectionHash: identity.identityProjectionHash,
        manifestHash: identity.manifestHash,
        resourceHashes: identity.resourceHashes as unknown as Prisma.InputJsonValue,
        qualification: identity.qualification ?? COURSE_BUNDLE_REVISION_QUALIFICATION,
      },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const raced = await tx.courseBundleRevision.findUnique({
        where: {
          bundleId_bundleDigest_runtimeReleaseId_runtimeTreeSha256: {
            bundleId: identity.bundleId,
            bundleDigest: identity.bundleDigest,
            runtimeReleaseId: identity.runtimeReleaseId,
            runtimeTreeSha256: identity.runtimeTreeSha256,
          },
        },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

/**
 * Resolve and persist the bundle revision for an ordinary runtime-first
 * lesson. Failures (unknown identity, missing runtime resources, identity
 * mismatch) propagate as CourseBundleCaptureError and MUST block creation.
 */
export async function resolveOrdinarySessionBundleRevision(
  tx: BundleTx,
  canonicalLessonId: string,
): Promise<CourseBundleRevision> {
  const identity = await captureRuntimeCourseBundleIdentity(canonicalLessonId);
  return persistCourseBundleRevision(tx, identity);
}

export function generatedCoursewareBundleIdentity(publication: {
  id: string;
  manifestHash: string;
  contentHash: string;
  sourceRevision: string;
}): CourseBundleIdentity {
  return {
    bundleId: generatedCoursewareBundleId(publication.id),
    canonicalLessonId: generatedCoursewareBundleId(publication.id),
    runtimeReleaseId: publication.id,
    runtimeTreeSha256: publication.contentHash,
    runtimeManifestSha256: publication.manifestHash,
    runtimeSourceRevision: publication.sourceRevision,
    runtimeObjectLocator: { domain: 'generated-courseware-publication' },
    bundleDigest: publication.contentHash,
    identityProjectionHash: publication.manifestHash,
    manifestHash: publication.manifestHash,
    resourceHashes: {
      schemaVersion: 'course-bundle-resource-hashes.v1',
      media: publication.contentHash,
    },
  };
}

/**
 * Resolve and persist the bundle revision mirroring a generated-courseware
 * publication revision. The publication content hash is the complete digest of
 * its governed snapshot bundle; publication revision equality is already
 * enforced by the existing launch/read guards.
 */
export async function resolveGeneratedCoursewareBundleRevision(
  tx: BundleTx,
  publication: {
    id: string;
    manifestHash: string;
    contentHash: string;
    sourceRevision: string;
  },
): Promise<CourseBundleRevision> {
  return persistCourseBundleRevision(tx, generatedCoursewareBundleIdentity(publication));
}

export type SessionBundleBindingClassification = 'bound' | 'legacy-incomplete';

export type SessionBundleBindingRow = {
  id: string;
  courseBundleRevisionId: string | null;
  bundleRuntimeReleaseId: string | null;
  bundleDigest: string | null;
  manifestHash: string | null;
};

export function classifySessionBundleBinding(session: SessionBundleBindingRow): SessionBundleBindingClassification {
  return session.courseBundleRevisionId ? 'bound' : 'legacy-incomplete';
}

/**
 * Read-boundary verification for a bound session: the denormalized fields must
 * equal the referenced immutable revision. Any disagreement is drift and fails
 * closed (never falls back to the active release, plan, or title).
 */
export async function verifySessionCourseBundleBinding(
  db: BundleDb,
  session: SessionBundleBindingRow,
): Promise<CourseBundleRevision> {
  if (!session.courseBundleRevisionId) {
    throw new CourseBundleDriftError(
      'session-binding-missing',
      `Session ${session.id} has no course bundle binding.`,
    );
  }
  const revision = await db.courseBundleRevision.findUnique({
    where: { id: session.courseBundleRevisionId },
  });
  if (!revision) {
    await recordBindingIncident(db, session, 'course-bundle-revision-missing', {});
    throw new CourseBundleDriftError(
      'revision-record-missing',
      `Session ${session.id} references missing course bundle revision ${session.courseBundleRevisionId}.`,
    );
  }
  const driftFields: Record<string, { expected: string | null; observed: string | null }> = {};
  if (session.bundleRuntimeReleaseId !== revision.runtimeReleaseId) {
    driftFields.runtimeReleaseId = { expected: revision.runtimeReleaseId, observed: session.bundleRuntimeReleaseId };
  }
  if (session.bundleDigest !== revision.bundleDigest) {
    driftFields.bundleDigest = { expected: revision.bundleDigest, observed: session.bundleDigest };
  }
  if (revision.manifestHash !== null && session.manifestHash !== revision.manifestHash) {
    driftFields.manifestHash = { expected: revision.manifestHash, observed: session.manifestHash };
  }
  if (Object.keys(driftFields).length > 0) {
    await recordBindingIncident(db, session, 'course-bundle-binding-drift', driftFields);
    throw new CourseBundleDriftError(
      'denormalized-binding-drift',
      `Session ${session.id} bundle binding drifted: ${JSON.stringify(driftFields)}.`,
    );
  }
  return revision;
}

async function recordBindingIncident(
  db: BundleDb,
  session: SessionBundleBindingRow,
  code: string,
  drift: Record<string, unknown>,
) {
  try {
    await db.classSessionIntegrityIncident.upsert({
      where: { sessionId_fingerprint: { sessionId: session.id, fingerprint: code } },
      create: {
        id: randomUUID(),
        sessionId: session.id,
        code,
        fingerprint: code,
        expected: drift as Prisma.InputJsonValue,
        observed: { bundleRuntimeReleaseId: session.bundleRuntimeReleaseId, bundleDigest: session.bundleDigest },
      },
      update: { occurrenceCount: { increment: 1 } },
    });
  } catch (error) {
    console.error('[CourseBundle] Failed to persist binding incident:', error);
  }
}

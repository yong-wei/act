import { createPrismaClient } from '../../src/lib/prisma-client';

import { COURSE_BUNDLE_REVISION_QUALIFICATION } from '@/lib/course-bundle/contract';

const prisma = createPrismaClient();

export interface CourseBundleRevisionQualityReport {
  generatedAt: string;
  totals: {
    revisions: number;
    bundles: number;
    boundSessions: number;
    legacySessions: number;
  };
  integrity: {
    revisionRecordsWithInvalidQualification: number;
    revisionRecordsWithIncompleteIdentity: number;
    sessionsWithMissingRevisionRecord: number;
    sessionsWithDenormalizedDrift: number;
    denormalizedDriftExamples: Array<{
      sessionId: string;
      field: string;
      expected: string | null;
      observed: string | null;
    }>;
  };
}

function isCompleteRevisionIdentity(revision: {
  bundleId: string;
  canonicalLessonId: string;
  runtimeReleaseId: string;
  runtimeTreeSha256: string;
  runtimeSourceRevision: string;
  bundleDigest: string;
  identityProjectionHash: string;
  resourceHashes: unknown;
}) {
  const hashes = revision.resourceHashes as { schemaVersion?: string; lesson?: string; graphOverlay?: string } | null;
  return Boolean(
    revision.bundleId
    && revision.canonicalLessonId
    && revision.runtimeReleaseId
    && revision.runtimeTreeSha256
    && revision.runtimeSourceRevision
    && /^[0-9a-f]{64}$/.test(revision.bundleDigest)
    && /^[0-9a-f]{64}$/.test(revision.identityProjectionHash)
    && hashes?.schemaVersion === 'course-bundle-resource-hashes.v1'
    && /^[0-9a-f]{64}$/.test(hashes?.lesson ?? '')
    && /^[0-9a-f]{64}$/.test(hashes?.graphOverlay ?? ''),
  );
}

export async function collectCourseBundleRevisionQualityReport(): Promise<CourseBundleRevisionQualityReport> {
  const [revisions, sessions] = await Promise.all([
    prisma.courseBundleRevision.findMany({}),
    prisma.classSession.findMany({
      select: {
        id: true,
        courseBundleRevisionId: true,
        bundleRuntimeReleaseId: true,
        bundleDigest: true,
        manifestHash: true,
      },
    }),
  ]);

  const revisionsById = new Map(revisions.map((revision) => [revision.id, revision]));
  const boundSessions = sessions.filter((session) => session.courseBundleRevisionId !== null);
  const driftExamples: CourseBundleRevisionQualityReport['integrity']['denormalizedDriftExamples'] = [];
  let missingRevisionRecord = 0;
  let denormalizedDrift = 0;

  for (const session of boundSessions) {
    const revision = session.courseBundleRevisionId
      ? revisionsById.get(session.courseBundleRevisionId)
      : undefined;
    if (!revision) {
      missingRevisionRecord += 1;
      continue;
    }
    const fields: Array<[string, string | null, string | null]> = [
      ['bundleRuntimeReleaseId', revision.runtimeReleaseId, session.bundleRuntimeReleaseId],
      ['bundleDigest', revision.bundleDigest, session.bundleDigest],
      ['manifestHash', revision.manifestHash, session.manifestHash],
    ];
    for (const [field, expected, observed] of fields) {
      if (expected !== null && expected !== observed) {
        denormalizedDrift += 1;
        if (driftExamples.length < 20) {
          driftExamples.push({ sessionId: session.id, field, expected, observed });
        }
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      revisions: revisions.length,
      bundles: new Set(revisions.map((revision) => revision.bundleId)).size,
      boundSessions: boundSessions.length,
      legacySessions: sessions.length - boundSessions.length,
    },
    integrity: {
      revisionRecordsWithInvalidQualification: revisions.filter(
        (revision) => revision.qualification !== COURSE_BUNDLE_REVISION_QUALIFICATION,
      ).length,
      revisionRecordsWithIncompleteIdentity: revisions.filter(
        (revision) => !isCompleteRevisionIdentity(revision),
      ).length,
      sessionsWithMissingRevisionRecord: missingRevisionRecord,
      sessionsWithDenormalizedDrift: denormalizedDrift,
      denormalizedDriftExamples: driftExamples,
    },
  };
}

function hasIntegrityFailure(report: CourseBundleRevisionQualityReport) {
  const { integrity } = report;
  return integrity.revisionRecordsWithInvalidQualification > 0
    || integrity.revisionRecordsWithIncompleteIdentity > 0
    || integrity.sessionsWithMissingRevisionRecord > 0
    || integrity.sessionsWithDenormalizedDrift > 0;
}

async function main() {
  const report = await collectCourseBundleRevisionQualityReport();
  console.log(`Course bundle revision quality report (${report.generatedAt})`);
  console.log(`Revisions: ${report.totals.revisions} across ${report.totals.bundles} bundles`);
  console.log(`Sessions: bound=${report.totals.boundSessions} legacy-incomplete=${report.totals.legacySessions}`);
  console.log(`Invalid qualification: ${report.integrity.revisionRecordsWithInvalidQualification}`);
  console.log(`Incomplete revision identity: ${report.integrity.revisionRecordsWithIncompleteIdentity}`);
  console.log(`Sessions with missing revision record: ${report.integrity.sessionsWithMissingRevisionRecord}`);
  console.log(`Sessions with denormalized binding drift: ${report.integrity.sessionsWithDenormalizedDrift}`);
  for (const example of report.integrity.denormalizedDriftExamples) {
    console.log(`  drift ${example.sessionId}.${example.field} expected=${example.expected} observed=${example.observed}`);
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  }
  if (hasIntegrityFailure(report)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('report-course-bundle-revision-quality.ts')) {
  main().finally(() => prisma.$disconnect());
}

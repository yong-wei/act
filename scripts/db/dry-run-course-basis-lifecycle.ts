import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient();
const verify = process.argv.includes('--verify');

type CountRow = { lifecycle: string; count: bigint };
type ScalarRow = { count: bigint };

async function main() {
  const lifecycle = await prisma.$queryRaw<CountRow[]>`
    SELECT
      CASE
        WHEN "retiredAt" IS NOT NULL THEN 'DISABLED'
        WHEN "reviewState" = 'REJECTED'
          OR "extractionState" IN ('FAILED', 'UNSUPPORTED') THEN 'FAILED'
        WHEN "extractionState" <> 'EXTRACTED' THEN 'PROCESSING'
        WHEN "reviewState" = 'CONFIRMED' THEN 'FROZEN'
        ELSE 'EDITABLE'
      END AS lifecycle,
      COUNT(*)::bigint AS count
    FROM "CourseBasisDocumentVersion"
    GROUP BY 1
    ORDER BY 1
  `;
  const [projectionGap] = await prisma.$queryRaw<ScalarRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "CourseBasisSegment" AS segment
    JOIN "CourseBasisDocumentVersion" AS version ON version."id" = segment."versionId"
    LEFT JOIN "CourseBasisProjection" AS projection ON projection."segmentId" = segment."id"
    WHERE projection."id" IS NULL
      AND version."extractionState" = 'EXTRACTED'
      AND version."reviewState" <> 'REJECTED'
  `;
  const [identityColumns] = await prisma.$queryRaw<ScalarRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'CourseBasisReferenceLink'
      AND column_name IN ('contentHash', 'anchors')
  `;
  let incompleteReferenceIdentity: bigint | null = null;
  if (identityColumns?.count === BigInt(2)) {
    const [row] = await prisma.$queryRawUnsafe<ScalarRow[]>(`
      SELECT COUNT(*)::bigint AS count
      FROM "CourseBasisReferenceLink"
      WHERE "contentHash" IS NULL
        OR "contentHash" = ''
        OR "anchors" IS NULL
        OR jsonb_array_length("anchors") = 0
    `);
    incompleteReferenceIdentity = row?.count ?? BigInt(0);
  }

  const report = {
    mode: verify ? 'verify' : 'dry-run',
    lifecycle: Object.fromEntries(lifecycle.map((row) => [row.lifecycle, Number(row.count)])),
    projectionGap: Number(projectionGap?.count ?? BigInt(0)),
    referenceIdentityColumnsPresent: identityColumns?.count === BigInt(2),
    incompleteReferenceIdentity: incompleteReferenceIdentity === null
      ? null
      : Number(incompleteReferenceIdentity),
  };
  console.log(JSON.stringify(report, null, 2));

  if (verify && (
    report.projectionGap > 0
    || !report.referenceIdentityColumnsPresent
    || report.incompleteReferenceIdentity !== 0
  )) {
    throw new Error('course-basis-lifecycle-verification-failed');
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

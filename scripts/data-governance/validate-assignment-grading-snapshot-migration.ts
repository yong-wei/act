import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const snapshotMigrationPath = path.join(root, 'prisma', 'migrations', '20260824170000_allow_manual_and_ai_snapshots_for_same_vector', 'migration.sql');
const manualReviewMigrationPath = path.join(root, 'prisma', 'migrations', '20260824173000_allow_manual_reviews_without_evidence', 'migration.sql');

async function main() {
  const [schema, snapshotMigration, manualReviewMigration] = await Promise.all([
    readFile(schemaPath, 'utf8'),
    readFile(snapshotMigrationPath, 'utf8'),
    readFile(manualReviewMigrationPath, 'utf8'),
  ]);
  const requiredSchema = [
    'source                String   @default("AI")',
    '@@index([submissionId, attemptVectorHash, source])',
    'answerEvidenceId       String?',
    'answerEvidenceId            String?',
  ];
  const requiredSnapshotMigration = [
    'ADD COLUMN "source" TEXT NOT NULL DEFAULT \'AI\'',
    'SET "source" = \'MANUAL\'',
    'operation."selectionSnapshot" ->> \'version\' = \'assignment-manual-grading.v1\'',
    'DROP INDEX "AssignmentSubmissionSnapshot_submissionId_attemptVectorHash_key"',
    'CREATE UNIQUE INDEX "AssignmentSubmissionSnapshot_ai_submissionId_attemptVectorHash_key"',
    'WHERE "source" = \'AI\'',
  ];
  const requiredManualReviewMigration = [
    'ALTER TABLE "TeacherAssignmentReview"\nALTER COLUMN "answerEvidenceId" DROP NOT NULL',
    'ALTER TABLE "TeacherAssignmentApprovalSnapshot"\nALTER COLUMN "answerEvidenceId" DROP NOT NULL',
  ];
  const missing = [
    ...requiredSchema.filter((entry) => !schema.includes(entry)).map((entry) => `schema:${entry}`),
    ...requiredSnapshotMigration.filter((entry) => !snapshotMigration.includes(entry)).map((entry) => `snapshot-migration:${entry}`),
    ...requiredManualReviewMigration.filter((entry) => !manualReviewMigration.includes(entry)).map((entry) => `manual-review-migration:${entry}`),
  ];
  if (missing.length) {
    console.error(`Assignment grading snapshot migration validation failed:\n${missing.map((entry) => `- ${entry}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Assignment grading snapshot migration validation passed.');
}

void main();

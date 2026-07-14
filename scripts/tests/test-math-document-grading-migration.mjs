import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(join(root, 'prisma/migrations/20260712170000_productionize_math_document_grading_pipeline/migration.sql'), 'utf8');
const issue916Migration = readFileSync(join(root, 'prisma/migrations/20260712183000_issue916_concurrency_source_asset_lifecycle/migration.sql'), 'utf8');
const lifecycleLeaseMigration = readFileSync(join(root, 'prisma/migrations/20260713030000_issue916_lifecycle_audit_lease/migration.sql'), 'utf8');
const reviewHardeningMigration = readFileSync(join(root, 'prisma/migrations/20260713120000_issue916_review_hardening/migration.sql'), 'utf8');
const phaseThreeMigration = readFileSync(join(root, 'prisma/migrations/20260713150000_issue916_phase_three_data_governance/migration.sql'), 'utf8');
const phaseFourMigrationName = '20260713170000_issue916_phase_four_data_governance';
assert.ok(Buffer.byteLength(phaseFourMigrationName, 'utf8') <= 63, 'phase-four migration directory must fit PostgreSQL identifier limit');
const phaseFourMigration = readFileSync(join(root, `prisma/migrations/${phaseFourMigrationName}/migration.sql`), 'utf8');
const phaseFiveMigrationName = '20260713190000_issue916_phase_five_data_governance';
assert.ok(Buffer.byteLength(phaseFiveMigrationName, 'utf8') <= 63, 'phase-five migration directory must fit PostgreSQL identifier limit');
const phaseFiveMigration = readFileSync(join(root, `prisma/migrations/${phaseFiveMigrationName}/migration.sql`), 'utf8');
const phaseSixMigrationName = '20260713210000_issue916_phase_six_lifecycle_safety';
assert.ok(Buffer.byteLength(phaseSixMigrationName, 'utf8') <= 63, 'phase-six migration directory must fit PostgreSQL identifier limit');
const phaseSixMigration = readFileSync(join(root, `prisma/migrations/${phaseSixMigrationName}/migration.sql`), 'utf8');
const reconciliationMigrationName = '20260713230000_issue916_data_plane_reconciliation';
assert.ok(Buffer.byteLength(reconciliationMigrationName, 'utf8') <= 63, 'data-plane reconciliation migration directory must fit PostgreSQL identifier limit');
const reconciliationMigration = readFileSync(join(root, `prisma/migrations/${reconciliationMigrationName}/migration.sql`), 'utf8');
const p0P1MigrationName = '20260714000000_issue916_p0_p1_lifecycle_isolation';
assert.ok(Buffer.byteLength(p0P1MigrationName, 'utf8') <= 63, 'P0/P1 lifecycle migration directory must fit PostgreSQL identifier limit');
const p0P1Migration = readFileSync(join(root, `prisma/migrations/${p0P1MigrationName}/migration.sql`), 'utf8');
const submissionLookupMigrationName = '20260714013000_issue916_submission_tombstone_lookup';
assert.ok(Buffer.byteLength(submissionLookupMigrationName, 'utf8') <= 63, 'submission lookup migration directory must fit PostgreSQL identifier limit');
const submissionLookupMigration = readFileSync(join(root, `prisma/migrations/${submissionLookupMigrationName}/migration.sql`), 'utf8');
const retentionPgScript = readFileSync(join(root, 'scripts/tests/test-math-document-grading-retention-pg.mjs'), 'utf8');
const batch = readFileSync(join(root, 'src/lib/data-governance/math-document-grading-batch.ts'), 'utf8');
const allMathMigrations = `${migration}\n${issue916Migration}\n${lifecycleLeaseMigration}\n${reviewHardeningMigration}\n${phaseThreeMigration}\n${phaseFourMigration}\n${phaseFiveMigration}\n${phaseSixMigration}\n${reconciliationMigration}\n${p0P1Migration}\n${submissionLookupMigration}`;

function createTableSegment(sql, tableName) {
  const marker = `CREATE TABLE "${tableName}" (`;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, `migration must create ${tableName}`);
  const end = sql.indexOf('\n);', start);
  assert.notEqual(end, -1, `${tableName} CREATE TABLE segment must close`);
  return sql.slice(start, end);
}

const documentConversionTable = createTableSegment(migration, 'DocumentConversion');
const gradingBatchTable = createTableSegment(migration, 'GradingBatch');
for (const column of [
  '"conversionPolicyId" TEXT',
  '"conversionPolicySnapshot" JSONB',
  '"conversionPolicySnapshotHash" TEXT',
]) {
  assert.equal(gradingBatchTable.includes(`    ${column},`), true, `${column} must be declared on GradingBatch`);
  assert.equal(documentConversionTable.includes(`    ${column},`), false, `${column} must not be declared on DocumentConversion`);
}

assert.match(schema, /@@unique\(\[answerAttemptId, rubricId, rubricVersion, evaluatorVersion, inputHash, rerunIdentity\], map: "GradingRun_attempt_rubric_input_rerun_key"\)/);
assert.match(schema, /@@unique\(\[conversionId, code\]\)/);
assert.match(batch, /id: `grading-batch-item:\$\{batchId\}:\$\{attempt\.id\}`/s);
assert.match(migration, /GradingRun_attempt_rubric_input_rerun_key/);
assert.match(migration, /GradingConversionWarning_conversionId_code_key/);
assert.match(schema, /model GradingRequestIdempotency/);
assert.match(schema, /@@unique\(\[operation, scope, actorPseudoId, idempotencyKey\], map: "GradingRequestIdempotency_operation_scope_actor_key"\)/);
assert.match(schema, /policySnapshotHash\s+String\?/);
assert.match(migration, /GradingRequestIdempotency_operation_scope_actor_key/);
assert.match(migration, /"policySnapshot" JSONB/);
assert.match(migration, /"policySnapshotHash" TEXT/);
assert.match(schema, /conversionPolicyId\s+String\?/);
assert.match(schema, /conversionPolicySnapshot\s+Json\?/);
assert.match(schema, /conversionPolicySnapshotHash\s+String\?/);
assert.match(migration, /"conversionPolicyId" TEXT/);
assert.match(migration, /"conversionPolicySnapshot" JSONB/);
assert.match(migration, /"conversionPolicySnapshotHash" TEXT/);
assert.match(migration, /GradingBatch_conversionPolicyId_fkey/);
assert.match(migration, /ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_policyId_fkey" FOREIGN KEY \("policyId"\) REFERENCES "GradingProviderPolicy"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE;/);
assert.match(migration, /CREATE INDEX "GradingBatch_conversionPolicyId_idx" ON "GradingBatch"\("conversionPolicyId"\);/);
assert.match(migration, /ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_conversionPolicyId_fkey" FOREIGN KEY \("conversionPolicyId"\) REFERENCES "GradingProviderPolicy"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE;/);
assert.match(schema, /batches\s+GradingBatch\[\]\s+@relation\("GradingBatchGradingPolicy"\)/);
assert.match(schema, /conversionBatches\s+GradingBatch\[\]\s+@relation\("GradingBatchConversionPolicy"\)/);
assert.match(schema, /policy\s+GradingProviderPolicy\?\s+@relation\("GradingBatchGradingPolicy", fields: \[policyId\], references: \[id\], onDelete: Restrict\)/);
assert.match(schema, /conversionPolicy\s+GradingProviderPolicy\?\s+@relation\("GradingBatchConversionPolicy", fields: \[conversionPolicyId\], references: \[id\], onDelete: Restrict\)/);
assert.match(migration, /"questionSnapshot" JSONB NOT NULL/);
assert.match(migration, /"modelInputObjectKey" TEXT/);
assert.match(migration, /"modelOutputObjectKey" TEXT/);
assert.match(schema, /enum GradingTombstoneState[\s\S]*PENDING[\s\S]*RETRYABLE[\s\S]*DELETED/);
assert.match(schema, /enum GradingTombstoneState[\s\S]*BLOCKED[\s\S]*RETAINED/);
assert.match(schema, /enum GradingTombstoneState[\s\S]*DELETED_WITH_HOLD/);
assert.match(schema, /enum GradingTombstoneObjectState[\s\S]*PENDING[\s\S]*RETRYABLE[\s\S]*DELETED_WITH_HOLD[\s\S]*DELETED/);
assert.match(schema, /model GradingTombstoneObject[\s\S]*@@unique\(\[tombstoneId, objectKey\]\)/);
assert.match(schema, /enum SubmissionObjectTombstoneState[\s\S]*BLOCKED[\s\S]*RETAINED/);
assert.match(schema, /model SubmissionObjectTombstone[\s\S]*lookupKey\s+String\s+@unique/);
assert.match(schema, /retentionPolicyVersion\s+String\?/);
assert.match(schema, /retentionExpiresAt\s+DateTime\?/);
assert.match(schema, /governedRecordRule\s+String\?/);
assert.match(schema, /workerClaimToken\s+String\?/);
assert.match(schema, /rerunIdentity\s+String\?/);
assert.match(issue916Migration, /CREATE TYPE "SubmissionObjectTombstoneState" AS ENUM \('PENDING', 'RETRYABLE', 'DELETED'\)/);
assert.match(issue916Migration, /CREATE TYPE "GradingTombstoneState" AS ENUM \('PENDING', 'RETRYABLE', 'DELETED'\)/);
assert.match(issue916Migration, /"retentionExpiresAt" TIMESTAMP\(3\)/);
assert.match(issue916Migration, /"workerClaimToken" TEXT/);
assert.match(issue916Migration, /"rerunIdentity" TEXT/);
assert.match(issue916Migration, /"status" "GradingTombstoneState" NOT NULL DEFAULT 'PENDING'/);
assert.match(issue916Migration, /"physicalDeletedAt" TIMESTAMP\(3\)/);
assert.match(issue916Migration, /"status" = 'DELETED'/);
for (const [column, table] of [
  ['textSnapshotPolicyId', 'SubmissionAttempt'],
  ['retentionPolicyId', 'SubmissionAsset'],
  ['deletionClaimToken', 'SubmissionObjectTombstone'],
  ['lifecyclePolicyId', 'SubmissionObjectTombstone'],
  ['pseudonymizedAt', 'SubmissionObjectTombstone'],
  ['eventKey', 'GradingAuditEvent'],
  ['lifecyclePolicyId', 'AnswerEvidence'],
  ['lifecyclePolicyId', 'DocumentConversion'],
  ['lifecyclePolicyId', 'GradingBatch'],
  ['lifecyclePolicyId', 'GradingRun'],
  ['workerClaimToken', 'GradingJob'],
]) {
  assert.match(lifecycleLeaseMigration, new RegExp(`ALTER TABLE "${table}"[\\s\\S]*?"${column}"`), `${table}.${column} must be added by the independent hardening migration`);
}
for (const indexNameValue of [
  'GradingAuditEvent_eventKey_key',
  'SubmissionAttempt_textSnapshotExpiresAt_idx',
  'SubmissionAsset_deletionLeaseExpiresAt_idx',
  'SubmissionObjectTombstone_deletionLeaseExpiresAt_idx',
  'SubmissionObjectTombstone_lifecyclePolicyId_idx',
  'GradingTombstone_deletionLeaseExpiresAt_idx',
  'AnswerEvidence_lifecyclePolicyId_idx',
  'DocumentConversion_lifecyclePolicyId_idx',
  'GradingBatch_lifecyclePolicyId_idx',
  'GradingRun_lifecyclePolicyId_idx',
  'GradingJob_workerLeaseExpiresAt_idx',
]) {
  assert.match(lifecycleLeaseMigration, new RegExp(`(?:UNIQUE )?INDEX "${indexNameValue}"`), `${indexNameValue} must be created by the independent hardening migration`);
}
assert.match(lifecycleLeaseMigration, /SubmissionObjectTombstone_lifecyclePolicyId_fkey/);
assert.match(reviewHardeningMigration, /ALTER TYPE "SubmissionObjectTombstoneState" ADD VALUE IF NOT EXISTS 'RETAINED'/);
assert.match(reviewHardeningMigration, /ALTER TYPE "GradingTombstoneState" ADD VALUE IF NOT EXISTS 'BLOCKED'/);
assert.match(reviewHardeningMigration, /ALTER TYPE "GradingTombstoneState" ADD VALUE IF NOT EXISTS 'RETAINED'/);
for (const column of ['providerRetentionDeadlineAt', 'providerDeletionState', 'providerDeletionReason', 'providerDeletionRequestedAt', 'lineageReference']) {
  assert.match(schema, new RegExp(`${column}\\s+`), `${column} must be declared in schema`);
  assert.match(reviewHardeningMigration, new RegExp(`"${column}"`), `${column} must be added by the independent review migration`);
}
for (const [table, column] of [
  ['AnswerEvidence', 'attemptId'],
  ['DocumentConversion', 'assetId'],
  ['DocumentConversion', 'attemptId'],
  ['GradingBatch', 'questionSnapshot'],
  ['GradingBatchItem', 'answerId'],
  ['GradingRun', 'answerAttemptId'],
  ['GradingRun', 'questionSnapshot'],
  ['GradingRun', 'referenceAnswer'],
]) {
  assert.match(reviewHardeningMigration, new RegExp(`ALTER TABLE "${table}"[\\s\\S]*ALTER COLUMN "${column}" DROP NOT NULL`), `${table}.${column} must be nullable for governed redaction`);
}
for (const indexNameValue of ['GradingTombstone_status_lease_idx', 'GradingTombstone_provider_state_idx']) {
  assert.match(reviewHardeningMigration, new RegExp(`INDEX "${indexNameValue}"`), `${indexNameValue} must be created by the review migration`);
}
for (const [table, column] of [
  ['SubmissionAsset', 'redactionCount'],
  ['SubmissionObjectTombstone', 'redactionCount'],
  ['GradingAuditEvent', 'redactionCount'],
  ['GradingTombstone', 'providerRetentionSeconds'],
  ['GradingTombstone', 'redactionCount'],
]) {
  assert.match(phaseThreeMigration, new RegExp(`ALTER TABLE "${table}"[\\s\\S]*?"${column}"`), `${table}.${column} must be added by the phase-three migration`);
  assert.match(schema, new RegExp(`${column}\\s+`), `${table}.${column} must be declared in schema`);
}
for (const [table, column] of [['SubmissionAsset', 'answerId'], ['GradingBatch', 'assignmentRevisionId'], ['GradingBatch', 'classId']]) {
  assert.match(phaseThreeMigration, new RegExp(`ALTER TABLE "${table}"[\\s\\S]*ALTER COLUMN "${column}" DROP NOT NULL`), `${table}.${column} must be nullable for redaction`);
}
assert.match(phaseThreeMigration, /jsonb_build_object\(\s*'redacted', true,\s*'redactionCount'/);
assert.match(phaseThreeMigration, /"resourceId" = 'redacted:resource:' \|\| md5\("id"\)/);
assert.match(phaseThreeMigration, /"classId" = NULL/);
assert.match(phaseThreeMigration, /key NOT IN \('attempt', 'attemptNumber', 'attempts', 'retryCount', 'retryable', 'errorCode', 'error', 'state', 'status', 'outcome', 'stage', 'durationMs', 'latencyMs', 'policyVersion', 'deleteStrategy', 'blockedReason', 'provider'\)/);
assert.match(phaseThreeMigration, /'safeRuntime', jsonb_strip_nulls\(jsonb_build_object/);
assert.match(phaseThreeMigration, /'redactedFields', COALESCE\(/);
assert.match(phaseThreeMigration, /"providerRequestId" = NULL/);
assert.match(phaseThreeMigration, /"requestHash" = NULL/);
assert.doesNotMatch(phaseThreeMigration, /"metadata" = jsonb_build_object\('redacted', true, 'redactionCount', 9\)/);
const historicalAuditFixture = {
  metadata: {
    attempt: 2,
    retryable: true,
    error: 'object-store-delete-failed',
    state: 'RETRYABLE',
    policyVersion: 'v1',
    deleteStrategy: 'delete-content',
    blockedReason: 'provider-timeout',
    provider: 's3',
    requestHash: 'raw-request-hash',
    rawPrompt: 'student document text',
  },
  providerRequestId: 'provider-request-id',
  requestHash: 'raw-request-hash',
};
const safeRuntimeFields = new Set(['attempt', 'attemptNumber', 'attempts', 'retryCount', 'retryable', 'errorCode', 'error', 'state', 'status', 'outcome', 'stage', 'durationMs', 'latencyMs', 'policyVersion', 'deleteStrategy', 'blockedReason', 'provider']);
const historicalSafeRuntime = Object.fromEntries(Object.entries(historicalAuditFixture.metadata)
  .filter(([key]) => safeRuntimeFields.has(key))
  .map(([key, value]) => [key === 'error' ? 'errorCode' : key, value]));
assert.deepEqual(historicalSafeRuntime, { attempt: 2, retryable: true, errorCode: 'object-store-delete-failed', state: 'RETRYABLE', policyVersion: 'v1', deleteStrategy: 'delete-content', blockedReason: 'provider-timeout', provider: 's3' }, 'historical fixture must retain bounded retry/error semantics');
assert.equal(Object.hasOwn(historicalSafeRuntime, 'requestHash'), false, 'historical fixture must not retain raw request hashes');
assert.equal(Object.hasOwn(historicalSafeRuntime, 'rawPrompt'), false, 'historical fixture must not retain raw content markers');
const historicalAuditRedacted = { providerRequestId: null, requestHash: null, metadata: { redacted: true, redactionCount: 3, safeRuntime: historicalSafeRuntime, redactedFields: ['rawPrompt', 'requestHash'] } };
assert.equal(historicalAuditRedacted.providerRequestId, null, 'historical fixture must remove provider locators');
assert.equal(historicalAuditRedacted.requestHash, null, 'historical fixture must remove request hashes');
assert.deepEqual(historicalAuditRedacted.metadata.safeRuntime, historicalSafeRuntime, 'historical fixture must keep only the bounded safe projection');
for (const field of safeRuntimeFields) assert.equal(historicalAuditRedacted.metadata.redactedFields.includes(field), false, `${field} must not be listed as redacted when it is retained`);
assert.match(phaseThreeMigration, /"redactionCount" = GREATEST\([\s\S]*jsonb_object_keys/);
assert.match(phaseThreeMigration, /CASE WHEN "provider" IS NULL THEN 0 ELSE 1 END/);
assert.match(reconciliationMigration, /ALTER TYPE "GradingTombstoneState" ADD VALUE IF NOT EXISTS 'DELETED_WITH_HOLD'/);
assert.match(reconciliationMigration, /CREATE TYPE "GradingTombstoneObjectState" AS ENUM \([\s\S]*'DELETED_WITH_HOLD'[\s\S]*\)/);
assert.match(reconciliationMigration, /CREATE TABLE "GradingTombstoneObject"/);
assert.match(reconciliationMigration, /"GradingTombstoneObject_tombstoneId_objectKey_key"/);
assert.match(reconciliationMigration, /ON DELETE RESTRICT/);
assert.match(phaseFourMigration, /ALTER TYPE "SubmissionObjectTombstoneState" ADD VALUE IF NOT EXISTS 'BLOCKED'/);
assert.match(phaseFourMigration, /ALTER COLUMN "checksum" DROP NOT NULL/);
assert.match(phaseFourMigration, /ADD COLUMN "lineageReference" TEXT/);
for (const column of ['provider', 'providerRequestId', 'providerDeletionHandle']) {
  assert.match(schema, new RegExp(`${column}\\s+String\\?`), `${column} must be nullable in GradingTombstone`);
  assert.match(phaseFourMigration, new RegExp(`ADD COLUMN "${column}" TEXT`), `${column} must be added by phase four migration`);
}
assert.match(phaseFourMigration, /"objectKey" = 'redacted:submission-object:' \|\| md5\("objectKey"\)/);
assert.match(phaseFourMigration, /"resourceKey" = 'redacted:grading-resource:' \|\| md5\("resourceKey"\)/);
assert.match(phaseFourMigration, /"checksum" = NULL/);
assert.match(phaseFourMigration, /"providerRequestId" = NULL/);
assert.match(phaseFourMigration, /"providerDeletionHandle" = NULL/);
assert.match(phaseFiveMigration, /ALTER TYPE "SubmissionObjectTombstoneState" ADD VALUE IF NOT EXISTS 'DELETED_WITH_HOLD'/);
assert.match(phaseFiveMigration, /ALTER TYPE "SubmissionAssetState" ADD VALUE IF NOT EXISTS 'CONTENT_UNAVAILABLE'/);
for (const table of ['SubmissionAttempt', 'SubmissionAsset', 'AnswerEvidence', 'DocumentConversion', 'GradingRun', 'GradingBatch']) {
  assert.match(phaseFiveMigration, new RegExp(`ALTER TABLE "${table}"[\\s\\S]*"lifecycleBlockedAt"`), `${table} must persist lifecycleBlockedAt`);
  assert.match(phaseFiveMigration, new RegExp(`ALTER TABLE "${table}"[\\s\\S]*"lifecycleBlockReason"`), `${table} must persist lifecycleBlockReason`);
}
assert.match(schema, /model GradingRun[\s\S]*providerRequestId\s+String\?/);
assert.match(schema, /model GradingRun[\s\S]*providerDeletionHandle\s+String\?/);
assert.match(phaseFiveMigration, /ALTER TABLE "GradingRun"[\s\S]*"providerRequestId" TEXT/);
assert.match(phaseFiveMigration, /ALTER TABLE "GradingRun"[\s\S]*"providerDeletionHandle" TEXT/);
assert.match(phaseFiveMigration, /UPDATE "SubmissionObjectTombstone"[\s\S]*'DELETED_WITH_HOLD'/);
assert.doesNotMatch(phaseFiveMigration, /UPDATE "SubmissionAttempt"[\s\S]*"textSnapshot"\s*=\s*NULL/);
assert.doesNotMatch(phaseSixMigration, /"textSnapshot"\s*=\s*NULL/);
assert.match(phaseSixMigration, /"textSnapshotProviderRetentionSeconds" IS NULL/);
assert.match(phaseSixMigration, /"lifecycleProviderRetentionSeconds" IS NULL/);
for (const [table, column] of [
  ['SubmissionAttempt', 'textSnapshotGovernedRecordRule'],
  ['SubmissionAttempt', 'textSnapshotProviderRetentionSeconds'],
  ['SubmissionObjectTombstone', 'lifecycleGovernedRecordRule'],
  ['GradingTombstone', 'lifecycleGovernedRecordRule'],
  ['GradingTombstone', 'providerRetentionStartedAt'],
  ['AnswerEvidence', 'lifecycleGovernedRecordRule'],
  ['AnswerEvidence', 'lifecycleProviderRetentionSeconds'],
  ['DocumentConversion', 'lifecycleGovernedRecordRule'],
  ['DocumentConversion', 'lifecycleProviderRetentionSeconds'],
  ['DocumentConversion', 'providerRequestedAt'],
  ['DocumentConversion', 'providerProcessedAt'],
  ['GradingBatch', 'lifecycleGovernedRecordRule'],
  ['GradingBatch', 'lifecycleProviderRetentionSeconds'],
  ['GradingRun', 'lifecycleGovernedRecordRule'],
  ['GradingRun', 'lifecycleProviderRetentionSeconds'],
  ['GradingRun', 'providerRequestedAt'],
  ['GradingRun', 'providerProcessedAt'],
]) {
  assert.match(schema, new RegExp(`${column}\\s+`), `${table}.${column} must be declared in schema`);
  assert.match(phaseSixMigration, new RegExp(`ALTER TABLE "${table}"[\\s\\S]*"${column}"`), `${table}.${column} must be added by phase six`);
}
assert.match(phaseSixMigration, /GradingLifecyclePolicy_retention_contract_ck/);
assert.match(phaseSixMigration, /"retentionSeconds" IS NULL[\s\S]*"deleteStrategy" = 'retain-governed-record'[\s\S]*NULLIF\(BTRIM\("governedRecordRule"\), ''\) IS NOT NULL/);
for (const marker of [
  /UPDATE "GradingBatchItem"[\s\S]*"state" = 'BLOCKED'[\s\S]*"workerClaimToken" = NULL/,
  /UPDATE "GradingJob"[\s\S]*"state" = 'CONTENT_UNAVAILABLE'[\s\S]*"workerClaimToken" = NULL/,
  /UPDATE "GradingBatch"[\s\S]*legacy-lifecycle-content-unavailable/,
]) assert.match(phaseSixMigration, marker);
assert.match(retentionPgScript, /historical text snapshot/);
assert.match(retentionPgScript, /active grading job/);
assert.match(retentionPgScript, /workerClaimToken/);
assert.match(retentionPgScript, /before importing the repository Prisma wrapper/);
assert.match(retentionPgScript, /if \(!process\.env\.DATABASE_URL\?\.trim\(\)\)/);
assert.match(retentionPgScript, /process\.exit\(2\)/);
assert.match(retentionPgScript, /expired lease must be takeable/);
assert.match(retentionPgScript, /stale owner must not complete after takeover/);
assert.match(retentionPgScript, /lease_expires_at < proposed_expiry/);
assert.match(retentionPgScript, /DELETED_WITH_HOLD/);
assert.match(schema, /providerRetentionSeconds\s+Int\?/);
assert.match(schema, /model GradingTombstone[\s\S]*lookupKey\s+String\s+@unique/);
assert.match(p0P1Migration, /ALTER TABLE "GradingTombstone"[\s\S]*ADD COLUMN "lookupKey" TEXT/);
assert.match(p0P1Migration, /UPDATE "GradingTombstone"[\s\S]*redacted:grading-lookup:/);
assert.match(p0P1Migration, /"lookupKey" = CASE[\s\S]*WHEN "resourceKey" LIKE 'redacted:grading-resource:%'[\s\S]*substring\("resourceKey" FROM char_length\('redacted:grading-resource:'\) \+ 1\)[\s\S]*ELSE 'redacted:grading-lookup:' \|\| md5\("resourceKey"\)/);
assert.match(p0P1Migration, /GradingTombstone_lookupKey_key/);
assert.match(p0P1Migration, /"contentDeletedAt" IS NOT NULL[\s\S]*"lineageRetained" = FALSE/);
assert.match(p0P1Migration, /"resourceKey" = 'redacted:grading-operation:' \|\| md5\("resourceKey"\)/);
assert.match(p0P1Migration, /"resourceId" = 'redacted:grading-operation-id:' \|\| md5\("resourceId"\)/);
assert.match(submissionLookupMigration, /ALTER TABLE "SubmissionObjectTombstone"[\s\S]*ADD COLUMN "lookupKey" TEXT/);
assert.match(submissionLookupMigration, /"lookupKey" = CASE[\s\S]*WHEN "objectKey" LIKE 'redacted:submission-object:%'[\s\S]*substring\("objectKey" FROM char_length\('redacted:submission-object:'\) \+ 1\)[\s\S]*ELSE 'redacted:submission-lookup:' \|\| md5\("objectKey"\)/);
assert.match(submissionLookupMigration, /SubmissionObjectTombstone_lookupKey_key/);
assert.match(submissionLookupMigration, /"objectKey" = 'redacted:submission-object:' \|\| md5\("objectKey"\)/);
assert.match(schema, /answerId\s+String\?/);
assert.match(schema, /assignmentRevisionId\s+String\?/);
assert.match(schema, /classId\s+String\?/);
assert.match(phaseThreeMigration, /\("metadata"->>'errorCode'\)[\s\S]*\("metadata"->>'error'\)/);
assert.match(phaseThreeMigration, /'errorCode', CASE[\s\S]*"metadata"->>'error'/);
for (const sql of [migration, issue916Migration, lifecycleLeaseMigration, reviewHardeningMigration, phaseThreeMigration, phaseFourMigration, phaseFiveMigration, phaseSixMigration, reconciliationMigration, p0P1Migration, submissionLookupMigration]) {
  for (const match of sql.matchAll(/(?:INDEX|CONSTRAINT) "([^"]+)"/g)) {
    assert.ok(Buffer.byteLength(match[1], 'utf8') <= 63, `${match[1]} must fit PostgreSQL's 63-byte identifier limit`);
  }
}
for (const match of schema.matchAll(/map:\s*"([^"]+)"/g)) {
  assert.ok(Buffer.byteLength(match[1], 'utf8') <= 63, `${match[1]} must fit PostgreSQL's 63-byte schema identifier limit`);
}
for (const directory of readdirSync(join(root, 'prisma/migrations'))) {
  if (directory.startsWith('202607')) assert.ok(Buffer.byteLength(directory, 'utf8') <= 63, `${directory} must fit PostgreSQL's migration identifier limit`);
}

function modelSegment(source, modelName) {
  const marker = `model ${modelName} {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `schema must declare ${modelName}`);
  const nextModel = source.indexOf('\nmodel ', start + marker.length);
  const nextEnum = source.indexOf('\nenum ', start + marker.length);
  const endCandidates = [nextModel, nextEnum].filter((value) => value >= 0);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : source.length;
  return source.slice(start, end);
}

function indexName(modelName, fields) {
  return `${modelName}_${fields.map((field) => field.trim()).join('_')}_idx`;
}

const createdModels = new Set([...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map((match) => match[1]));
const migrationModels = new Set([
  ...createdModels,
  ...[...issue916Migration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...lifecycleLeaseMigration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...reviewHardeningMigration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...phaseThreeMigration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...phaseFourMigration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...phaseFiveMigration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...phaseSixMigration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...reconciliationMigration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...p0P1Migration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
  ...[...submissionLookupMigration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]),
]);
const migrationIndexNames = new Set(
  [...allMathMigrations.matchAll(/CREATE INDEX(?: IF NOT EXISTS)?\s+"([^"]+)"\s+ON\s+"([^"]+)"/g)].map((match) => `${match[2]}:${match[1]}`),
);

for (const modelName of migrationModels) {
  const segment = modelSegment(schema, modelName);
  const schemaIndexNames = new Set();
  for (const match of segment.matchAll(/@@index\(\[([^\]]+)\]([^\)]*)\)/g)) {
    const fields = match[1].split(',').map((field) => field.trim());
    const mappedName = match[2].match(/map:\s*"([^"]+)"/);
    const name = mappedName?.[1] ?? indexName(modelName, fields);
    schemaIndexNames.add(`${modelName}:${name}`);
    if (createdModels.has(modelName)) {
      assert.equal(migrationIndexNames.has(`${modelName}:${name}`), true, `${name} must be present in a math migration`);
    }
  }
  for (const indexNameValue of [...migrationIndexNames].filter((value) => value.startsWith(`${modelName}:`))) {
    assert.equal(schemaIndexNames.has(indexNameValue), true, `${indexNameValue} must be declared in schema`);
  }
}

execFileSync('npx', ['prisma', 'validate'], { cwd: root, stdio: 'inherit', env: process.env });
console.log('math-document-grading migration/schema checks passed');

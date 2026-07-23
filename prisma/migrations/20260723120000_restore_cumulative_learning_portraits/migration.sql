CREATE TYPE "LearnerFactTransitionOperation" AS ENUM ('UPSERT', 'CORRECT', 'REVOKE');
CREATE TYPE "LearnerPortraitStateKind" AS ENUM ('SNAPSHOT', 'NO_EVIDENCE');
CREATE TYPE "LearnerEvidenceRiskType" AS ENUM ('constraint', 'stagnation', 'cross_domain');
CREATE TYPE "CumulativePortraitMigrationMode" AS ENUM ('DRY_RUN', 'APPLY');
CREATE TYPE "CumulativePortraitMigrationStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "CumulativePortraitMigrationReceiptStatus" AS ENUM ('RECORDED', 'VERIFIED', 'SKIPPED', 'FAILED', 'INVALIDATED');

ALTER TABLE "GrowthRecord"
  ADD COLUMN "calculationVersion" TEXT,
  ADD COLUMN "stateGeneration" BIGINT,
  ADD COLUMN "derivedIdentity" TEXT;

ALTER TABLE "LearningMaterializationRebuildRequest"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "migrationRunId" TEXT,
  ADD COLUMN "calculationVersion" TEXT,
  ADD COLUMN "learnerGeneration" BIGINT,
  ADD COLUMN "queueGeneration" BIGINT,
  ADD COLUMN "cutoverFence" BIGINT,
  ADD COLUMN "inputDigest" TEXT;

ALTER TABLE "LearningMaterializationOutbox"
  ADD COLUMN "migrationRunId" TEXT,
  ADD COLUMN "calculationVersion" TEXT,
  ADD COLUMN "queueGeneration" BIGINT,
  ADD COLUMN "cutoverFence" BIGINT,
  ADD COLUMN "inputDigest" TEXT;

CREATE TABLE "LearnerFactTransition" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sequence" BIGINT NOT NULL,
  "factId" TEXT NOT NULL,
  "operation" "LearnerFactTransitionOperation" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "transitionPayload" JSONB,
  "sourceReference" TEXT,
  "correctionOfSequence" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearnerFactTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearnerFactTransition_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "LearnerFactTransition_correction_shape_check" CHECK (
    ("operation" = 'UPSERT' AND "correctionOfSequence" IS NULL)
    OR ("operation" IN ('CORRECT', 'REVOKE') AND "correctionOfSequence" IS NOT NULL)
  )
);

CREATE TABLE "LearnerFactTransitionSequence" (
  "userId" TEXT NOT NULL,
  "lastSequence" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearnerFactTransitionSequence_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "LearnerFactTransitionSequence_nonnegative_check" CHECK ("lastSequence" >= 0)
);

CREATE TABLE "CumulativePortraitMigrationRun" (
  "id" TEXT NOT NULL,
  "sourceDryRunId" TEXT,
  "mode" "CumulativePortraitMigrationMode" NOT NULL,
  "status" "CumulativePortraitMigrationStatus" NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "classMaterializationVersion" TEXT NOT NULL,
  "learnerGeneration" BIGINT NOT NULL,
  "classGeneration" BIGINT NOT NULL,
  "queueGeneration" BIGINT NOT NULL,
  "cutoverFence" BIGINT NOT NULL,
  "inputDigest" TEXT NOT NULL,
  "verificationDigest" TEXT,
  "summary" JSONB NOT NULL DEFAULT '{}',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CumulativePortraitMigrationRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CumulativePortraitMigrationRun_generation_check" CHECK (
    "learnerGeneration" >= 0
    AND "classGeneration" >= 0
    AND "queueGeneration" >= 0
    AND "cutoverFence" >= 0
  ),
  CONSTRAINT "CumulativePortraitMigrationRun_completion_check" CHECK (
    ("status" IN ('COMPLETED', 'FAILED') AND "completedAt" IS NOT NULL)
    OR ("status" IN ('PLANNED', 'RUNNING') AND "completedAt" IS NULL)
  )
);

CREATE TABLE "CumulativePortraitCutoverFence" (
  "id" TEXT NOT NULL,
  "fence" BIGINT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "learnerGeneration" BIGINT NOT NULL,
  "classMaterializationVersion" TEXT NOT NULL,
  "classGeneration" BIGINT NOT NULL,
  "queueGeneration" BIGINT NOT NULL,
  "activeMigrationRunId" TEXT,
  "advancedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CumulativePortraitCutoverFence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CumulativePortraitCutoverFence_singleton_check" CHECK ("id" = 'global'),
  CONSTRAINT "CumulativePortraitCutoverFence_generation_check" CHECK (
    "fence" >= 0
    AND "learnerGeneration" >= 0
    AND "classGeneration" >= 0
    AND "queueGeneration" >= 0
  )
);

CREATE TABLE "LearnerPortraitStateVersion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "generation" BIGINT NOT NULL,
  "queueGeneration" BIGINT NOT NULL,
  "stateWatermark" BIGINT NOT NULL,
  "stateKind" "LearnerPortraitStateKind" NOT NULL,
  "snapshotId" TEXT,
  "overallScore" DOUBLE PRECISION,
  "dimensionCoverage" JSONB NOT NULL,
  "evidenceAsOf" TIMESTAMP(3),
  "confidence" DOUBLE PRECISION,
  "lastTrend" TEXT,
  "lastRisk" JSONB,
  "availabilityReason" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "cutoverFence" BIGINT NOT NULL,
  "migrationRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearnerPortraitStateVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearnerPortraitStateVersion_state_shape_check" CHECK (
    ("stateKind" = 'SNAPSHOT' AND "snapshotId" IS NOT NULL)
    OR ("stateKind" = 'NO_EVIDENCE' AND "snapshotId" IS NULL)
  ),
  CONSTRAINT "LearnerPortraitStateVersion_generation_check" CHECK (
    "generation" >= 0
    AND "queueGeneration" >= 0
    AND "stateWatermark" >= 0
    AND "cutoverFence" >= 0
  )
);

CREATE TABLE "LearnerPortraitCurrentState" (
  "userId" TEXT NOT NULL,
  "stateVersionId" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "generation" BIGINT NOT NULL,
  "queueGeneration" BIGINT NOT NULL,
  "stateWatermark" BIGINT NOT NULL,
  "cutoverFence" BIGINT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearnerPortraitCurrentState_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "LearnerPortraitCurrentState_generation_check" CHECK (
    "generation" >= 0
    AND "queueGeneration" >= 0
    AND "stateWatermark" >= 0
    AND "cutoverFence" >= 0
  )
);

CREATE TABLE "LearnerEvidenceRiskState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "riskKey" TEXT NOT NULL,
  "riskType" "LearnerEvidenceRiskType" NOT NULL,
  "severity" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL,
  "supportFactIds" JSONB NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "stateGeneration" BIGINT NOT NULL,
  "sourceTransitionSequence" BIGINT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearnerEvidenceRiskState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearnerEvidenceRiskState_generation_check" CHECK (
    "stateGeneration" >= 0 AND "sourceTransitionSequence" > 0
  )
);

CREATE TABLE "GrowthRecordInvalidation" (
  "id" TEXT NOT NULL,
  "growthRecordId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "stateGeneration" BIGINT NOT NULL,
  "sourceTransitionSequence" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrowthRecordInvalidation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrowthRecordInvalidation_generation_check" CHECK (
    "stateGeneration" >= 0 AND "sourceTransitionSequence" > 0
  )
);

CREATE TABLE "ClassCumulativePortraitVersion" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "materializationVersion" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "generation" BIGINT NOT NULL,
  "queueGeneration" BIGINT NOT NULL,
  "migrationRunId" TEXT NOT NULL,
  "inputDigest" TEXT NOT NULL,
  "memberSetDigest" TEXT NOT NULL,
  "sourcePortraitVersions" JSONB NOT NULL,
  "evidenceAsOf" TIMESTAMP(3),
  "aggregateJson" JSONB NOT NULL,
  "dimensionCoverage" JSONB NOT NULL,
  "trendDistribution" JSONB NOT NULL,
  "riskDistribution" JSONB NOT NULL,
  "diagnosis" JSONB NOT NULL,
  "activeStudentCount" INTEGER NOT NULL,
  "totalStudentCount" INTEGER NOT NULL,
  "cutoverFence" BIGINT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassCumulativePortraitVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassCumulativePortraitVersion_v2_check" CHECK (
    "materializationVersion" = 'class-competency.cumulative.v2'
  ),
  CONSTRAINT "ClassCumulativePortraitVersion_counts_check" CHECK (
    "generation" >= 0
    AND "queueGeneration" >= 0
    AND "cutoverFence" >= 0
    AND "activeStudentCount" >= 0
    AND "totalStudentCount" >= 0
    AND "activeStudentCount" <= "totalStudentCount"
  )
);

CREATE TABLE "ClassCumulativePortraitCurrentState" (
  "classId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "materializationVersion" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "generation" BIGINT NOT NULL,
  "queueGeneration" BIGINT NOT NULL,
  "migrationRunId" TEXT NOT NULL,
  "inputDigest" TEXT NOT NULL,
  "cutoverFence" BIGINT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassCumulativePortraitCurrentState_pkey" PRIMARY KEY ("classId"),
  CONSTRAINT "ClassCumulativePortraitCurrentState_v2_check" CHECK (
    "materializationVersion" = 'class-competency.cumulative.v2'
  ),
  CONSTRAINT "ClassCumulativePortraitCurrentState_generation_check" CHECK (
    "generation" >= 0
    AND "queueGeneration" >= 0
    AND "cutoverFence" >= 0
  )
);

CREATE TABLE "CumulativePortraitMigrationReceipt" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "subjectKind" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" "CumulativePortraitMigrationReceiptStatus" NOT NULL,
  "inputDigest" TEXT NOT NULL,
  "counts" JSONB NOT NULL DEFAULT '{}',
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CumulativePortraitMigrationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GrowthRecord_derivedIdentity_key" ON "GrowthRecord"("derivedIdentity");
CREATE INDEX "LMRebuild_kind_run_fence_idx" ON "LearningMaterializationRebuildRequest"("kind", "migrationRunId", "cutoverFence");
CREATE INDEX "LMOutbox_cumulative_dispatch_idx" ON "LearningMaterializationOutbox"("kind", "status", "cutoverFence", "queueGeneration", "availableAt");
CREATE UNIQUE INDEX "LearnerFactTransition_userId_sequence_key" ON "LearnerFactTransition"("userId", "sequence");
CREATE INDEX "LearnerFactTransition_userId_factId_sequence_idx" ON "LearnerFactTransition"("userId", "factId", "sequence");
CREATE INDEX "LearnerFactTransition_factId_sequence_idx" ON "LearnerFactTransition"("factId", "sequence");
CREATE UNIQUE INDEX "LearnerPortraitState_user_calc_generation_watermark_key" ON "LearnerPortraitStateVersion"("userId", "calculationVersion", "generation", "stateWatermark");
CREATE INDEX "LearnerPortraitStateVersion_userId_stateWatermark_idx" ON "LearnerPortraitStateVersion"("userId", "stateWatermark");
CREATE INDEX "LearnerPortraitState_calc_generation_queue_idx" ON "LearnerPortraitStateVersion"("calculationVersion", "generation", "queueGeneration");
CREATE INDEX "LearnerPortraitState_run_generation_queue_idx" ON "LearnerPortraitStateVersion"("migrationRunId", "generation", "queueGeneration");
CREATE INDEX "LearnerPortraitStateVersion_stateKind_generatedAt_idx" ON "LearnerPortraitStateVersion"("stateKind", "generatedAt");
CREATE UNIQUE INDEX "LearnerPortraitCurrentState_stateVersionId_key" ON "LearnerPortraitCurrentState"("stateVersionId");
CREATE INDEX "LearnerPortraitCurrent_calc_generation_queue_idx" ON "LearnerPortraitCurrentState"("calculationVersion", "generation", "queueGeneration");
CREATE INDEX "LearnerPortraitCurrent_fence_queue_idx" ON "LearnerPortraitCurrentState"("cutoverFence", "queueGeneration");
CREATE UNIQUE INDEX "CumulativePortraitCutoverFence_activeMigrationRunId_key" ON "CumulativePortraitCutoverFence"("activeMigrationRunId");
CREATE UNIQUE INDEX "LearnerEvidenceRisk_user_key_transition_key" ON "LearnerEvidenceRiskState"("userId", "riskKey", "sourceTransitionSequence");
CREATE INDEX "LearnerEvidenceRiskState_userId_sourceTransitionSequence_idx" ON "LearnerEvidenceRiskState"("userId", "sourceTransitionSequence");
CREATE INDEX "LearnerEvidenceRiskState_calculationVersion_stateGeneration_idx" ON "LearnerEvidenceRiskState"("calculationVersion", "stateGeneration");
CREATE INDEX "LearnerEvidenceRiskState_riskType_isActive_idx" ON "LearnerEvidenceRiskState"("riskType", "isActive");
CREATE INDEX "CumulativePortraitMigrationRun_status_startedAt_idx" ON "CumulativePortraitMigrationRun"("status", "startedAt");
CREATE INDEX "CumulativePortraitMigrationRun_sourceDryRunId_idx" ON "CumulativePortraitMigrationRun"("sourceDryRunId");
CREATE INDEX "CumulativePortraitMigrationRun_cutoverFence_queueGeneration_idx" ON "CumulativePortraitMigrationRun"("cutoverFence", "queueGeneration");
CREATE UNIQUE INDEX "CumulativePortraitReceipt_run_stage_subject_attempt_key" ON "CumulativePortraitMigrationReceipt"("runId", "stage", "subjectKind", "subjectKey", "attempt");
CREATE UNIQUE INDEX "CumulativePortraitReceipt_success_terminal_key"
  ON "CumulativePortraitMigrationReceipt"("runId", "stage", "subjectKind", "subjectKey")
  WHERE "status" IN ('VERIFIED', 'SKIPPED');
CREATE INDEX "CumulativePortraitMigrationReceipt_runId_status_idx" ON "CumulativePortraitMigrationReceipt"("runId", "status");
CREATE UNIQUE INDEX "GrowthRecordInvalidation_growthRecordId_sourceTransitionSequence_key" ON "GrowthRecordInvalidation"("growthRecordId", "sourceTransitionSequence");
CREATE INDEX "GrowthRecordInvalidation_growthRecordId_createdAt_idx" ON "GrowthRecordInvalidation"("growthRecordId", "createdAt");
CREATE INDEX "GrowthRecordInvalidation_calculationVersion_stateGeneration_idx" ON "GrowthRecordInvalidation"("calculationVersion", "stateGeneration");
CREATE UNIQUE INDEX "ClassCumulativePortrait_class_run_input_key" ON "ClassCumulativePortraitVersion"("classId", "migrationRunId", "inputDigest");
CREATE INDEX "ClassCumulativePortrait_class_version_generation_queue_idx" ON "ClassCumulativePortraitVersion"("classId", "materializationVersion", "generation", "queueGeneration");
CREATE INDEX "ClassCumulativePortrait_run_generation_queue_idx" ON "ClassCumulativePortraitVersion"("migrationRunId", "generation", "queueGeneration");
CREATE UNIQUE INDEX "ClassCumulativePortraitCurrentState_versionId_key" ON "ClassCumulativePortraitCurrentState"("versionId");
CREATE INDEX "ClassCumulativeCurrent_version_generation_queue_idx" ON "ClassCumulativePortraitCurrentState"("materializationVersion", "generation", "queueGeneration");
CREATE INDEX "ClassCumulativeCurrent_run_fence_queue_idx" ON "ClassCumulativePortraitCurrentState"("migrationRunId", "cutoverFence", "queueGeneration");

ALTER TABLE "LearnerFactTransition"
  ADD CONSTRAINT "LearnerFactTransition_factId_fkey"
  FOREIGN KEY ("factId") REFERENCES "LearningFact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearnerPortraitStateVersion"
  ADD CONSTRAINT "LearnerPortraitStateVersion_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "StudentPortraitV2Snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearnerPortraitStateVersion"
  ADD CONSTRAINT "LearnerPortraitStateVersion_migrationRunId_fkey"
  FOREIGN KEY ("migrationRunId") REFERENCES "CumulativePortraitMigrationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearnerPortraitCurrentState"
  ADD CONSTRAINT "LearnerPortraitCurrentState_stateVersionId_fkey"
  FOREIGN KEY ("stateVersionId") REFERENCES "LearnerPortraitStateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CumulativePortraitCutoverFence"
  ADD CONSTRAINT "CumulativePortraitCutoverFence_activeMigrationRunId_fkey"
  FOREIGN KEY ("activeMigrationRunId") REFERENCES "CumulativePortraitMigrationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearnerEvidenceRiskState"
  ADD CONSTRAINT "LearnerEvidenceRiskState_userId_sourceTransitionSequence_fkey"
  FOREIGN KEY ("userId", "sourceTransitionSequence") REFERENCES "LearnerFactTransition"("userId", "sequence") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrowthRecordInvalidation"
  ADD CONSTRAINT "GrowthRecordInvalidation_growthRecordId_fkey"
  FOREIGN KEY ("growthRecordId") REFERENCES "GrowthRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrowthRecordInvalidation"
  ADD CONSTRAINT "GrowthRecordInvalidation_userId_sourceTransitionSequence_fkey"
  FOREIGN KEY ("userId", "sourceTransitionSequence") REFERENCES "LearnerFactTransition"("userId", "sequence") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassCumulativePortraitVersion"
  ADD CONSTRAINT "ClassCumulativePortraitVersion_migrationRunId_fkey"
  FOREIGN KEY ("migrationRunId") REFERENCES "CumulativePortraitMigrationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassCumulativePortraitCurrentState"
  ADD CONSTRAINT "ClassCumulativePortraitCurrentState_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ClassCumulativePortraitVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CumulativePortraitMigrationReceipt"
  ADD CONSTRAINT "CumulativePortraitMigrationReceipt_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "CumulativePortraitMigrationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CumulativePortraitCutoverFence" (
  "id",
  "fence",
  "calculationVersion",
  "learnerGeneration",
  "classMaterializationVersion",
  "classGeneration",
  "queueGeneration",
  "advancedAt",
  "updatedAt"
) VALUES (
  'global',
  0,
  'pre-cutover',
  0,
  'class-competency.cumulative.v1',
  0,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

CREATE FUNCTION "reject_cumulative_portrait_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LearnerFactTransition_immutable"
  BEFORE UPDATE OR DELETE ON "LearnerFactTransition"
  FOR EACH ROW EXECUTE FUNCTION "reject_cumulative_portrait_history_mutation"();
CREATE TRIGGER "LearnerPortraitStateVersion_immutable"
  BEFORE UPDATE OR DELETE ON "LearnerPortraitStateVersion"
  FOR EACH ROW EXECUTE FUNCTION "reject_cumulative_portrait_history_mutation"();
CREATE TRIGGER "LearnerEvidenceRiskState_immutable"
  BEFORE UPDATE OR DELETE ON "LearnerEvidenceRiskState"
  FOR EACH ROW EXECUTE FUNCTION "reject_cumulative_portrait_history_mutation"();
CREATE TRIGGER "GrowthRecordInvalidation_immutable"
  BEFORE UPDATE OR DELETE ON "GrowthRecordInvalidation"
  FOR EACH ROW EXECUTE FUNCTION "reject_cumulative_portrait_history_mutation"();
CREATE TRIGGER "ClassCumulativePortraitVersion_immutable"
  BEFORE UPDATE OR DELETE ON "ClassCumulativePortraitVersion"
  FOR EACH ROW EXECUTE FUNCTION "reject_cumulative_portrait_history_mutation"();
CREATE TRIGGER "CumulativePortraitMigrationReceipt_immutable"
  BEFORE UPDATE OR DELETE ON "CumulativePortraitMigrationReceipt"
  FOR EACH ROW EXECUTE FUNCTION "reject_cumulative_portrait_history_mutation"();

CREATE FUNCTION "validate_learner_fact_transition"() RETURNS trigger AS $$
DECLARE
  fact_user_id TEXT;
  prior_fact_id TEXT;
BEGIN
  SELECT "userId" INTO fact_user_id FROM "LearningFact" WHERE "id" = NEW."factId";
  IF fact_user_id IS DISTINCT FROM NEW."userId" THEN
    RAISE EXCEPTION 'learner fact transition user does not own fact' USING ERRCODE = '23514';
  END IF;

  IF NEW."correctionOfSequence" IS NOT NULL THEN
    SELECT "factId" INTO prior_fact_id
      FROM "LearnerFactTransition"
      WHERE "userId" = NEW."userId" AND "sequence" = NEW."correctionOfSequence";
    IF prior_fact_id IS NULL OR prior_fact_id IS DISTINCT FROM NEW."factId" THEN
      RAISE EXCEPTION 'corrected or revoked transition must reference the same learner fact' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LearnerFactTransition_validate"
  BEFORE INSERT ON "LearnerFactTransition"
  FOR EACH ROW EXECUTE FUNCTION "validate_learner_fact_transition"();

CREATE FUNCTION "validate_growth_record_invalidation"() RETURNS trigger AS $$
DECLARE
  record_user_id TEXT;
BEGIN
  SELECT "userId" INTO record_user_id FROM "GrowthRecord" WHERE "id" = NEW."growthRecordId";
  IF record_user_id IS DISTINCT FROM NEW."userId" THEN
    RAISE EXCEPTION 'growth record invalidation user does not own record' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GrowthRecordInvalidation_validate"
  BEFORE INSERT ON "GrowthRecordInvalidation"
  FOR EACH ROW EXECUTE FUNCTION "validate_growth_record_invalidation"();

CREATE FUNCTION "validate_learner_portrait_current_state"() RETURNS trigger AS $$
DECLARE
  state_row "LearnerPortraitStateVersion"%ROWTYPE;
  fence_row "CumulativePortraitCutoverFence"%ROWTYPE;
BEGIN
  SELECT * INTO state_row FROM "LearnerPortraitStateVersion" WHERE "id" = NEW."stateVersionId";
  SELECT * INTO fence_row FROM "CumulativePortraitCutoverFence" WHERE "id" = 'global';

  IF state_row."userId" IS DISTINCT FROM NEW."userId"
    OR state_row."calculationVersion" IS DISTINCT FROM NEW."calculationVersion"
    OR state_row."generation" IS DISTINCT FROM NEW."generation"
    OR state_row."queueGeneration" IS DISTINCT FROM NEW."queueGeneration"
    OR state_row."stateWatermark" IS DISTINCT FROM NEW."stateWatermark"
    OR state_row."cutoverFence" IS DISTINCT FROM NEW."cutoverFence"
    OR fence_row."fence" IS DISTINCT FROM NEW."cutoverFence"
    OR fence_row."queueGeneration" IS DISTINCT FROM NEW."queueGeneration"
  THEN
    RAISE EXCEPTION 'learner portrait current pointer failed version or cutover fence validation' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LearnerPortraitCurrentState_validate"
  BEFORE INSERT OR UPDATE ON "LearnerPortraitCurrentState"
  FOR EACH ROW EXECUTE FUNCTION "validate_learner_portrait_current_state"();

CREATE FUNCTION "validate_class_cumulative_portrait_current_state"() RETURNS trigger AS $$
DECLARE
  version_row "ClassCumulativePortraitVersion"%ROWTYPE;
  fence_row "CumulativePortraitCutoverFence"%ROWTYPE;
BEGIN
  SELECT * INTO version_row FROM "ClassCumulativePortraitVersion" WHERE "id" = NEW."versionId";
  SELECT * INTO fence_row FROM "CumulativePortraitCutoverFence" WHERE "id" = 'global';

  IF version_row."classId" IS DISTINCT FROM NEW."classId"
    OR version_row."materializationVersion" IS DISTINCT FROM NEW."materializationVersion"
    OR version_row."calculationVersion" IS DISTINCT FROM NEW."calculationVersion"
    OR version_row."generation" IS DISTINCT FROM NEW."generation"
    OR version_row."queueGeneration" IS DISTINCT FROM NEW."queueGeneration"
    OR version_row."migrationRunId" IS DISTINCT FROM NEW."migrationRunId"
    OR version_row."inputDigest" IS DISTINCT FROM NEW."inputDigest"
    OR version_row."cutoverFence" IS DISTINCT FROM NEW."cutoverFence"
    OR fence_row."fence" IS DISTINCT FROM NEW."cutoverFence"
    OR fence_row."classMaterializationVersion" IS DISTINCT FROM NEW."materializationVersion"
    OR fence_row."classGeneration" IS DISTINCT FROM NEW."generation"
    OR fence_row."queueGeneration" IS DISTINCT FROM NEW."queueGeneration"
    OR fence_row."activeMigrationRunId" IS DISTINCT FROM NEW."migrationRunId"
  THEN
    RAISE EXCEPTION 'class cumulative portrait current pointer failed publication validation' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClassCumulativePortraitCurrentState_validate"
  BEFORE INSERT OR UPDATE ON "ClassCumulativePortraitCurrentState"
  FOR EACH ROW EXECUTE FUNCTION "validate_class_cumulative_portrait_current_state"();

CREATE FUNCTION "validate_cumulative_portrait_cutover_fence"() RETURNS trigger AS $$
DECLARE
  run_row "CumulativePortraitMigrationRun"%ROWTYPE;
BEGIN
  IF NEW."fence" < OLD."fence"
    OR NEW."learnerGeneration" < OLD."learnerGeneration"
    OR NEW."classGeneration" < OLD."classGeneration"
    OR NEW."queueGeneration" < OLD."queueGeneration"
  THEN
    RAISE EXCEPTION 'cumulative portrait cutover fence and generations are monotonic' USING ERRCODE = '55000';
  END IF;

  IF NEW."activeMigrationRunId" IS NOT NULL THEN
    SELECT * INTO run_row FROM "CumulativePortraitMigrationRun" WHERE "id" = NEW."activeMigrationRunId";
    IF run_row."cutoverFence" IS DISTINCT FROM NEW."fence"
      OR run_row."calculationVersion" IS DISTINCT FROM NEW."calculationVersion"
      OR run_row."classMaterializationVersion" IS DISTINCT FROM NEW."classMaterializationVersion"
      OR run_row."learnerGeneration" IS DISTINCT FROM NEW."learnerGeneration"
      OR run_row."classGeneration" IS DISTINCT FROM NEW."classGeneration"
      OR run_row."queueGeneration" IS DISTINCT FROM NEW."queueGeneration"
    THEN
      RAISE EXCEPTION 'cutover fence does not match active migration run' USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CumulativePortraitCutoverFence_validate"
  BEFORE UPDATE ON "CumulativePortraitCutoverFence"
  FOR EACH ROW EXECUTE FUNCTION "validate_cumulative_portrait_cutover_fence"();

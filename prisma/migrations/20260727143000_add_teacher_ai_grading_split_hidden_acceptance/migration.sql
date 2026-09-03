CREATE TYPE "TeacherAiGradingLabPartition" AS ENUM ('TUNING', 'HIDDEN');
CREATE TYPE "TeacherAiGradingHiddenAcceptanceState" AS ENUM ('SEALED', 'RUNNING', 'CONSUMED');

CREATE TABLE "TeacherAiGradingLabSplit" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "tuningRatioBasisPoints" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "tuningCount" INTEGER NOT NULL,
    "hiddenCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingLabSplit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingLabSplit_version_check" CHECK ("version" > 0),
    CONSTRAINT "TeacherAiGradingLabSplit_ratio_check" CHECK ("tuningRatioBasisPoints" BETWEEN 1 AND 9999),
    CONSTRAINT "TeacherAiGradingLabSplit_count_check" CHECK (
        "sampleCount" > 1
        AND "tuningCount" > 0
        AND "hiddenCount" > 0
        AND "sampleCount" = "tuningCount" + "hiddenCount"
    )
);

CREATE TABLE "TeacherAiGradingLabSplitMember" (
    "splitId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "scoreBand" TEXT NOT NULL,
    "primaryErrorType" TEXT NOT NULL,
    "stratumKey" TEXT NOT NULL,
    "partition" "TeacherAiGradingLabPartition" NOT NULL,
    "allocationRank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingLabSplitMember_pkey" PRIMARY KEY ("splitId", "sampleId"),
    CONSTRAINT "TeacherAiGradingLabSplitMember_rank_check" CHECK ("allocationRank" > 0),
    CONSTRAINT "TeacherAiGradingLabSplitMember_label_check" CHECK (
        length("scoreBand") > 0 AND length("primaryErrorType") > 0 AND length("stratumKey") > 0
    )
);

CREATE TABLE "TeacherAiGradingHiddenAcceptance" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "state" "TeacherAiGradingHiddenAcceptanceState" NOT NULL DEFAULT 'SEALED',
    "configId" TEXT,
    "batchId" TEXT,
    "startKey" TEXT,
    "startRequestHash" TEXT,
    "startedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherAiGradingHiddenAcceptance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingHiddenAcceptance_state_shape_check" CHECK (
        (
            "state" = 'SEALED'
            AND "configId" IS NULL AND "batchId" IS NULL
            AND "startKey" IS NULL AND "startRequestHash" IS NULL
            AND "startedAt" IS NULL AND "consumedAt" IS NULL
        ) OR (
            "state" = 'RUNNING'
            AND "configId" IS NOT NULL AND "batchId" IS NOT NULL
            AND "startKey" IS NOT NULL AND "startRequestHash" IS NOT NULL
            AND "startedAt" IS NOT NULL AND "consumedAt" IS NULL
        ) OR (
            "state" = 'CONSUMED'
            AND "configId" IS NOT NULL AND "batchId" IS NOT NULL
            AND "startKey" IS NOT NULL AND "startRequestHash" IS NOT NULL
            AND "startedAt" IS NOT NULL AND "consumedAt" IS NOT NULL
        )
    )
);

CREATE TABLE "TeacherAiGradingHiddenSampleLedger" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "firstRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingHiddenSampleLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherAiGradingLabSplit_dataset_version_number_key"
ON "TeacherAiGradingLabSplit"("datasetId", "datasetVersion", "version");
CREATE UNIQUE INDEX "TeacherAiGradingLabSplit_dataset_version_content_key"
ON "TeacherAiGradingLabSplit"("datasetId", "datasetVersion", "contentHash");
CREATE INDEX "TeacherAiGradingLabSplit_dataset_version_idx"
ON "TeacherAiGradingLabSplit"("datasetId", "datasetVersion");
CREATE INDEX "TeacherAiGradingLabSplitMember_partition_idx"
ON "TeacherAiGradingLabSplitMember"("splitId", "partition");
CREATE INDEX "TeacherAiGradingLabSplitMember_stratum_partition_idx"
ON "TeacherAiGradingLabSplitMember"("splitId", "stratumKey", "partition");
CREATE UNIQUE INDEX "TeacherAiGradingHiddenAcceptance_splitId_key"
ON "TeacherAiGradingHiddenAcceptance"("splitId");
CREATE UNIQUE INDEX "TeacherAiGradingHiddenAcceptance_batchId_key"
ON "TeacherAiGradingHiddenAcceptance"("batchId");
CREATE UNIQUE INDEX "TeacherAiGradingHiddenAcceptance_startKey_key"
ON "TeacherAiGradingHiddenAcceptance"("startKey");
CREATE INDEX "TeacherAiGradingHiddenAcceptance_state_updatedAt_idx"
ON "TeacherAiGradingHiddenAcceptance"("state", "updatedAt");
CREATE INDEX "TeacherAiGradingHiddenAcceptance_configId_idx"
ON "TeacherAiGradingHiddenAcceptance"("configId");
CREATE UNIQUE INDEX "TeacherAiGradingHiddenSampleLedger_dataset_sample_key"
ON "TeacherAiGradingHiddenSampleLedger"("datasetId", "datasetVersion", "sampleId");
CREATE INDEX "TeacherAiGradingHiddenSampleLedger_splitId_idx"
ON "TeacherAiGradingHiddenSampleLedger"("splitId");
CREATE INDEX "TeacherAiGradingHiddenSampleLedger_acceptanceId_idx"
ON "TeacherAiGradingHiddenSampleLedger"("acceptanceId");

ALTER TABLE "TeacherAiGradingLabSplitMember"
ADD CONSTRAINT "TeacherAiGradingLabSplitMember_splitId_fkey"
FOREIGN KEY ("splitId") REFERENCES "TeacherAiGradingLabSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingHiddenAcceptance"
ADD CONSTRAINT "TeacherAiGradingHiddenAcceptance_splitId_fkey"
FOREIGN KEY ("splitId") REFERENCES "TeacherAiGradingLabSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingHiddenAcceptance"
ADD CONSTRAINT "TeacherAiGradingHiddenAcceptance_configId_fkey"
FOREIGN KEY ("configId") REFERENCES "TeacherAiGradingExperimentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingHiddenAcceptance"
ADD CONSTRAINT "TeacherAiGradingHiddenAcceptance_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "TeacherAiGradingExperimentBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingHiddenSampleLedger"
ADD CONSTRAINT "TeacherAiGradingHiddenSampleLedger_splitId_fkey"
FOREIGN KEY ("splitId") REFERENCES "TeacherAiGradingLabSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingHiddenSampleLedger"
ADD CONSTRAINT "TeacherAiGradingHiddenSampleLedger_acceptanceId_fkey"
FOREIGN KEY ("acceptanceId") REFERENCES "TeacherAiGradingHiddenAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_teacher_ai_grading_split_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Teacher AI grading split rows and memberships are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherAiGradingLabSplit_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingLabSplit"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_split_mutation();

CREATE TRIGGER "TeacherAiGradingLabSplitMember_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingLabSplitMember"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_split_mutation();

CREATE FUNCTION prevent_teacher_ai_grading_split_member_insert_after_acceptance() RETURNS trigger AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "TeacherAiGradingHiddenAcceptance"
        WHERE "splitId" = NEW."splitId"
    ) THEN
        RAISE EXCEPTION 'Teacher AI grading split memberships cannot be added after hidden acceptance is established';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherAiGradingLabSplitMember_freeze_after_acceptance"
BEFORE INSERT ON "TeacherAiGradingLabSplitMember"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_split_member_insert_after_acceptance();

CREATE TRIGGER "TeacherAiGradingHiddenSampleLedger_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingHiddenSampleLedger"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_split_mutation();

CREATE FUNCTION enforce_teacher_ai_grading_hidden_acceptance_transition() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Teacher AI grading hidden acceptance rows cannot be deleted';
    END IF;

    IF NEW."id" <> OLD."id" OR NEW."splitId" <> OLD."splitId" OR NEW."createdAt" <> OLD."createdAt" THEN
        RAISE EXCEPTION 'Teacher AI grading hidden acceptance identity is immutable';
    END IF;

    IF OLD."state" = 'SEALED' AND NEW."state" = 'RUNNING' THEN
        RETURN NEW;
    END IF;

    IF OLD."state" = 'RUNNING' AND NEW."state" = 'CONSUMED'
       AND NEW."configId" = OLD."configId"
       AND NEW."batchId" = OLD."batchId"
       AND NEW."startKey" = OLD."startKey"
       AND NEW."startRequestHash" = OLD."startRequestHash"
       AND NEW."startedAt" = OLD."startedAt" THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Invalid teacher AI grading hidden acceptance transition';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherAiGradingHiddenAcceptance_transition"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingHiddenAcceptance"
FOR EACH ROW EXECUTE FUNCTION enforce_teacher_ai_grading_hidden_acceptance_transition();

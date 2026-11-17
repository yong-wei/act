CREATE TABLE "SimulationEvidenceObject" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "uncompressedBytes" INTEGER,
    "storedBytes" INTEGER,
    "chunkIndex" INTEGER,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationEvidenceObject_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SimulationEvidenceObject_sizes_check" CHECK (
        ("uncompressedBytes" IS NULL OR "uncompressedBytes" BETWEEN 1 AND 4194304)
        AND ("storedBytes" IS NULL OR "storedBytes" BETWEEN 1 AND 4194304)
    )
);

CREATE UNIQUE INDEX "SimulationEvidenceObject_runId_reference_key"
ON "SimulationEvidenceObject"("runId", "reference");

CREATE INDEX "SimulationEvidenceObject_runId_purpose_chunkIndex_idx"
ON "SimulationEvidenceObject"("runId", "purpose", "chunkIndex");

ALTER TABLE "SimulationEvidenceObject" ADD CONSTRAINT "SimulationEvidenceObject_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

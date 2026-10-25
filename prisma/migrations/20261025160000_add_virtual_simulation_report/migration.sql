CREATE TABLE "VirtualSimulationReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "reportHtml" TEXT NOT NULL,
    "stepScores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualSimulationReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VirtualSimulationReport_userId_experimentKey_createdAt_idx" ON "VirtualSimulationReport"("userId", "experimentKey", "createdAt");

ALTER TABLE "VirtualSimulationReport" ADD CONSTRAINT "VirtualSimulationReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

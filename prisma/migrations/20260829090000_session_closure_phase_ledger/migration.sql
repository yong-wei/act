-- 闭包阶段台账：闭包完备性从"旁路作业成功"改为"持久化阶段回执全绿"的收敛状态机
CREATE TABLE "SessionClosurePhase" (
    "id" TEXT NOT NULL,
    "closureOutboxId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" INTEGER,
    "done" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionClosurePhase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionClosurePhase_closureOutboxId_phase_key" ON "SessionClosurePhase"("closureOutboxId", "phase");
CREATE INDEX "SessionClosurePhase_sessionId_status_idx" ON "SessionClosurePhase"("sessionId", "status");

ALTER TABLE "SessionClosurePhase" ADD CONSTRAINT "SessionClosurePhase_closureOutboxId_fkey" FOREIGN KEY ("closureOutboxId") REFERENCES "SessionClosureOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

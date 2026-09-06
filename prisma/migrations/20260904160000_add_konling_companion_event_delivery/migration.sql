-- CreateTable
-- 控灵主动陪伴：触发事件（两阶段停顿确认状态机）
-- 隐私边界：仅供控灵运行时与策略评估，不写 LearningFact、不进学生画像、不进教师投影。
CREATE TABLE "KonlingCompanionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageKind" TEXT NOT NULL,
    "pageRef" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KonlingCompanionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- 控灵主动陪伴：会话投递记录（事件级展示去重真源；resources 为治理资源卡快照）
CREATE TABLE "KonlingCompanionDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "resources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KonlingCompanionDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KonlingCompanionEvent_userId_status_createdAt_idx" ON "KonlingCompanionEvent"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "KonlingCompanionEvent_userId_eventType_createdAt_idx" ON "KonlingCompanionEvent"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "KonlingCompanionDelivery_userId_createdAt_idx" ON "KonlingCompanionDelivery"("userId", "createdAt");

-- CreateIndex（一事件最多一次投递：多标签页展示去重服务端兜底）
CREATE UNIQUE INDEX "KonlingCompanionDelivery_eventId_key" ON "KonlingCompanionDelivery"("eventId");

-- AddForeignKey
ALTER TABLE "KonlingCompanionEvent" ADD CONSTRAINT "KonlingCompanionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KonlingCompanionDelivery" ADD CONSTRAINT "KonlingCompanionDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "KonlingCompanionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KonlingCompanionDelivery" ADD CONSTRAINT "KonlingCompanionDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

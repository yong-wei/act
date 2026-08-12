-- CreateEnum
CREATE TYPE "PortfolioReflectionDraftStatus" AS ENUM ('DRAFT', 'DISCARDED');

-- CreateTable
CREATE TABLE "PortfolioReflectionDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "assignment" TEXT,
    "intent" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PortfolioReflectionDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioReflectionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioReflectionDraft_userId_idempotencyKey_key" ON "PortfolioReflectionDraft"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PortfolioReflectionDraft_userId_status_updatedAt_idx" ON "PortfolioReflectionDraft"("userId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "PortfolioReflectionDraft" ADD CONSTRAINT "PortfolioReflectionDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

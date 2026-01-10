-- CreateTable
CREATE TABLE "ControlOdysseyAiHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlOdysseyAiHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ControlOdysseyAiHistory_levelId_idx" ON "ControlOdysseyAiHistory"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlOdysseyAiHistory_userId_levelId_key" ON "ControlOdysseyAiHistory"("userId", "levelId");

-- AddForeignKey
ALTER TABLE "ControlOdysseyAiHistory" ADD CONSTRAINT "ControlOdysseyAiHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

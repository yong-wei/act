-- CreateEnum
CREATE TYPE "LessonItemType" AS ENUM ('RESOURCE', 'KNOWLEDGE_NODE');

-- AlterTable
ALTER TABLE "LessonItem"
ADD COLUMN "itemType" "LessonItemType" NOT NULL DEFAULT 'RESOURCE',
ADD COLUMN "knowledgeNodeId" TEXT,
ALTER COLUMN "resourceId" DROP NOT NULL;

-- Drop existing foreign key to allow updated referential action
ALTER TABLE "LessonItem" DROP CONSTRAINT IF EXISTS "LessonItem_resourceId_fkey";

-- AddForeignKey
ALTER TABLE "LessonItem"
ADD CONSTRAINT "LessonItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "TeachingResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LessonItem"
ADD CONSTRAINT "LessonItem_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "LessonItem_knowledgeNodeId_idx" ON "LessonItem"("knowledgeNodeId");
CREATE INDEX "LessonItem_itemType_idx" ON "LessonItem"("itemType");

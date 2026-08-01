-- Expand-only teacher preference. Lifecycle reconciliation is deployed separately.
ALTER TABLE "User" ADD COLUMN "defaultTeachingClassId" TEXT;

CREATE UNIQUE INDEX "User_defaultTeachingClassId_key"
ON "User"("defaultTeachingClassId");

ALTER TABLE "User"
ADD CONSTRAINT "User_defaultTeachingClassId_fkey"
FOREIGN KEY ("defaultTeachingClassId") REFERENCES "Class"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

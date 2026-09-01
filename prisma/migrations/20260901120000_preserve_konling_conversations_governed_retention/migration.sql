BEGIN;

-- 允许会话库记录不携带产品级到期时间；未来由全局治理显式设置
ALTER TABLE "KonlingSession"
  ALTER COLUMN "expiresAt" DROP NOT NULL;

-- 清除旧固定七天产品期限，恢复被其隐藏的可用会话库历史；
-- libraryVisible=false 的空、过期迁移候选与失败初始化会话保持排除。
-- 重复执行结果不变（幂等）。
UPDATE "KonlingSession"
SET "expiresAt" = NULL
WHERE "libraryVisible" = true
  AND "expiresAt" IS NOT NULL;

COMMIT;

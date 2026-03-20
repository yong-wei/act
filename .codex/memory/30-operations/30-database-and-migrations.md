# 数据库与迁移

状态: active
最后更新: 2026-03-19
摘要: 记录 Prisma 与 PostgreSQL 的关键运行事实，重点提醒“迁移元数据”和“真实表结构”可能不一致，以及当前数据治理相关表的真实状态。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/00-index.md)
下游:
- [50-known-deploy-risks.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/50-known-deploy-risks.md)
相关:
- [prisma/schema.prisma](/Users/YW/Documents/Site/act.just.edu.cn/prisma/schema.prisma)
- [scripts/remote-deploy.sh](/Users/YW/Documents/Site/act.just.edu.cn/scripts/remote-deploy.sh)
- [../70-workflows/40-remote-db-sync.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/40-remote-db-sync.md)

## 当前事实

- 应用使用 Prisma + PostgreSQL
- 容器启动阶段默认执行 `prisma migrate deploy`
- 远端部署脚本包含对 Prisma 失败迁移记录的自愈逻辑
- 远端数据库全量同步到本地的默认入口已固定为 `scripts/db/sync-remote-db-to-local.sh`
- 2026-03-19 对齐远端后的本地数据库计数为 `User=291`、`LearningFact=0`、`StudentCompetencySnapshot=1829`、`StudentProfileSummary=100`、`ClassCompetencySnapshot=2`、`LearningEventBatch=25`
- 在这份对齐库上，`scripts/db/backfill-learning-facts-from-event-batches.ts` 已验证能补出 `55` 条 `LearningFact`

## 需要长期记住的风险

- `_prisma_migrations` 显示已应用，不代表所有表都真的存在
- 实际表已存在，也不代表迁移元数据正确记录
- `PlatformSetting` 已经真实暴露过“代码在查表，但线上库缺表”的问题
- 数据治理相关表不能只看“有没有数据”，还要分开判断事件批次、学生快照、班级快照是否按预期同步增长

## 排障优先级

1. 先确认应用是否能连上数据库
2. 再确认关键表是否真实存在
3. 再确认 `_prisma_migrations` 是否与表结构一致
4. 最后才怀疑 Prisma Client 生成物与镜像版本不一致

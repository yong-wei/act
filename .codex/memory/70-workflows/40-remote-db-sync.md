# 远端数据库同步到本地

状态: active
最后更新: 2026-03-19
摘要: 记录“把远端数据库全量替换本地开发数据库”的确定性流程、前置约束和校验要点，避免未来重新手工拼接命令。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [../30-operations/30-database-and-migrations.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/30-database-and-migrations.md)
- [../../scripts/db/sync-remote-db-to-local.sh](/Users/YW/Documents/Site/act.just.edu.cn/scripts/db/sync-remote-db-to-local.sh)
- [../../.codex/skills/server-ops/references/database-sync.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/server-ops/references/database-sync.md)

## 结论

- 需要把远端数据库完整拉回本地时，默认只执行 `bash scripts/db/sync-remote-db-to-local.sh`
- 不再默认手工执行 `pg_dump`、`dropdb`、`createdb`、`pg_restore` 的拆分命令，除非在排查脚本本身

## 前置约束

- 执行前确认本地没有正在写库的 worker 或 scheduler，避免恢复完成后又被本地进程污染
- 脚本会先备份当前本地库，再从远端导出 dump，并重建本地 `act_obe`
- 如本机 PostgreSQL 管理用户不是当前系统用户，需要先覆写 `LOCAL_ADMIN_USER`

## 最小执行闭环

1. 停掉本地 worker/scheduler
2. 执行 `bash scripts/db/sync-remote-db-to-local.sh`
3. 记录脚本输出的本地备份路径和远端 dump 路径
4. 核对关键计数，至少看 `User`、`LearningFact`、`StudentCompetencySnapshot`、`ClassCompetencySnapshot`、`LearningEventBatch`

## 当前已验证的事实

- 2026-03-19 实测脚本可成功完成一次全量覆盖恢复
- 当次远端同步后的本地库里 `LearningFact=0`，但 `LearningEventBatch=25`，说明远端事件批次已存在、事实沉淀未完全补齐
- 在同一份对齐库上，执行事实回放脚本后可补出 `55` 条 `LearningFact`

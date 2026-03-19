# 最近摘要

状态: active
最后更新: 2026-03-19
摘要: 这是智能体初始化时优先读取的最近上下文入口，浓缩最近几次会话中最值得先知道的稳定变化、当前风险与建议下一跳。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/00-index.md)
- [README.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/README.md)
下游:
- [10-project/10-current-state.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/10-current-state.md)
- [30-operations/30-database-and-migrations.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/30-database-and-migrations.md)
- [70-workflows/40-remote-db-sync.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/40-remote-db-sync.md)
相关:
- [docs/ProjectDescription.md](/Users/YW/Documents/Site/act.just.edu.cn/docs/ProjectDescription.md)

## 最近最重要的稳定变化

- 管理员后台已调整为统一入口架构：`/admin` 只负责展示三大入口，用户管理、系统使用量统计、数据治理分别落到 `/admin/users`、`/admin/states`、`/admin/data-governance`
- 管理员统计已补齐真实数据接口 `/api/admin/system-usage`，关闭演示模式时不再因为缺少路由而 404
- 数据治理页已从英文基础计数页改为中文增强看板，管理员可以直接查看事实分布、队列健康、风险清单和快照明细
- 课堂事件到数据治理事实的归一化链路已经补齐，`lesson_submit`、`lesson_resubmit`、`session_finalize` 被登记为 core event，worker 与回放脚本都能把它们沉淀为 `LearningFact`
- 本地已形成确定性的“远端数据库全量替换开发数据库”流程，默认执行 `bash scripts/db/sync-remote-db-to-local.sh`，脚本会先备份本地库，再导出远端并重建本地库
- 本地 `.codex/skills/server-ops` 已成为当前可执行的服务器操作入口，主入口保持精简，详细分支操作放在 `references/`

## 当前需要优先记住的运行事实

- 2026-03-19 对齐远端后的数据库计数是 `User=291`、`LearningFact=0`、`StudentCompetencySnapshot=1829`、`StudentProfileSummary=100`、`ClassCompetencySnapshot=2`、`LearningEventBatch=25`
- 在这份对齐库上执行 `npx tsx scripts/db/backfill-learning-facts-from-event-batches.ts` 后，本地成功回放出 `55` 条 `LearningFact`，覆盖 `41` 个用户；再次 dry-run 为 `0`，说明回放脚本具备幂等性
- 远端数据治理链路是“部分开展”：`LearningEventBatch` 与 `StudentCompetencySnapshot` 持续增长，但 `ClassCompetencySnapshot` 只有 `2` 条，未体现出按调度器预期持续产出

## 初始化后的建议下一跳

- 若任务和课堂事件、事实沉淀、会话同步有关，先读 [10-project/10-current-state.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/10-current-state.md)
- 若任务和管理员后台入口、统计或数据治理看板有关，也先读 [10-project/10-current-state.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/10-current-state.md)
- 若任务和部署、数据库、worker、远端调查有关，先读 [30-operations/30-database-and-migrations.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/30-database-and-migrations.md)
- 若任务要直接操作远端数据库同步，先读 [70-workflows/40-remote-db-sync.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/40-remote-db-sync.md)

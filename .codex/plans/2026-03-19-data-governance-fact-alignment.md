# 数据治理事实沉淀与本地数据库对齐计划

**目标：** 修复课堂事件到 `LearningFact` 的沉淀链路，验证“本地对齐远端数据库”后是否能按预期产出事实，并将远端库全量替换本地开发库的确定性流程固化到本地 `server-ops` skill 中，暂不执行远端部署。

**范围：**
- 收口 `src/app/api/interactive/events/route.ts` 的课堂事件兼容与归一化逻辑
- 收口 `src/lib/data-governance/*` 与 `scripts/workers/data-governance-worker.ts` 的事实映射
- 验证 `scripts/db/sync-remote-db-to-local.sh` 与 `scripts/db/backfill-learning-facts-from-event-batches.ts`
- 更新 `.codex/skills/server-ops` 与 `docs/ProjectDescription.md`

## 步骤

1. 重跑 `scripts/tests/test-classroom-event-api-contract.ts` 与 `scripts/tests/test-data-governance-event-normalization.mjs`，确认当前失败点。
2. 若契约测试失败，仅修改最小必要代码并保持事件入口、事件类型注册表、worker 映射逻辑一致。
3. 运行 `npm run lint` 与 `npm run build`，确认本地修复不破坏构建。
4. 用 `bash scripts/db/sync-remote-db-to-local.sh` 检查本地数据库是否需要重新对齐远端；若已对齐，则直接记录当前状态。
5. 运行 `npx tsx scripts/db/backfill-learning-facts-from-event-batches.ts --dry-run`，确认候选事实数量与事件分布。
6. 运行 `npx tsx scripts/db/backfill-learning-facts-from-event-batches.ts` 并核对 `LearningFact`、`StudentCompetencySnapshot`、`StudentProfileSummary`、`ClassCompetencySnapshot` 现状。
7. 检查 `worker:dev`、`worker:scheduler`、脚本入口及数据库中已有快照/画像数据，判断数据治理服务是否按计划开展。
8. 基于本次数据库同步经验，收口 `.codex/skills/server-ops/SKILL.md` 与 `references/database-sync.md`，确保主入口只保留基本表述，详细流程落在 reference 中。
9. 更新 `docs/ProjectDescription.md`，记录“事件归一化 + 事实回放验证 + 数据库同步脚本化”。
10. 汇总验证结果并向用户反馈，明确当前未做远端部署。

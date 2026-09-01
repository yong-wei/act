## Why

Arena 写回和 Teacher 报告证据当前与 Learning Record materialization、队列和 raw 聚合交织在 `data-governance` 中。这样既难以判断官方提交与预览的权威边界，也容易让教师报告绕过 class-scoped read model；在 C5 明确写边界后，应把 Arena/Teacher 适配逻辑放回业务 owner。

## What Changes

- 将 Arena submission/evaluation、preview boundary 和 compact summary 适配迁移到现有 Arena domain API。
- 将 Teacher class/report evidence read adapter 迁移到现有 Teacher diagnosis/insight/report owner。
- 让两个 owner 通过现有 Learning Record writer/read ports 交换最小证据，不复制 event contract 或 raw aggregation。
- 迁移 route、worker、backfill/report script 和测试，并建立 official/preview、class scope、small-sample、privacy 的 parity 证据。
- 删除已证明无生产调用者的 data-governance business adapter；历史/审计读取器保持单独授权。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-arena-evidence-governance`: Arena owner 负责官方与预览证据适配，保持 staged/idempotent/authority boundary。
- `arena-learning-evidence-consumption`: profile/class summary 继续由后端生成，但从 Arena-owned summary/read port 读取。
- `teacher-evidence-governance`: Teacher owner 负责 class/report evidence adapter 和授权聚合。

## Impact

- Arena：`src/features/arena/evidence-writeback*.ts`、`evidence-summary.ts`、`submissions/**`、`evaluation/**`、`student/**` 及 `/api/arena/**`。
- Teacher：`src/features/teacher/diagnosis/**`、`teacher-diagnosis-report-history*`、`src/lib/diagnosis-report-delivery-evidence.ts`、`teacher-evidence-intervention-contract.ts` 与教师 routes。
- 迁移来源：`src/lib/data-governance/arena-insights.ts`、`simulation-task-*`、`teacher-evidence-governance.ts`、`teacher-attainment-scope.ts`、`control-correction-teacher-report.ts` 以及 C5 清单确认的 adapter 文件。
- 保持 Arena official result/leaderboard、Teacher class authorization、LearningFact identity、outbox/transaction、watermark 和生产选择器不变。

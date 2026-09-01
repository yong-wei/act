## Why

当前已存在 fenced current projections 和 role-safe read ports，但 profile、teacher insight、AI/Personalization 及页面附近仍有重复事实聚合、legacy snapshot/cache fallback 和历史脚本入口。在线读路径与 backfill 混在一起会让 stale projection 被 raw facts 覆盖，也会让离线修复意外改变在线画像。

## What Changes

- 将 online current projection/read port 固定为学生、教师、AI 和 Personalization 的唯一正常读取路径。
- 对重复页面聚合、legacy fallback 和无调用者 cache/backfill 入口做行为保持简化；保留仍是合法下游 read projection 的 cache。
- 将历史 backfill/materialization/report regeneration 工具分离为显式、授权、可重放且带 frozen cutoff/receipt 的离线操作。
- 让普通 backfill 不能发布 online current pointer、伪造实时 watermark 或污染 outbox；已有专用 migration/cutover contract 的例外必须显式调用并单独验证。
- 以 code-simplification skill 保存 online/status/privacy/watermark 的 before/after 证据，并删除本次造成的旧路径孤儿。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `learning-record-current-projections`: online current projection 的唯一读取路径和行为保持简化。
- `learning-record-consumers`: 普通 consumer 不得 raw fallback 或自行重建投影。
- `legacy-learning-record-projections`: legacy 聚合器与 fallback 的删除门禁绑定 online/backfill parity。
- `course-evidence-backfill-reporting`: backfill 工具与 online runtime、current pointer 权限和 receipt 分离。

## Impact

- Online projection：`src/features/learning-record/projections/**`、`consumers/**`、`src/lib/data-governance/portrait-v2-*`、`cumulative-*`、`student-evidence-feature-cache.ts`、`profile-center.ts`。
- Consumer routes：`src/app/api/user/profile/route.ts`、teacher insights/evidence、AI context、adaptive learner-state、student/teacher profile surfaces。
- 历史工具：`scripts/db/backfill-*`、`backfill-learning-facts-from-*`、`materialize-historical-learning-facts.ts`、`src/lib/data-governance/course-evidence-backfill.ts` 及相关 tests/reports。
- 不修改数据库 schema 或历史数据；不执行生产 backfill/cutover/selector 写入。

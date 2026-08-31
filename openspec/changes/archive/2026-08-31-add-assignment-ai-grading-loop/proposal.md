## Why

现有作业系统已经具备不可变发布版本、按题目提交和题目级 AI 审核，但教师不能在截止后对一份作业统一发起 AI 或人工批改，也不能以学生整份作业为单位确认并发布结果。参考答案的按时间揭示方式也无法满足“教师确认后才向对应学生揭示结果”的闭环。

## What Changes

- 为所有已发布作业提供截止后的教师一键 AI 批改和逐题人工批改；两者统一记录来源、版本和审计信息。
- 在现有 `GradingBatch`、`GradingBatchItem`、`GradingRun` 和题目级审核基础上，增加学生整份作业的评分聚合、完整性门禁、教师确认和逐份结果发布。
- 将新发布作业的答案/评分标准可见性固定为教师确认后逐份发布，保留历史 revision 的 `AT_TIME` 行为。
- 扩展学生作业状态，使未发布结果不泄露任何分数、批注、参考答案或评分标准；已发布结果以不可拆分包返回。
- 复用现有教师退回和补交机制，使截止后补交生成新提交版本并进入后续增量批改。

## Capabilities

### New Capabilities

- `assignment-grading-orchestration`: 截止后 AI/人工题目级评分、批次、失败重试、来源与作业级聚合。
- `assignment-result-release`: 教师整份作业确认、逐份发布和学生结果包可见性。

### Modified Capabilities

- `assignment-authoring-and-publication`: 新发布作业冻结教师确认发布策略并拒绝按时间揭示答案。
- `student-assignment-mission-center`: 学生作业状态和详情按结果发布包控制可见性。
- `document-rubric-grading-workbench`: 既有批次与题目级审核接入作业级确认、来源和增量批改语义。

## Impact

- 修改 `prisma/schema.prisma` 并新增数据库迁移，以保存来源、批次范围、作业聚合、确认和发布版本。
- 扩展 `src/lib/assignments/`、`src/lib/data-governance/teacher-assignment-review*`、现有评分执行服务及其授权/幂等契约。
- 增加教师作业批改控制台、学生整份作业审核入口和学生已发布结果显示。
- 新增教师批改、确认和发布 Route Handler；不新增平行应用或 AI Provider。

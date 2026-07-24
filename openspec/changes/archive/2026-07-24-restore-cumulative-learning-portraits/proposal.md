## Why

学生端、教师个体学情和班级整体学情目前仍混用累计画像、近 30 天画像及专项学习目标投影，导致已有学习事实的学生仍出现“无证据”“待生成”、空趋势、空风险和空班级对比。Issue #989 已锁定删除近期画像口径，统一由全部有效学习事实形成一套累计画像，使个人和班级页面稳定显示已有数据。

## What Changes

- 将七维画像、总体等级、趋势、风险和置信度统一为学生级累计状态；没有新证据时保留最后有效状态，不再因日历窗口或时间衰减隐藏、重置或降低结果。
- 删除近期画像 API/UI、`scope=recent` 以及所有 30 天画像、风险、趋势和诊断兼容计算；显式传入已删除范围时返回不支持的范围错误，不得静默映射到累计口径。
- 同一学生的合格学习事实按稳定顺序逐条增量折叠；更正、撤销、迟到事实和规则变更只对受影响学生执行有界重建，worker 批次只并行不同学生。
- 通过 Prisma migration 新增持久化的 append-only 事实转换 journal、累计快照 current pointer/no-evidence tombstone、成长事件失效记录、班级发布世代及迁移回执；这是 #989 切换所需的最小持久化合同，不建立新画像架构。
- 保留 `StudentPortraitV2Snapshot` 为不可变累计画像历史；计算版本、水位线、撤销导致的 no-evidence 结果和 current pointer 只决定当前可见状态，不物理删除旧快照、事实转换或审计记录。
- 累计迁移不生成 `participation` 或 `ai_misuse` 风险；旧记录仅保留审计且不进入新累计读取。`constraint` 风险只由支持事实的更正或撤销解除，`stagnation` 与 `cross_domain` 只按确定性事实和 portrait 条件重算。
- 学生端与教师个体页读取同一规范累计画像，并显示整体诊断、优势、待提升点、累计证据、最新活动、最后趋势、最后风险和成长档案摘要；角色差异只控制敏感字段可见性。
- 班级画像等权聚合当前成员的累计画像、最后趋势和最后风险，不按入班时间或事实来源班级截断；成员变化只更新聚合集合。
- 以新的不可变 `class-competency.cumulative.v2` 物化累计班级画像；已归档前置变更中的 `class-competency.cumulative.v1` 不足以承载累计趋势、风险、诊断和覆盖合同，只作为迁移前历史数据，不参与新版本读取。
- 学生或获授权教师可以触发幂等画像对账；班级对账仍以学生为独立处理单元，只处理尚未进入画像的事实。
- 对既有学生执行一次可验证的累计画像重建和班级聚合回填，清除旧窗口与时间衰减结果并以全局 cutover fence 使 BullMQ 中旧版本 pending、retry、delayed 和 in-flight 任务失效；上线采用本地生产数据副本演练、停服备份、同一迁移执行、持久化回执核验和失败恢复旧数据库与旧版本。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adaptive-learner-state-service`: 将 portrait v2 明确为不随时间衰减的累计状态，补充确定性事实级增量、受影响学生有界重建、幂等对账和旧队列失效合同。
- `cumulative-learner-attainment-backfill`: 以不可变 `class-competency.cumulative.v2` 取代不足以表达累计趋势、风险和诊断的 v1 物化，并锁定停服迁移、核验和恢复边界。
- `teacher-evidence-governance`: 删除近期范围 API 与兼容画像；教师个体学情读取当前成员的完整累计画像与可见历史摘要，班级学情聚合当前成员而不按班级时间截断。
- `role-based-learning-diagnosis`: 个人和班级顶层诊断统一覆盖七个能力维度，并保留最后证据触发的趋势与风险；专项诊断不再替代整体诊断。
- `adaptive-learning-center-ui`: 学生画像和成长页面只显示累计画像、累计证据及明确的不可用原因，不再提供近期画像界面。

## Impact

- 影响 learner-state 增量处理、画像快照和班级聚合读模型。
- 影响学生画像/成长页面、教师学生详情、教师班级学情及其 API。
- 需要 Prisma schema/data migration、一次本地生产数据副本演练和停服生产迁移；迁移、应用、worker 与 scheduler 使用同一版本，失败恢复可验证备份和旧版本。
- 不恢复任何 stash，不改写原始 LearningFact、事实来源、知识修订或现有成员授权边界。
- 不引入在线双版本画像读取、班级事实复制、全库日常重算、AI 自主诊断或新的证据来源。

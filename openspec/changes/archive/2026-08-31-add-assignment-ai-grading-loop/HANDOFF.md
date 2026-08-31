# 教师作业 AI/人工批改闭环交接

## 1. 目标

本变更实现正式业务闭环：

教师发布作业与评分标准 → 学生按题目提交 → 截止后教师一键 AI 批改或人工批改 → 题目级评分、学生整份聚合 → 教师确认 → 逐份发布 → 学生看到最终分数、确认后的批注、参考答案和评分标准。

当前目标是流程闭环，不是解决 Qwen 的评分质量问题。答题记录只用于本地人工分数对比，不上传，不进入模型上下文、ZIP 或 Git。用户已确认相关数据均已脱敏。

## 2. 已确认的业务决策

### 批改时机与范围

- 教师在作业截止后主动点击一键 AI 批改。
- 截止前禁止 AI 批改和人工批改；学生提交不触发自动批改，截止时间不自动触发定时批改。
- 默认处理该作业下所有已提交且待批改的学生，教师启动前可以排除学生。
- 从未提交整份作业的学生不进入 AI 批改；已提交但缺题的学生进入范围并保留待教师确认状态。

### 提交与补交

- 复用现有按题目提交模型，学生提交文本或题目附件，不新增整份 Word 上传协议。
- 补交只能在原作业截止时间到达后，通过现有教师退回与新截止时间机制授权；截止前不提供补交路径。
- 补交生成新提交版本，旧提交、批次、评分、发布结果和退回原因全部保留。
- 补交不自动加入旧批次；再次一键批改只处理新增且尚未批改的版本。

### AI 与人工批改

- 所有作业同时支持 AI 批改和人工批改，不增加作业级 AI 开关。
- 教师可以完全人工批改，也可以先 AI 再人工修改。
- AI 失败题目可以显式重试；重试仍失败可以转人工。
- 人工批改必须建立来源为 `MANUAL` 的评分记录，包含教师操作者、分数、批注、版本和时间，不伪造 Provider 调用。
- AI 与人工结果共用作业级聚合、确认和发布流程。
- 人工修改后的结果优先于后续 AI 结果，后续 AI 不得覆盖已确认结果。

### 粒度与完整性

- 评分执行和教师修改粒度是题目级。
- 教师确认和学生发布粒度是学生整份作业级。
- 每道题必须有 AI 评分、人工评分或教师明确的未作答/不计分等结论，整份作业才能确认发布。
- 缺题不能自动计零；单题失败不阻塞其他题目，但会阻塞该学生整份作业发布，直到重试、人工评分或明确结论。

### 发布与可见性

- AI 完成后不能直接对学生公开，必须经教师逐份确认。
- 已确认学生可以先发布，不要求整班全部完成；其他学生失败或待处理不阻塞该学生。
- 学生可见内容绑定为一个不可拆分发布包：最终分数、教师确认后的批注、参考答案、评分标准。
- AI 原始分数、AI 原始批注、失败信息和教师修改历史只对教师与审计可见。
- 未发布学生在平台内不能访问参考答案和评分标准；平台外转发风险已接受。

### 评分标准与答案

- 教师先编辑草稿；作业发布时冻结题干、参考答案、题目结构和结构化评分标准。
- AI 批改只使用发布时冻结的版本，不读取最新草稿。
- 新发布作业不使用按时间自动揭示答案；答案和评分标准只能随该学生的教师确认结果逐份发布。
- 历史作业保留既有 `AT_TIME` 行为，不做迁移，不改变历史语义。

## 3. 当前代码事实

### 教师发布

- 作业发布入口位于 `src/app/api/teacher/assignments/route.ts`、`src/app/api/teacher/assignments/[assignmentId]/route.ts` 和 `src/app/api/teacher/assignments/[assignmentId]/publish/route.ts`。
- 当前发布已经冻结题目、参考答案和量规快照，并已有题目量规完整性校验。
- 当前 `solutionReleasePolicy` 支持 `PRIVATE` 和 `AT_TIME` 等历史策略，新闭环需要在发布服务层区分历史 revision 与新发布 revision。

### 学生提交

- 学生入口位于 `src/app/api/student/assignments/route.ts`、`src/app/api/student/assignments/[assignmentId]/route.ts`。
- 按题目提交入口为 `answers/[questionId]/submit`、`upload-sign` 和 `finalize`。
- 整份作业上传接口明确返回 `whole-assignment-submission-unsupported`，应继续保持该边界。
- 学生提交和补交状态机已经存在，优先扩展而不是新建第二套提交模型。

### 教师审核与发布

- 现有审核入口位于 `src/app/api/teacher/assignments/[assignmentId]/submissions/route.ts` 及其 `review`、`approve`、`release`、`return` 子路由。
- 现有 `TeacherAssignmentReview` 依赖 `gradingRunId`，纯人工批改目前缺少明确的 `MANUAL` 评分运行记录入口。
- 现有审核接口偏题目级，新需求要求在其上增加学生整份作业聚合、确认和逐份发布门禁。
- 现有发布 outbox/派生产物链路需要保留，不应绕过正式发布服务直接写学生可见结果。

### 数据模型

- 主要模型位于 `prisma/schema.prisma`：`Assignment`、`AssignmentRevision`、`AssignmentQuestion`、`AssignmentSubmission`、`SubmissionAnswer`、`GradingRun`、`TeacherAssignmentReview`。
- 数据库变更必须配套 Prisma migration、回填/兼容策略和真实数据库测试。
- 评分模型需支持来源 `AI`/`MANUAL`、批次与提交版本绑定、历史尝试保留、题目失败状态、作业级聚合和发布包版本。

### 现有 AI 能力

- 现有 AI Provider、文档转换、脱敏和 `GradingRun` 能力位于 `src/lib/data-governance/` 及相关评分服务。
- 新闭环必须复用 ACT 现有 Provider，不创建实验专用 Provider。
- Provider 调用只发送评分所需内容、冻结评分标准、参考答案和脱敏学生答案；脱敏门禁未通过时必须拒绝调用。

## 4. 推荐实施顺序

1. 先完成 OpenSpec 设计和数据库契约，避免在现有题目级审核模型上直接堆叠不可逆状态。
2. 先锁定新作业发布策略和冻结快照，再接截止门禁；否则学生端答案可见性会与批改版本脱钩。
3. 先实现 `MANUAL` 评分记录，再接 AI 批次；两者共用聚合、确认和发布流程。
4. 先实现服务层状态机和幂等，再接 Route Handler 与教师/学生页面。
5. 最后加入补交增量批改，确认旧版本不会被新批次覆盖。

## 5. 不得改变的边界

- 不修改评测实验 `add-teacher-ai-grading-lab` 的历史结果、隐藏集状态和数据治理结论。
- 不把正式作业提交数据复制到评测 ZIP 或评测专用数据根目录。
- 不把答题记录上传给 Provider；其用途仅为本地人工分数对比。
- 不创建平行 assignment/submission/grading 应用、数据库或 Provider。
- 不因为当前模型评分质量不稳定而阻塞业务闭环实现；质量问题单独记录为后续工作。
- 不宣称评测首轮通过；现有正式调优报告仍为 `fail`，隐藏集仍保持 `SEALED`。
- 所有 UI 变更只在既有教师作业、教师审核和学生作业页面内扩展，必须复用原有布局、组件、状态表达、交互模式和响应式行为，不建立独立视觉体系。

## 6. 实施验收场景

至少完成以下端到端场景：

1. 教师创建含参考答案和结构化评分标准的作业，使用新确认发布策略发布；尝试 `AT_TIME` 时被拒绝。
2. 学生按题目提交文本和附件；截止前不能批改，截止后进入待批改列表。
3. 教师一键 AI 批改两名学生；一名学生存在单题失败时，其他题目仍完成，失败题可重试或转人工。
4. 教师对另一名学生完全人工批改，系统记录 `MANUAL` 来源且没有 Provider 调用。
5. 教师修改 AI 结果，确认整份作业后逐份发布；未确认学生仍看不到分数、批注、答案和评分标准。
6. 已发布学生看到四项绑定结果；其他学生的失败不影响该学生查看。
7. 教师退回一名学生并授权补交；补交形成新版本，旧结果保留，再次一键批改只处理新版本。
8. 历史 `AT_TIME` 作业仍按原策略揭示参考答案。

## 7. 当前工作区注意事项

工作区已有评测相关未提交改动及 `add-teacher-ai-grading-lab` 文件。实施本变更时只修改正式业务闭环相关文件，不重置、覆盖或清理其他改动。答题记录和真实学生内容继续留在受控本地目录，不写入公开文档。

## 8. 阶段交付与审核门禁

- 每完成一个阶段，先在 `tasks.md` 勾选实际完成项，并在本文件补充修改文件、行为变化、测试命令与结果、残余风险和下一阶段前置条件。
- 上述记录完成后，主线程必须派发一个独立、只读的 `Sol high` 子代理审核。审核范围仅限该阶段的变更、关联契约和验证证据；审核代理不编辑代码、不扩大范围。
- 主线程对每项审核发现记录 `ACCEPT`、`REJECT` 或 `DEFER`。已接受的阻塞问题须修复并完成一次限定复审；复审通过前不得开始下一阶段。
- 无阻塞问题的审核结论也必须记录审核范围、结论、模型和证据，作为进入下一阶段的门禁凭据。

## 9. 当前状态

- 需求访谈完成，核心决策已确认。
- 阶段 0 已完成：核对了 `AssignmentRevision`/`AssignmentQuestion` 发布快照、按题目 `SubmissionAttempt`、`GradingBatch`/`GradingRun`、题目级 `TeacherAssignmentReview`/审批快照/outbox，以及教师与学生现有 Route Handler。
- 阶段 0 产物：`proposal.md`、`design.md`，以及 `assignment-grading-orchestration`、`assignment-result-release` 两项新能力和三项既有能力 delta。设计明确了 `AI`/`MANUAL` 来源、作业级操作/聚合/发布模型、截止门禁、历史 `AT_TIME` 兼容、错误码与审计字段。
- 阶段 0 验证：`rtk openspec validate add-assignment-ai-grading-loop --type change --strict` 通过；`rtk rg -n '[\t ]+$' openspec/changes/add-assignment-ai-grading-loop` 未返回尾随空白；`rtk git diff --check` 通过，但只覆盖已跟踪差异，不能作为未跟踪 OpenSpec 文件的内容检查。未修改业务代码、数据库 schema 或既有评测变更。用户新增的 UI 风格一致性约束已写入任务和设计，审核结论须覆盖该约束。
- 阶段 0 残余风险：现有题目级 `TeacherAssignmentReview`/审批快照/outbox 与新作业级结果表之间的外键和派生产物门槛，须在阶段 3–5 实施前以真实 Prisma 约束细化；不得绕过现有反馈派生链路。
- 下一阶段前置条件：独立 `Sol high` 审核阶段 0 的 OpenSpec 产物、现有契约保留和范围一致性。审核通过后才开始阶段 1。

## 10. 阶段 0 审核记录

- 审核代理：独立只读 `gpt-5.6-sol high`，代理 ID `019ffbb2-fa47-7951-91bb-5bdeefc2d94c`。
- 初审结论：不通过；无 P0，报告 5 项 P1、2 项 P2。
- 裁定：P1-1（学生状态 delta 丢失 conversion/approval 触发条件）`ACCEPT`；P1-2（题目级 feedback release 可绕过整份发布）`ACCEPT`；P1-3（整份提交版本身份不足）`ACCEPT`；P1-4（多 audience 截止语义不明）`ACCEPT`；P1-5（UI 一致性）`REJECT`，因为该 finding 基于 UI 约束补写前快照，当前文档已明确复用既有 UI；P2-6（状态名称与 Prisma enum 不一致）`ACCEPT`；P2-7（未跟踪文件上的 diff check 覆盖不足）`ACCEPT`。
- 已完成一次限定修复：补回学生状态的既有 conversion/approval 触发条件；规定新作业题目级 feedback outbox 只能准备派生产物，学生可见性绑定作业级 release；设计不可变 `AssignmentSubmissionSnapshot`/题目 attempt 向量与 hash；按 submission 冻结 audience 原截止时间判定资格；明确 `GradingBatchItemState`、`GradingRunState` 与新作业级 operation/result 状态的映射；将 UI 一致性写入 design、tasks 和 HANDOFF；以 OpenSpec strict 和未跟踪文档尾随空白扫描记录阶段 0 内容验证。
- 限定复审：通过，无剩余 P0/P1。复审确认上述接受项均关闭，且 UI 一致性已落实。剩余 P2（未跟踪文件验证记录）已接受并在本条目中修正；它不触发第二轮复审。
- 阶段 1 放行：是。下一阶段仅实现新发布作业的确认发布策略、冻结输入和按 audience 原截止时间的发布基线，不提前实现 AI/人工批改或学生结果发布。

## 11. 阶段 1 实施记录

- 阶段 1 已完成：新草稿使用 `TEACHER_CONFIRMED_RESULT`；发布服务拒绝新 revision 的 `PRIVATE`/`AT_TIME` 策略，错误为 `assignment-solution-release-policy-invalid:teacher-confirmed-result-required`。
- 发布前的题干、参考答案、结构化量规、分值、量规合计、题目顺序和内容摘要继续由领域 schema、发布分值校验、服务器题目快照和事务冻结共同保证；发布后 revision 只读。
- 历史冻结 revision 不迁移；学生投影继续按历史 `AT_TIME` 策略读取答案。历史作业创建新草稿时，服务层将新草稿归一化为确认后发布策略。
- 教师编辑页沿用现有发布区域、边框、间距、颜色和响应式布局，移除按时揭示控件，改为说明截止后可选 AI/人工批改，教师确认后逐份发布分数、批注、参考答案和评分标准。
- `AssignmentSubmission` 新增不可变 `frozenAudienceDueAt`；迁移先按现有 audience 回填，再设为非空。新提交创建时同时冻结 audience 班级和原截止时间。
- 阶段 1 验证：`rtk npx vitest run src/lib/__tests__/assignment-domain.test.ts src/lib/__tests__/assignment-service.test.ts src/features/assignment-authoring/__tests__/assignment-ui-contracts.test.ts` 通过（3 文件、50 测试）；`rtk npx prisma validate`、`rtk npx prisma generate`、`rtk git diff --check` 通过。
- 全量 `rtk npm run typecheck` 首次因 Node 堆内存耗尽；提高堆上限后仍被既有 AI 评分实验室文件的 4 个 TypeScript 错误阻断，错误不涉及本阶段改动文件，未修改这些既有评测变更。
- 阶段 1 待审核：启动独立只读 `gpt-5.6-sol high` 审核，范围限定为阶段 1 新增/修改文件、阶段 1 任务和相关 OpenSpec 约束；审核通过后进入阶段 2。

## 12. 阶段 1 审核门禁状态

- 已启动独立只读 `gpt-5.6-sol high` 审核代理 `019ffbf8-fbce-7641-a5eb-aad5572dce2f`。
- 审核代理长时间保持运行且未返回任何 finding 或结论；主线程已发送收束请求，仍无响应，随后安全关闭代理。
- 因缺少独立审核结论，阶段 1 不标记为审核通过，阶段 2 不得开始。实现和验证结果保留，后续应重新启动独立高强度审核后再放行。

## 13. 阶段 1 独立复审记录

- 复审代理：独立只读 `gpt-5.6-sol high`，代理 ID `019ffc1c-fb3c-7cc1-8464-b766e282b8a5`。
- 复审结论：无 P0/P1；报告 1 项 P2，认为新建/更新草稿接口仍可保存 `PRIVATE`/`AT_TIME`。
- 裁定：P2 `REJECT`。草稿允许未完整策略是既有编辑模型的一部分，且不产生 audience 或学生可见性；唯一发布入口 `publishAssignmentRevision` 在同一事务冻结 revision 前强制拒绝所有非 `TEACHER_CONFIRMED_RESULT` 策略。审核报告也明确该 concern 仅在发布入口没有 fail-closed 校验时成立，而当前代码和定向测试已提供相反证据。
- 阶段 1 审核通过：是。阶段 2 放行：是。阶段 2 只处理按题提交、截止与补交控制；不得提前接入批改执行、聚合确认或学生结果发布。

## 14. 阶段 2 实施记录

- 复用现有按题目文本提交、附件签名上传和附件 finalize 接口；整份 Word 上传仍明确拒绝。
- 学生提交沿用已发布 revision、audience、截止时间和现有 attempt/version/idempotency 链路；缺题保持未提交状态，不在提交层自动计零。
- `AssignmentSubmission.frozenAudienceDueAt` 保存学生提交时的原始 audience 截止时间，教师补交授权以该冻结值为准，避免后续修改 audience 截止时间改变历史资格。
- `returnTeacherAssignmentReview` 要求当前时间严格晚于原截止时间，且补交新截止时间同时晚于原截止时间和当前时间；截止前授权返回 `teacher-review-resubmission-before-deadline`，新截止时间无效返回 `teacher-review-resubmission-deadline-invalid`。
- 阶段 2 新增截止前授权失败、补交截止时间不延长失败测试，并保留原有补交成功与幂等冲突测试。
- 定向验证：`rtk npx vitest run src/lib/data-governance/__tests__/teacher-assignment-review.test.ts src/lib/__tests__/submission-service.test.ts src/lib/__tests__/submission-service.real-db.integration.test.ts`，结果为 `23 passed`、`4 skipped`（数据库集成测试因环境跳过）。
- `rtk npx openspec validate add-assignment-ai-grading-loop --type change --strict` 通过；`rtk git diff --check` 通过。
- 阶段 2 尚未进入批改执行、批次聚合、教师确认或学生结果发布；阶段 3 必须在本阶段独立高强度审核通过后开始。

## 15. 阶段 2 独立审核门禁

- 待审核代理：独立只读 `gpt-5.6-sol high`。
- 审核范围：阶段 2 代码变更、`tasks.md` 勾选项、截止时间冻结迁移、提交/补交约束及阶段 2 验证证据。
- 审核要求：代理不得编辑文件；主线逐项裁定 finding 为 `ACCEPT`、`REJECT` 或 `DEFER`。只有无阻塞问题或完成一次限定修复并复审通过后，才能开始阶段 3。

## 16. 阶段 2 审核状态

- 独立只读 `gpt-5.6-sol high` 审核发现 1 项 P2：缺少“恰好原截止时间”和“新截止时间晚于原截止但不晚于当前时间”的边界测试。该 finding 已裁定为 `ACCEPT`，已补充两项测试。
- 针对性复审结论：通过；无 P0/P1/P2 遗留问题。阶段 2 审核通过，阶段 3 放行。
- 修复后验证：`teacher-assignment-review.test.ts` 为 `25/25`；OpenSpec strict 和 `git diff --check` 通过。

## 17. 当前工作阶段

- 阶段 3：截止后批改执行。
- 范围：评分来源 `AI`/`MANUAL`、教师一键 AI 批改、按题目独立失败与重试、人工批改、批次幂等和脱敏门禁。
- 不在本阶段提前实现作业聚合确认或学生结果发布；这些属于阶段 4 和阶段 5。

## 18. 阶段 3 实施进度

- 已完成评分来源 `AI`/`MANUAL`：`GradingRun.source` 新增 Prisma 枚举和迁移；人工运行由教师入口创建，不创建 Provider Job，教师操作者和复核时间继续由 `TeacherAssignmentReview` 记录。
- 已完成作业级一键批改编排：按已截止 audience 分组，默认选择已提交且未进入活动/已确认运行的学生，支持 `studentIds` 和 `excludedStudentIds`；每道题复用现有 `GradingBatch`，题目失败不会阻断其他题目。
- 已完成 Route Handler：`POST /api/teacher/assignments/[assignmentId]/grading`、`/grading/manual` 和题目失败重试入口；均复用现有教师鉴权、CSRF/限流、Zod 输入校验和幂等键。
- 已完成 Provider 调用前的现有脱敏与最小数据投影链路复用；本阶段未改变 Provider 评分方式。
- 定向测试：编排、批次、教师审核共 `47/47` 通过；受影响 ESLint 通过。高堆全量 typecheck 仍被仓库既有 5 个错误阻断，新增文件未产生类型错误。
- 尚未完成：整份不可变提交快照/attempt-vector 持久化、题目反馈 outbox 的作业级门禁，以及阶段 3 全量边界/并发/Provider 脱敏回归；阶段 3 尚未进入审核门禁。

## 19. 阶段 3 完成记录（待独立审核）

- 新增 `AssignmentGradingOperation`、`AssignmentSubmissionSnapshot` 和 `AssignmentSubmissionSnapshotItem`，并将题目级 `GradingBatch` 关联到发起操作。操作持久化请求哈希、幂等键、选择范围、冻结 audience、原截止时间、每题当前 attempt 和稳定 attempt-vector hash；缺题以空 attempt 项保留，不自动计零。
- 一键 AI 批改先创建或重放不可变操作快照，再仅向题目批次传递快照内的 `attemptIds`。补交或后续提交不会插入已创建操作；同一操作者复用幂等键但请求范围变化时返回 `assignment-grading-operation-conflict`，Route Handler 映射为 `409`。
- `GradingBatch` 的请求哈希和去重键包含固定 attempt IDs 与操作 ID；运行时仍保留既有活动/已确认运行排除和题目失败隔离。操作执行时记录 `QUEUED → RUNNING → SUCCEEDED/PARTIAL`，但不改变历史评分运行。
- 新确认发布策略的 `RELEASE_STUDENT_FEEDBACK` outbox 命令携带 `assignmentResultReleaseGate`。派生产物准备就绪后命令可成功完成，但不写入 `TeacherAssignmentFeedbackRelease`，因此不会改变学生可见性；历史 revision 继续按原题目级反馈释放路径运行。阶段 5 将以作业级发布包消费这些派生产物。
- 阶段 3 新增/调整的验证覆盖：冻结当前 attempt 与缺题、冻结 audience 截止、操作幂等重放、相同幂等键的范围冲突、按题失败隔离、人工 `MANUAL` 来源、截止门禁、题目级 retry、Provider 脱敏和新策略下 outbox 不创建学生反馈释放记录。
- 验证结果：`rtk npx prisma validate`、`rtk npx prisma generate`、`rtk npx vitest run src/lib/data-governance/__tests__/assignment-grading-orchestration.test.ts src/lib/data-governance/__tests__/teacher-assignment-review-outbox.test.ts src/lib/data-governance/__tests__/math-document-grading-batch.test.ts src/lib/data-governance/__tests__/teacher-assignment-review.test.ts`（4 文件、65 测试）及受影响 ESLint、`rtk git diff --check`、OpenSpec strict 均通过。
- 高堆 `rtk cmd /c "set NODE_OPTIONS=--max-old-space-size=8192&& npx tsc --noEmit"` 仍报告 5 个既有 AI 评分实验室类型错误：`src/app/api/teacher/ai-grading-lab/overview/__tests__/route.test.ts`、`src/lib/__tests__/submission-service.real-db.integration.test.ts`、`src/lib/data-governance/__tests__/teacher-ai-grading-lab-metrics.test.ts`、`src/lib/data-governance/math-document-grading-evaluator.ts`、`src/lib/data-governance/teacher-ai-grading-lab-overview.ts`。新增阶段 3 文件未出现在错误中，未越界修复。
- 阶段 3 尚未审核通过。下一步必须启动独立、只读 `gpt-5.6-sol high` 审核，范围限定为阶段 3 实现、任务勾选、迁移和验证证据；通过后才能开始阶段 4。

## 20. 阶段 3 审核修复记录

- 独立只读 `gpt-5.6-sol high` 审核代理 `019ffe70-f2c6-7623-85ad-e1b13917fbab` 初审结论为不通过，报告 1 项 P1：操作快照某题没有 attempt 时，编排传递空 `attemptIds`，而题目批次将空数组当作未提供筛选条件，重放窗口可能把后续新 attempt 纳入旧操作。
- 裁定：`ACCEPT`。该路径可由缺题后补交或首次批次创建失败后的同键重放触发，直接违反不可变 attempt-vector 和补交不混入旧批次的阶段 3 契约。
- 已完成一次限定修复：`findEligibleQuestionAttempts` 现在区分 `undefined` 与显式 `[]`；前者保持历史按学生筛选，后者持久化为 `id IN []` 并产生零候选。新增回归测试模拟空快照题目之后出现新 attempt，断言旧批次仍无 item。
- 修复后验证：上述阶段 3 定向 Vitest 为 4 文件、66 测试全部通过；受影响 ESLint、`rtk npx prisma validate` 和 `rtk git diff --check` 通过。
- 下一步：仅针对该接受项启动一次独立只读 `gpt-5.6-sol high` 限定复审；复审通过后记录阶段 3 审核放行，再进入阶段 4。

## 21. 阶段 3 审核放行

- 限定复审代理：独立只读 `gpt-5.6-sol high`，代理 ID `019ffe79-99bc-7f72-b994-3dc332975220`。
- 复审范围：仅验证显式空 attempt-vector 会形成零候选，后续提交或补交不会进入既有操作。
- 复审结论：通过，无剩余阻塞 finding。
- 阶段 3 审核通过：是。阶段 4 放行：是。阶段 4 仅实现按不可变提交快照的作业级聚合、完整性、教师确认和审计，不实现学生发布包或学生端可见性。

## 22. 阶段 4 实施记录（待独立审核）

- 新增 `AssignmentSubmissionGrade`、`AssignmentQuestionConclusion` 和 `AssignmentSubmissionGradeConfirmation` 及迁移 `20260814143000_add_assignment_submission_grade_confirmation`。结果以阶段 3 的不可变提交快照为唯一输入，确认记录固定 attempt-vector hash、题目投影、总分、操作者和时间。
- `assignment-submission-grade.ts` 聚合冻结题目的最新审批结果、人工来源和失败状态；缺题和失败保留 blocker，绝不自动计零。`UNANSWERED`/`EXEMPT` 结论是唯一可解除对应缺题门禁的显式记录。
- 人工审批结果在确认前优先于较晚的 AI 审批；确认后作业级投影不可再被后续 AI 运行回写。确认使用版本 compare-and-swap 与幂等键，冲突返回 `assignment-result-confirmation-conflict`。
- 新增教师结果 API：`/api/teacher/assignments/[assignmentId]/submissions/[submissionId]/grade`。可读取整份题目来源/审批/运行历史，刷新聚合、记录结论和确认；路径 submissionId 与快照绑定，防止跨提交操作。
- 阶段 4 定向验证：6 个测试文件、79 项测试通过；Prisma validate、OpenSpec strict 与 `git diff --check` 通过。阶段 4 尚待独立只读 `gpt-5.6-sol high` 审核；未开始阶段 5 的学生发布实现。

## 23. 阶段 4 审核修复记录

- 独立只读 `gpt-5.6-sol high` 初审代理 `019ffecb-6b6f-7c93-b640-e56018034623` 报告 1 项 P1 和 2 项 P2；三项均裁定为 `ACCEPT`。
- P1：刷新聚合原先无条件更新，可能在并发确认后回写 `CONFIRMED` 状态。修复为基于 `id`、`version` 和未确认状态的 compare-and-swap；竞争失败后只读取并返回已确认/已发布的冻结结果，其余竞争返回 `assignment-result-refresh-conflict`。
- P2：确认不完整时，路由现在返回服务层的结构化 `details.blockers`，明确列出未解决题目及原因；不再仅返回错误码。
- P2：快照题目读取显式按冻结题目 `orderIndex` 和稳定 `id` 排序，保证聚合、确认和学生后续读取使用稳定题序。
- 新增回归覆盖：并发刷新输给确认后仍返回确认投影、快照读取题序、确认不完整时 API 返回 blocker。限定 Vitest 为 2 个文件、16 项测试全部通过。
- 修复后验证：`rtk npx prisma validate`、`rtk openspec validate add-assignment-ai-grading-loop --type change --strict` 和 `rtk git diff --check` 全部通过。
- 下一步：仅针对上述三项接受问题启动独立只读 `gpt-5.6-sol high` 限定复审；通过前不得开始阶段 5。

## 24. 阶段 4 审核放行

- 限定复审代理：独立只读 `gpt-5.6-sol high`，代理 ID `019ffee8-3ecc-7ed3-8f82-af4c77dcf3ef`。
- 复审范围：仅验证并发刷新不覆盖确认结果、不完整确认返回 blocker、快照题目投影稳定排序三项接受问题。
- 复审结论：通过；定向 Vitest 为 2 个文件、16 项测试全部通过，无遗留 P0/P1/P2。
- 阶段 4 审核通过：是。阶段 5 放行：是。阶段 5 仅实现逐份发布包、学生端受控读取和历史 `AT_TIME` 兼容，不实现补交增量或新界面。

## 25. 阶段 5 实施记录（待独立审核）

- 新增 `AssignmentSubmissionGradeRelease` 和迁移 `20260814170000_add_assignment_submission_grade_release`。发布记录与 `AssignmentSubmissionGrade`、确认记录一一绑定，保存发布者、学生所有者、幂等键、请求哈希、发布时间和不可变学生结果包。
- 教师成绩路由新增 `RELEASE` 动作。服务只允许 `TEACHER_CONFIRMED_RESULT` 策略、`CONFIRMED` 成绩和匹配当前版本的确认记录；写入使用成绩版本 CAS，并对重复请求返回原发布记录。
- 学生结果包只保留最终总分、题目分数、教师确认批注、参考答案和评分标准；AI 来源、失败原因和教师修改历史不会进入 `packageSnapshot`。
- 学生作业查询加载作业级发布记录。新确认发布策略下，学生 DTO 的 `feedback` 始终为空，未发布时 `approvedTotal` 与 `resultPackage` 均隐藏；已发布时只返回该学生所有者匹配的结果包。题目级反馈资产路由也拒绝新确认发布策略，历史作业路径保持不变。
- 定向验证：成绩服务、教师成绩路由和学生作业投影共 3 个测试文件、30 项测试通过；受影响 ESLint、`rtk npx prisma validate` 和 `rtk git diff --check` 通过。高堆 typecheck 仅剩仓库既有 5 项 AI 评分实验室/提交集成错误，阶段 5 新增文件未出现在错误列表。
- 阶段 5 尚待独立只读 `gpt-5.6-sol high` 审核；阶段 6 补交增量和阶段 7 UI 尚未开始。

## 26. 阶段 5 审核修复记录

- 初审代理 `019fff06-45b1-71a0-8eaf-0faa331a2f5b` 报告 2 项 P1 和 1 项 P2；三项均裁定为 `ACCEPT`。
- P1：发布幂等键由全局唯一改为 `gradeId + idempotencyKey` 复合唯一，两个学生或两个作业级成绩使用同一客户端键不再互相阻塞。
- P1：审批快照的 `criterionSnapshot` 和 `annotationSnapshot` 现在进入作业级题目投影、确认快照和学生发布包；学生结果包仍不包含 AI 来源、失败原因或教师内部历史。
- P2：学生题目级反馈资产路由将缺失 revision 视为旧路径，避免历史 `AT_TIME` 资产读取因测试/旧数据未携带 revision 而失败；新确认发布策略仍被明确拒绝。
- 回归验证：成绩服务、教师成绩路由、学生作业投影和历史反馈资产路由共 4 个测试文件、33 项测试通过；Prisma validate、受影响 ESLint 与 `git diff --check` 通过。高堆 typecheck 无阶段 5 新增诊断，仍有仓库既有 5 项错误。
- 下一步：仅对上述三项接受问题进行一次独立只读 `gpt-5.6-sol high` 限定复审；通过前不得开始阶段 6。

## 27. 阶段 5 发布包净化修订（待复审）

- 限定复审发现确认批注的嵌套 `origin: AI_DRAFT` 可随 `annotationSnapshot` 进入学生包。该问题与原始可见性契约直接冲突，发布包改为字段白名单投影，而不再复制内部 JSON。
- 评分项只保留 `criterionId`、`levelId`、分数和教师确认评语；批注只保留 `criterionId`、评语及最小必要定位。`origin`、作者角色、内部 ID、失败信息、锚点摘录和其他内部字段均不发布；被抑制批注不发布。
- 新增回归用例将 `AI_DRAFT`、作者角色和内部摘录置入确认快照，断言最终发布包不存在这些字段。4 个定向测试文件、33 项测试通过；受影响 ESLint 和 `git diff --check` 通过。高堆 typecheck 无新增诊断，仍保留仓库既有 5 项错误。
- 下一步：独立只读 `gpt-5.6-sol high` 仅复审嵌套批注白名单投影及其不泄露 AI 来源的断言；通过前不得开始阶段 6。

## 28. 阶段 5 审核放行

- 发布包净化复审代理：独立只读 `gpt-5.6-sol high`，代理 ID `019fff2e-8fa5-78f0-baeb-1a7a18b013ba`。
- 复审结论：无 P0/P1；评分项、批注和定位均采用字段白名单，教师确认评语保留，嵌套 AI 来源、作者角色、失败信息、内部标识和摘录均不会发布。
- P2：未对 `SUPPRESSED` 批注单独设置回归断言。裁定 `DEFER`：当前过滤条件可直接验证且不存在可达泄露路径，现有用例已覆盖活动批注的敏感字段净化；该建议不阻塞本次闭环，不触发第二轮修复。
- 阶段 5 审核通过：是。阶段 6 放行：是。阶段 6 只实现补交版本隔离和增量批改，不扩展发布包或学生界面。

## 29. 阶段 6 实施记录（待独立审核）

- 补交继续复用截止后教师退回授权与新的提交 attempt，不改变旧批次、旧快照、旧成绩确认或旧发布包。
- 一键批改以当前按题 attempt-vector 与已确认/已发布快照比较：向量相同的学生不进入新操作；任一补交题产生新 attempt 时，系统创建新的不可变提交快照并进入新题目批次。旧操作仍只使用其创建时冻结的 attempt-vector。
- 学生端发布包也按当前 attempt-vector 匹配：补交改变当前向量后，旧发布包仍在历史记录中，但在新版本重新评分、确认和逐份发布前不作为当前结果返回。
- 定向验证：编排、教师退回/补交完整性和学生投影共 3 个测试文件、43 项测试通过；Prisma validate、受影响 ESLint 与 `git diff --check` 通过。
- 阶段 6 尚待独立只读 `gpt-5.6-sol high` 审核；阶段 7 UI 与端到端验收尚未开始。

## 30. 阶段 6 审核放行

- 独立只读 `gpt-5.6-sol high` 初审代理 `019fffb2-b04e-7dd2-a649-a1f9652f02f8` 报告一项 P1：不同幂等键并发启动时，资格查询与快照创建之间缺少数据库级互斥，可能重复创建相同 attempt-vector 的操作。
- 裁定：`ACCEPT`。`AssignmentSubmissionSnapshot` 新增 `(submissionId, attemptVectorHash)` 唯一约束及迁移 `20260814180000_prevent_duplicate_assignment_attempt_vectors`；嵌套创建触发唯一冲突且不能按同一幂等键重放时，服务返回 `assignment-grading-operation-conflict`，失败事务不会创建后续批次。
- 新增回归：模拟并发竞争导致的 `P2002`，断言不同幂等键的重复向量请求被拒绝。定向 Vitest 2 个文件、19 项测试通过；`prisma validate`、受影响 ESLint 与 `git diff --check` 通过。
- 独立只读 `gpt-5.6-sol high` 限定复审代理 `019fffbe-e48b-7d40-b8a6-b89ca3a9756b` 仅验证该修复，结论为无阻塞问题、未发现同类并发绕过。
- 阶段 6 审核通过：是。阶段 7 放行：是。

## 31. 阶段 7 实施进度（未完成）

- 教师作业列表已增加“截止后批改”入口；新控制台沿用教师作业区域的 `surface-page`、深色卡片、边框、按钮和响应式栅格。它从既有提交队列读取学生，支持勾选排除、一键 AI 批改、失败题重试、逐题人工批改，以及进入整份审核。
- 控制台原先只把整份状态为 `SUBMITTED` 的记录作为候选，遗漏“已有至少一题已提交、但仍缺题”的 `IN_PROGRESS` 学生，违反缺题进入批改范围的契约。现已在编排服务改为查询 `SUBMITTED`/`IN_PROGRESS`，并以实际已提交题数筛选；快照仍为缺题写入空 attempt，绝不自动计零。
- 教师整份审核页读取作业级聚合，展示逐题得分、来源、运行状态、失败原因、总分、确认和逐份发布。未形成评分的题目可记录 `UNANSWERED`/`EXEMPT` 结论及分值、原因；已有评分的人工修改继续复用既有题目审阅工作区。
- 学生作业页已接入当前 attempt-vector 对应的结果包与状态投影：截止前已提交、待批改、批改中、部分失败、待教师确认、已发布、补交待批改。新确认发布策略下只显示发布包中的总分、逐题分数、教师确认批注、参考答案和评分标准；AI 原始结果、Provider 信息、失败原因与教师历史均不返回学生端。
- 阶段 7 定向验证已通过：编排/成绩/学生投影/教师成绩路由/控制台候选共 7 个测试文件，`51 passed`；受影响 ESLint、`rtk npx prisma validate`、`rtk openspec validate add-assignment-ai-grading-loop --type change --strict` 与 `rtk git diff --check` 通过。
- 全量 `rtk npm run typecheck` 默认 4GB 堆内存耗尽；使用 `NODE_OPTIONS=--max-old-space-size=6144` 后全量检查只剩 4 项既有 `ai-grading-lab` 诊断，阶段 7 新增/修改文件未出现。隔离提交数据库测试的陈旧返回值访问已改为按 revision/student 查询提交，消除了该项非实验室诊断。
- 真实 PostgreSQL 提交集成测试已解除 Windows `npx.cmd` 调用和生命周期策略夹具两个环境阻塞，随后 3/4 用例通过；最后一项暴露既有垃圾回收删除租约问题：资产在物理删除前失去租约，停留于 `DELETING` 并记录 `object-store-delete-failed`。该问题不属于作业批改闭环，未将失败断言改为通过。
- 浏览器端验收尚未完成：教师会话退出时 NextAuth 依据本地环境重定向到未运行的 `localhost:3001`，浏览器安全策略随后禁止从错误页继续本地导航或切换学生账户。已确认教师 `test_teacher` 有班级码 `UG4D24`，但无学生；两名学生加入、发布作业、提交、AI/人工批改、确认发布、学生读取与补交增量仍待浏览器会话恢复后执行。
- 模型质量风险保持不变：Qwen 评分一致性不是本闭环的通过条件，教师人工修改、确认和逐份发布仍是质量控制门槛；不得将流程测试通过表述为模型评分质量通过。

## 32. 阶段 7 真实闭环验收与补充修复（待独立审核）

- 验收作业：`cmst1nu710000kgv6oq210iws`，revision：`cmst1nu770001kgv68nriwy8e`。教师通过真实页面启动一键 AI 批改，`demo` 两题的运行均进入 `AWAITING_REVIEW`，教师逐题审核 AI 草稿、刷新作业级聚合、确认并发布；学生端核验总分 `19`、逐题 `9/10`、教师确认批注、参考答案和评分标准均在发布后才显示。
- 第二名学生 `phase7_student` 仅提交第一题。教师从控制台进入人工批改，记录 `MANUAL` 来源的 8 分；在整份审核页为第二题记录 `UNANSWERED` 0 分结论，确认并发布。学生端核验总分 `8` 和两题的受控结果包。
- 控制台增加“全选待批改学生／取消全选”，只作用于仍可启动 AI 批改的学生。浏览器验收确认全选、取消全选及单名排除均正确更新一键批改人数；已进入审核的学生不受影响。
- AI 草稿运行标识此前未传入控制台，导致只能另起人工批改。现传递 `gradingRunId` 并新增“审核 AI 草稿”入口，复用既有题目审阅工作区，教师可审核、修改或批准 AI 草稿后再进入作业级确认。
- 人工批改此前没有作业级不可变提交快照，无法确认或发布。人工首题批改现建立当前 attempt-vector 的 `AssignmentSubmissionSnapshot`，与 AI 路径共同使用聚合、确认和逐份发布门禁。
- 已发布作业此前不能从作业级审核页退回补交；旧逐题审阅的退回仅适用于 `WORKING` 状态。现新增快照绑定的逐题退回授权，保留原审批记录和发布包，学生新 attempt 改变向量后旧结果包隐藏，重新经历 AI/人工批改、确认和发布。
- 补交真实验收发现题目批次筛选错误地只接受整份 `SUBMITTED`，使缺题学生的 `IN_PROGRESS` 补交版本创建零项批次。已改为接受 `SUBMITTED`/`IN_PROGRESS`；重跑后新操作仅包含补交第一题的 attempt，批次 `totalItems=1`，第二题空 attempt 未被纳入。教师审核 AI 10 分、对缺题记录 0 分、确认发布后，学生端读取新总分 `10`。
- 本机无 Redis、Docker、Podman 或 WSL。教师页面的一键批改仍真实创建队列批次；验收使用 `scripts/tests/phase7-assignment-e2e-fixture.ts --drain-ai-batches` 调用同一批次处理函数完成本地补偿。结束时已运行 `--restore-teacher-password`，教师密码恢复。
- 本阶段补充定向验证：控制台候选/AI 审阅入口、人工快照、作业级退回、`IN_PROGRESS` 批次筛选均已通过 Vitest 与 ESLint；待运行阶段 7 完整验证、OpenSpec 严格校验和独立只读 `gpt-5.6-sol high` 审核。

## 33. 阶段 7 最终审核修复与验证

- 初次独立最终审核代理 `01a001bb-ed0b-7272-abaf-94c895cf72dd` 发现人工批改查询只加载当前题目的答案，却把它用于整份作业快照；另一题补交后从原题再次人工批改会复用旧操作。该 P1 有明确复现路径，裁定为 `ACCEPT`。
- 修复：人工批改查询现在加载该提交所有题目的当前 attempt，仅以目标题目创建人工评分运行；作业级快照因而始终使用完整的 attempt-vector。`operationId`、`idempotencyKey` 与 `dedupeKey` 均已纳入完整向量的哈希。
- 新增回归：先从第一题发起人工批改，再让第二题补交新 attempt，断言会创建不同的人工快照操作；这覆盖了初审遗漏的跨题补交路径。
- 控制台的“全选待批改学生／取消全选”逻辑已抽为可测试函数；只影响仍具备 AI 批改资格的学生，重复点击仅取消这些学生的选中状态，不影响已进入批改或审核的学生。初审未发现该部分的独立问题。
- 首次限定复审还发现 `attemptVectorHash` 依赖题目数组顺序。该 P1 裁定为 `ACCEPT`：排序已下沉至 `assignmentSubmissionSnapshotData`，按 `(orderIndex, id)` 规范化后再生成快照与哈希；回归会反转题目顺序，并断言 `operationId`、`idempotencyKey` 与 `dedupeKey` 均保持一致。
- 用户已授权审核不通过时重新开始审核。独立只读 `gpt-5.6-sol high` 代理 `01a001de-0b47-7e12-9248-76d892f442b0` 复审了上述排序稳定性修复，结论为“无阻塞问题”；精确回归 `1 passed, 10 skipped`。
- 最终验证：阶段 7 定向测试共 6 个文件、81 项通过；受影响 ESLint、`prisma validate`、OpenSpec strict 与 `git diff --check` 全部通过。阶段 7 审核通过，整个 OpenSpec 变更任务已完成。

## 34. 统一闭环清单阶段 1 基准隔离补强（2026-08-25）

- 评测数据集新增不读取人工基准的 `loadEvaluation()` 投影；作业 AI 运行、恢复与执行上下文仅消费量规、脱敏提交和 manifest 承诺哈希。
- 人工基准只在独立 AI 结果完成后的报告与对比路径加载，避免业务闭环复用实验基准时形成提前读取通道。
- 定向实验室测试 176/176 与 typecheck 通过；统一清单阶段 1 实现完成，G.1 独立审核尚未执行。

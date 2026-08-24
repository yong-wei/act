## Context

现有模型已经将作业内容固定在 `AssignmentRevision` 与 `AssignmentQuestion`，并以 `AssignmentSubmission`、`SubmissionAnswer`、`SubmissionAttempt` 保存学生按题目的提交版本。`GradingBatch`、`GradingBatchItem` 和 `GradingRun` 已能以题目为粒度运行、失败隔离并保留历史；`TeacherAssignmentReview`、审批快照和反馈 outbox 已能保存教师题目级审核结果。

缺口不是新的评分引擎，而是正式作业的批改编排与可见性：现有 `GradingBatch` 只按单题建立，`TeacherAssignmentReview` 强制依赖 AI `GradingRun`，而学生反馈释放也按题目审批快照发生。新需求要求截止后批改、人工来源、整份作业完整性、教师确认和逐份发布。新发布作业也必须从 `AT_TIME` 切换到确认发布策略，历史 revision 不迁移。

## Goals / Non-Goals

**Goals:**

- 复用现有作业、提交、转换、脱敏、Provider、评分运行和审核/反馈链路，完成正式业务闭环。
- 让 AI 和人工以同一题目级评分记录模型进入学生作业聚合、确认和发布。
- 保持题目级失败隔离、可重试和历史保留；确保学生只看到教师确认且已发布的结果。
- 通过版本、幂等键、授权快照和数据库约束保证批改与发布不可覆盖历史。
- 在既有教师作业、教师审核和学生作业页面内扩展功能，保持原有视觉风格、组件语言、状态表达和响应式行为。

**Non-Goals:**

- 不改变 Qwen 模型、提示词、评测质量阈值或隐藏集流程。
- 不新增整份 Word 上传、自动批改、截止定时批改或作业级 AI 开关。
- 不迁移历史 `AT_TIME` revision，不承诺阻止已发布内容在平台外传播。

## Decisions

### 1. 使用 revision 级结果发布策略区分新旧行为

新发布 revision 的 `solutionReleasePolicy` 固定为 `TEACHER_CONFIRMED_RESULT`，并在发布时写入内容哈希。发布服务拒绝新作业的 `AT_TIME`；已有冻结 revision 不修改，学生读取继续按其历史策略处理。

备选方案是覆盖全部 `AT_TIME` 记录。该方案会改变已发布作业的历史契约，且需要迁移和回滚复杂度，因此不采用。

### 2. 题目级评分运行统一增加来源，而不建立人工平行状态机

`GradingRun` 增加 `source`，取值为 `AI` 或 `MANUAL`。AI 记录继续具有 Provider、证据和执行链路；人工记录存储同一冻结题目/量规、教师分项分数和批注，但没有 Provider 请求、模型输入或输出。人工记录由教师显式创建，不能伪装成 AI 运行。

现有 `TeacherAssignmentReview` 与审批快照解除“只能关联 AI 运行”的假设，保留题目级审核表作为当前有效评分的审计入口。已有 AI 数据保留原关系与字段，不回填为人工记录。

备选方案是为人工批改新建结果表。该方案会将完整性、确认和发布拆成两套流程，后续更难保持一致，因此不采用。

### 3. 一键批改复用题目级批次，并增加作业级编排记录

新建 `AssignmentGradingOperation` 作为一次教师发起的一键批改命令，绑定 assignment revision、教师、不可变整份提交快照范围、排除名单、请求哈希、幂等键和状态。每个入选学生的每道有效提交题目创建或复用现有 `GradingBatch`/`GradingBatchItem`/`GradingRun`；单题失败只更新该题状态。

为避免题目级 attempt 组合歧义，新建 `AssignmentSubmissionSnapshot` 与 `AssignmentSubmissionSnapshotItem`。快照不可变地记录 assignment submission、冻结 audience、该 audience 的原截止时间、所有冻结题目及每题当时的 current attempt（可为空）、稳定 attempt-vector hash 和创建来源。操作范围引用快照而不是裸 `SubmissionAttempt`，避免批改过程中学生新提交被插入同一批次。重试创建新题目运行身份；补交或后来新版本先生成新快照，只进入后续操作。未提交学生不生成操作项，缺题在快照中显式为空，不自动创建零分记录。

资格由每个 `AssignmentSubmissionSnapshot` 记录的 `frozenAudienceId` 和 `originalDueAt` 单独判定。同一 revision 的 A 班已截止而 B 班未截止时，只能将 A 班 submission 纳入操作；操作和审计记录保留 audience 与截止时间，不能使用 revision 级单一截止时间。

备选方案是把一键批改实现成新的整份作业 Provider 调用。它与现有按题目提交、量规、证据和失败隔离模型冲突，因此不采用。

### 4. 作业级聚合为确认与发布的唯一门禁

新建 `AssignmentSubmissionGrade`，每个 `AssignmentSubmissionSnapshot` 有一条聚合记录。它持有题目状态投影、总分、完整性状态、确认者/时间、发布者/时间、当前确认快照和版本。聚合服务从快照中的题目 attempt、题目级 AI/人工结果与教师明确结论重算，不在提交时自动计零。

完整性只有在每道题都有当前 AI/人工评分，或教师记录 `UNANSWERED`/`EXEMPT` 结论时才成立。确认冻结最终题目值、答案/量规 revision 哈希、attempt-vector hash 和总分；已确认版本不能被后续 AI 覆盖。补交为包含新旧题目 attempt 向量的新快照和新聚合，而历史确认和发布快照继续可审计。

### 5. 发布包由作业级确认快照原子生成

发布命令仅接受已完整并确认的 `AssignmentSubmissionGrade` 版本。事务创建 `AssignmentResultRelease` 和不可变学生投影，其中包含总分、逐题分数、教师确认批注、答案快照和量规快照。学生接口只查询自己的已发布投影；内部 AI 原始结果、失败和修改历史不进入投影。

现有题目级反馈 outbox 保留为派生反馈/附件链路，但 `RELEASE_STUDENT_FEEDBACK` 不再独立授予学生可见性。对新确认发布 revision，它只能生成或准备受作业级 release 引用的派生产物；学生投影只读取 `AssignmentResultRelease`，并且该 release 仅在所需派生产物完成后成功。历史 revision 继续保持旧题目级 feedback release 行为。

### 6. 批改与补交都以截止时间作为服务端门禁

教师启动 AI、创建人工评分、确认、发布以及退回授权均通过服务端比较冻结 audience 的原截止时间与数据库当前时间。学生正常提交仍服从现有提交政策；补交只由截止后教师退回创建新截止授权。客户端时间和提交页面状态不作为授权依据。

### 7. 状态转换、错误码与审计字段在服务层统一定义

题目级评分状态不引入第二套枚举：`GradingBatchItemState` 使用 `QUEUED -> CONVERTING | GRADING -> SUCCEEDED | FAILED | RETRYABLE | BLOCKED`，AI `GradingRunState` 使用既有 `QUEUED -> RUNNING -> AWAITING_REVIEW | FAILED | RETRYABLE | BLOCKED`，人工运行进入 `AWAITING_REVIEW`。`AssignmentGradingOperation` 的状态只表达编排进度，并显式映射为 `QUEUED`、`RUNNING`、`PARTIAL`、`SUCCEEDED`、`FAILED` 或 `BLOCKED`。作业级结果状态为 `PENDING_GRADING -> PARTIAL_FAILURE | AWAITING_CONFIRMATION -> CONFIRMED -> RELEASED`；它是新聚合表专属状态，不复用 `GradingRunState`。补交的新快照生成新结果版本并回到 `PENDING_GRADING`，不回写旧版本。教师明确的 `UNANSWERED` 或 `EXEMPT` 只能解决对应题目的完整性，不删除失败记录。

服务层使用稳定错误码：`assignment-grading-before-deadline`、`assignment-grading-operation-conflict`、`assignment-grading-attempt-not-eligible`、`assignment-manual-grading-invalid`、`assignment-result-incomplete`、`assignment-result-confirmation-conflict`、`assignment-result-not-confirmed`、`assignment-result-release-conflict`、`assignment-solution-release-policy-invalid`、`assignment-resubmission-before-deadline` 与 `assignment-result-access-forbidden`。Route Handler 只投影这些安全错误，不暴露 Provider 原始信息。

每个命令记录操作者、授权快照、请求哈希、幂等键、关联/因果标识、冻结 revision/attempt/题目哈希、来源、时间和前后版本。AI 操作额外记录安全的 Provider 请求标识与策略版本；人工操作不写入任何 Provider 字段。

### 8. UI 只扩展现有作业工作区

教师批改控制、整份作业确认和学生结果包均挂载到现有作业页面与审核页面，复用当前组件、布局密度、按钮语义、状态文案、表格/详情结构和响应式断点。不得另建独立的视觉体系、营销式页面或与现有角色工作区不一致的交互路径。阶段 7 验收须包含桌面与移动视图的样式和可操作性检查。

## Risks / Trade-offs

- [既有题目级反馈 release 与作业级发布并存] → 作业级发布作为学生答案/量规可见性的唯一权威，题目级 outbox 仅作为受其约束的派生反馈链路。
- [人工记录缺少 `AnswerEvidence`] → 人工记录复用提交 attempt 与冻结题目/量规；若需要原始证据，仍通过既有 submission 资产授权读取，不伪造 AI 证据。
- [并发重试或补交] → 每次操作冻结 attempt 范围，使用请求哈希、幂等键、唯一约束和乐观版本检查；历史运行不可被覆盖。
- [旧作业兼容] → 只为新发布 revision 写入新策略，读路径以冻结策略分支；不批量更新历史 JSON。
- [当前 AI 质量不足] → 保留教师修改、确认、逐份发布和失败转人工；质量指标独立于本变更验收。

## Migration Plan

1. 增加新 enum、作业级编排/聚合/发布表及外键、唯一键和索引；为 `GradingRun` 增加来源字段，默认既有记录为 `AI`。
2. 发布服务开始为新 revision 写入确认发布策略并拒绝新 `AT_TIME`，旧 revision 不回填。
3. 部署服务层与 Route Handler，先由服务端执行所有截止、完整性、授权和可见性门禁。
4. 部署教师和学生界面。未部署完成的派生产物不会使学生看到部分结果。
5. 回滚时停止新命令入口和 worker 消费；已写入的不可变确认/发布快照保留，历史 `AT_TIME` 行为不受影响。

## Open Questions

- 无阻塞问题。实施时须以现有 `TeacherAssignmentReview`、审批快照和 outbox 的真实数据库约束确定是扩展这些表还是以新作业级表建立其聚合引用；不得绕过已存在的反馈派生链路。

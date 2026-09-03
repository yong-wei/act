# simplify-teacher-review-and-grading-workspace 前后对照（#1794）

源修订：`941555a804`。基线：2728 行（queue 387 / workspace 1352 / grade 94 /
console 167 / contracts 728）；化简后：2738 行（净 +10；结构化简不以行数为指标，
见 tasks 2.6——删除的重复被命名谓词与 helper 定义抵消）。

基线函数/分支：queue 6/2、workspace 18/35、grade 10/12、console 13/16、
contracts 32/25。化简后：queue 7/6、workspace 21/35、grade 8/12、
console 14/15、contracts 34/22。fetch 次数不变（1/7/4/5）。

## 已接受的变换（accepted）

| # | 变换 | 前 | 后 | 行为保持依据 |
|---|---|---|---|---|
| 1 | 队列 PENDING/可批阅谓词 `isReviewableStatus` | READY\|\|IN_REVIEW 内联于 filter、matchesReviewStatus、firstReviewable、student 回退 find 共 4 处 | 单一定义 + 4 处调用 | PENDING 仍只含 READY/IN_REVIEW；firstReviewable 与 student 回退同语义 |
| 2 | `matchesSelectedQuestionId` | student 选中题与 question 模式 filter 两处 `id/questionId/stableQuestionId` 内联 | 单 helper；question 用 `id`，queue item 用 `questionId` | 原两处本就分别读 id 与 questionId，helper 用可选字段保持等价 |
| 3 | 去掉 `buildDeterministicReviewQueue` 双胞胎 sort | question/student 两支逐字相同的 studentName→number→submissionId 比较 | 单一 sort | 排序键与 localeCompare 不变 |
| 4 | `filterTeacherReviewQueue` 复用 `matchesReviewStatus` | ALL/PENDING/精确状态两套分支 | `items.filter(matchesReviewStatus)` | ALL 仍全通；PENDING 仍走 isReviewableStatus |
| 5 | 队列可用性 `queueOperationsSemantics` | 5 层嵌套三元 + 渲染再重复 loadState/length 判断 | 命名语义 + 渲染按 semantics 分支 | loading/error/empty/filtered-empty/ready 与 `data-operations-status-semantics` 一致 |
| 6 | 审阅动作权限谓词 | 保存/退回/批准三处重复 `!criteria.length \|\| !reviewMutable \|\| saving/acting`，退回/批准另加条件 | `canEditReview` / `canReturnReview` / `canApproveReview`；`canSubmitReturn` 同时约束 act() | 批准仍要求 incompleteEvidence 确认；退回仍要求 ≥8 字原因与截止时间 |
| 7 | `isUnavailableReviewStatus` | load 内联 404/409/410 | 命名谓词 | 缺失态仍不披露学生/分数；save/act 的 `response.status === 409` 冲突路径未改 |
| 8 | `isPreviewableOriginalAsset` | previewAssets 内联 EMBEDDED_IMAGE/jpeg/png/pdf | 命名谓词 | 预览集合不变 |
| 9 | 删除 grade-workspace 死代码 | 未使用的 `gradingSourceLabel` / `gradingRunStateLabel` | 删除 | 无调用点；确认/发布仍用 `gradeStateLabel` |
| 10 | `awaitingConfirmation` | 确认/发布按钮两处 `grade?.state === 'AWAITING_CONFIRMATION'` | 命名谓词 | CONFIRM 仍仅该状态；RELEASE 仍另需 confirmationId |
| 11 | `consoleReviewHref` | 人工批改与 AI 审阅 3 处手写 URLSearchParams（同时带 reviewId+gradingRunId） | 单一 helper；不复用 `buildTeacherReviewHref`（后者在有 reviewId 时丢 gradingRunId） | 新测试锁定双 locator；无 gradingRunId 时不写该参数 |

## 已拒绝/推迟的变换（rejected / deferred）

- **合并 save/approve/return/release/mutate/conclude fetch**：deferred——CAS、
  idempotency-key、blockers 与成功后导航/reload 各不相同（design 风险 1）。
- **把 console 导航改成 `buildTeacherReviewHref`**：rejected——会丢掉
  gradingRunId，改变 404 后 POST 创建审阅的回退。
- **抽取跨文件 NoticeBanner / 共享 fetch 包装**：rejected——纯文件移动，
  且错误码表不同。
- **合并 `defaultReturnDeadline` / `gradeStateLabel`**：rejected——7 天
  带时区 vs 24 小时、fallback「待处理」vs「待批改」并不相同。
- **CriterionEditor / OriginalResponsePanel 拆文件**：rejected——tasks 2.6
  禁止以拆文件作为完成证据。

## 行为/测试证据

- `teacher-review-contracts`（assignment-authoring）13/14 通过；唯一失败
  `renders AI rationale...` 为基线预存在失败：UI 为「自动预评分：」与
  「作答片段」，测试仍期望「AI 草评：」与「证据块 block-2」。stash/HEAD
  对照确认，与本次化简无关。
- `assignments/__tests__/teacher-review-contracts.test.ts` 2/2、
  `teacher-assignment-grading-console.test.ts` 6/6、
  `lib/__tests__/assignment-review.test.ts` 24/24 通过。
- 源码扫描仍保留 `data-derived-review-total`、`expectedVersion`、
  `"filtered-empty"`、`response.status === 409`、`confirmIncompleteEvidence`
  等冻结词。
- 未拆分文件、未引入第二套批改状态机、未改变 Assignment API /
  幂等 / CAS / 教师批准权威。

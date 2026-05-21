# 全课程学习证据与能力追踪治理整改设计稿

状态: proposal-draft
日期: 2026-05-21
来源: 5-1、5-2 课后生产数据库调查
用途: 供后续正式 OpenSpec 变更提案与专业开发计划合并使用

> 本文不是已创建的 OpenSpec 变更，也不是 GitHub Issue。它复用 `openspec-buddy propose` 的正式提案字段和验收口径，记录当前调查结论与可执行设计边界。

## 建议变更标识

- change_id: `govern-course-evidence-and-tracking`
- series: `course-data-governance`
- area: `data-governance`
- risk: `high`
- execution_mode: `isolated`
- 优先批次: `5-3`、`5-4`、`5-5`、`5-6`

## 背景判断

本次远端生产数据库已同步到本地分析。当前生产数据治理链路不是整体失效，而是已经进入持续产出状态：

- `LearningFact=4473`，覆盖 `111` 个用户，最新事实到 `2026-05-21 03:58:18`。
- `StudentCompetencySnapshot=1416`，覆盖 `103` 个用户，最新快照到 `2026-05-21 03:58:49`。
- `LearningEventBatch=464`，待处理批次为 `0`，事件总数 `43093`。
- `ClassCompetencySnapshot=70`，最新班级快照到 `2026-05-21 03:59:47`。
- `StudentEvidenceFeatureCache=0`，缓存表已存在但生产尚未形成可用内容。

5-2 已验证新链路可用：`351` 条提交全部为 `manifest-submission-v2`，`answers`、`score`、`questionSummaries` 覆盖率为 `351/351`，`evidenceQuality.rich=351`，同步错误为 `0`。

5-1 的问题主要来自旧提交包络和网络同步错误：课程发生在模块 5 提交治理迁移之前，`508` 条提交均为 legacy envelope，没有题级答案、评分和 `questionSummaries`；dry-run 只显示 `74/508` 可从最终状态有限回补。

这说明治理 PR 的核心方向有效，但当前系统仍缺少全课程一致的证据契约、复盘解析、证据浏览和缓存刷新闭环。

## 目标

建立面向全体互动课程的学习证据治理方案，使任何已接入 runtime manifest 的课程都满足以下要求：

- 学生提交统一沉淀为可追踪、可评分、可回放的 `manifest-submission-v2` 证据。
- 课前、课后能力追踪不再依赖单课硬编码解析，而由课程证据规格统一驱动。
- 学生和教师端的证据摘要按新证据在前展示，并能浏览全部证据。
- 结课后事实、快照、报告、画像摘要和证据缓存能形成闭环。
- 数据质量报告能区分 captured、materialized、summarized、cached 四层状态。

## 非目标

- 不重写课程教学内容，不调整 5-1 到 5-6 的页面教学顺序。
- 不把 5-1 的不可恢复旧数据伪造成富证据。
- 不在本变更中创建 OpenSpec Issue 或发起 GitHub 协调流程。
- 不把所有历史 legacy 课程一次性改成精品课程；历史课程只要求可识别、可降级展示、可报告质量。

## 现状缺口

### 1. 课堂复盘页按单课硬编码解析

教师复盘页当前只解析 `course_review`、`showcase_review` 和 `unit41_student_state`。5-1、5-2、5-3、5-4、5-5、5-6 的学生状态分别是 `unit51_student_state` 到 `unit56_student_state`，因此即使数据库已有前后测提交，复盘页也无法形成能力追踪记录。

### 2. 证据摘要按高分截断，不按时间展示

`generateEvidenceSummary(facts, 3, evidenceDetails)` 当前每个能力维度按 `score` 降序取前三条。结果是旧课程中的高分证据会覆盖新课程中的低分或失败证据。摘要项也没有 `startedAt`、`finishedAt`、`createdAt` 字段，前端无法改成新证据在前。

### 3. 前端二次截断阻断全部证据浏览

学生成长页、教师学生详情页、教师诊断页继续对 `evidenceSummary` 做 `slice(0, n)`。现有页面只能看到摘要，不支持从某个学生进入全量学习事实证据浏览。

### 4. 证据缓存没有生产闭环

`StudentEvidenceFeatureCache` 表和重建脚本已经存在，但生产同步后为 `0` 行。当前只看到手动 rebuild 入口，没有看到事实沉淀、快照刷新或调度器后的自动刷新链路。

### 5. 结课治理仍有课程级重复实现

5-1 到 5-6 的 `finalizeUNIT_5_xTeacherSession` 均是先 `finishSession()`，再 `trackSessionFinalize(...)`。虽然 `buildSessionFinalizeTelemetry` 已带 `countAfterSessionEnd: true`，但更稳妥的全课程规范应把结课事件记录、课堂状态关闭、报告刷新、学生快照入队视为同一结课事务，而不是每课复制顺序。

## 总体设计

### A. 课程证据规格注册表

新增全课程共享的 `CourseEvidenceSpec`，由 runtime manifest 和少量课程级 override 共同生成。

建议字段：

```ts
interface CourseEvidenceSpec {
  lessonId: string;
  lessonKey: string;
  routeSegment: string;
  studentStateKind: string;
  teacherSyncKind: string;
  preAssessmentStepId?: string;
  postAssessmentStepId?: string;
  summaryStepId?: string;
  responseProducingStepIds: string[];
  objectiveStepIds: string[];
  parameterEvidenceKeys: string[];
}
```

生成规则：

- 优先从 runtime `interactive-manifest.json` 读取 `stepOrder`、`interaction_spec.activity_cards` 和 interaction kind。
- P1 中第一个 `quiz_group` 默认视为前测。
- P3 中最后一个 `quiz_group` 默认视为后测。
- `summary` 或最后一个 `none` 页面默认视为总结页。
- 对旧课、特殊课允许显式 override，但 override 必须集中注册，不能散落在复盘页。

5-3 到 5-6 的初始规格：

| lesson | student state kind | pre | post | summary |
| --- | --- | --- | --- | --- |
| 5-3 | `unit53_student_state` | `step-03` | `step-14` | `step-15` |
| 5-4 | `unit54_student_state` | `step-03` | `step-16` | `step-17` |
| 5-5 | `unit55_student_state` | `step-03` | `step-16` | `step-17` |
| 5-6 | `unit56_student_state` | `step-03` | `step-17` | `step-18` |

### B. 通用课前课后能力追踪解析器

新增共享解析器，输入为 `StudentState.data`、`CourseEvidenceSpec` 和 runtime manifest，输出 `CourseReviewRecord`。

解析策略：

- 如果 state kind 匹配 `CourseEvidenceSpec.studentStateKind`，从 `responses[preAssessmentStepId]` 和 `responses[postAssessmentStepId]` 读取答案。
- 对 `manifest-submission-v2` 证据，优先读取 `questionSummaries`、`score`、`evidenceQuality`。
- 对只在 `StudentState.responses` 内保存的答案，使用 manifest 的 objective cards 重新评分。
- 对 legacy envelope，只产生 `quality=legacy` 的有限追踪，不制造题级答案。
- 输出必须包含 `pre`、`post`、`delta`、`evidenceQuality`、`preStepId`、`postStepId`、`recoverability`。

教师复盘页应改为：

- 保留 `course_review` 和 `showcase_review` 兼容路径。
- 删除 `unit41_student_state` 专用分支，或把它迁移为注册表 override。
- 对所有已注册课程走通用解析器。

### C. 提交证据契约与守护测试

所有响应型页面必须通过 `useManifestSubmissionController.submitManifestStepResponse` 写入课堂事件。5-3 到 5-6 当前已经采用该入口，但仍需增加全课程守护：

- 扩展 `module5-submission-gate-inventory.ts` 为通用 `course-submission-gate-inventory.ts`，覆盖全部 runtime-first 精品课程。
- 检查所有 response-producing step 都能触发 `manifest-submission-v2`。
- 检查 `quiz_group` 至少能形成 `questionSummaries` 和评分。
- 检查参数面板、仿真面板、活动卡能形成 `partial` 或 `rich`，不能退化为 `legacy-envelope`。
- 检查前测、后测 step 与课程规格一致。

优先修复 5-3 到 5-6：

- 5-3、5-4、5-5、5-6 已有 `submitManifestStepResponse`，重点是补复盘解析和质量报告验收。
- 5-4、5-5 的后测是 `step-16`，不要误套 `step-17`。
- 5-6 的后测是 `step-17`，总结是 `step-18`。

### D. 证据摘要模型升级

扩展 `CompetencyEvidenceSummaryItem`：

```ts
interface CompetencyEvidenceSummaryItem {
  factId: string;
  factType: string;
  outcome: string;
  score?: number;
  moduleId?: string | null;
  lessonId?: string | null;
  sessionId?: string | null;
  sourceLogId?: string | null;
  evidenceTitle?: string;
  stepId?: string;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  evidenceQuality?: 'rich' | 'partial' | 'legacy' | 'missing';
  questionSummaries?: EvidenceQuestionSummary[];
}
```

摘要生成规则：

- 默认按 `startedAt desc`，再按 `createdAt desc` 排序。
- 每个维度保留足够支撑页面摘要的最近证据，例如 `topN=20`。
- 如需高分代表证据，另建 `representativeEvidence`，不能再用高分排序替代时间线。
- 保持 JSON 兼容：旧快照缺少时间字段时，前端降级显示但不参与新旧排序。

### E. 全部证据浏览 API

新增分页 API，直接查询 `LearningFact`，而不是只读快照摘要。

建议入口：

- 学生端：`GET /api/student/evidence`
- 教师端：`GET /api/teacher/classes/[classId]/students/[studentId]/evidence`

查询能力：

- 默认 `startedAt desc`。
- 支持 cursor 分页。
- 支持按 `lessonId`、`sessionId`、`competencyDimension`、`factType`、`evidenceQuality` 过滤。
- 通过 `sourceLogId` 关联 `InteractionLog`，通过 `StudentStepResponse.sourceLogId` 补充题级答案。
- 返回 `fact`、`source`、`response`、`session`、`lesson`、`quality` 五类信息。

前端改造：

- 学生成长页只展示最新摘要，但提供“查看全部证据”入口。
- 教师学生详情页展示最新摘要和全量证据页签。
- 教师诊断页按新证据在前展示，不再因为维度截断隐藏后续课程证据。

### F. 证据缓存闭环

`StudentEvidenceFeatureCache` 应成为推荐和画像解释的可用中间层，而不是手动脚本产物。

设计要求：

- `refreshStudentSnapshot` 成功后刷新对应学生的 feature cache。
- backfill 或历史重算脚本提供 `--refresh-feature-cache`。
- scheduler 每日执行一次 cache rebuild 或 stale refresh。
- 管理员数据治理状态显示 cache 行数、最新刷新时间、过期数量。
- 推荐引擎读取 cache 时，如果 cache 缺失，应在状态中显式标为 `missing`，并给出重建建议。

### G. 结课治理统一入口

新增共享的 `finalizeInteractiveLessonSession` 或等价封装，课程页不再复制 `finishSession + trackSessionFinalize` 顺序。

结课顺序建议：

1. 先记录 `session_finalize` 事件，带 `countAfterSessionEnd: true`、`currentStepId`、`finalStepId`、`completionRatio`、`outcome`。
2. 再关闭 `ClassSession`。
3. 入队 session report refresh。
4. 入队 session finalization snapshots。
5. 报告刷新时区分 `snapshot_after_end` 与 `snapshot_after_last_fact`。

这能避免刚结束课程在事实、报告、快照之间出现短暂不一致，也能减少每课重复实现。

## 数据迁移与历史处理

### 5-1

- 不把不可恢复的 legacy 提交改写为富证据。
- 可运行回补 dry-run，确认 `74/508` 可恢复项后再决定是否 apply。
- 回补后的 `evidenceQuality` 必须保留真实质量：可恢复项为 `rich` 或 `partial`，不可恢复项保持 `legacy`。

### 5-2

- 保持当前富证据，不需要回补。
- 用作 5-3 到 5-6 的质量基线。

### 5-3 到 5-6

- 上课前必须先通过提交门禁测试。
- 上课后必须跑 session data quality report。
- 结课后必须确认 `LearningFact`、`StudentCompetencySnapshot`、`StudentEvidenceFeatureCache` 均有增量。

### 历史课程

- 可通过全课程证据规格生成器逐步纳入。
- 对缺 manifest、缺 objective cards 或旧包络课程，质量报告应标记为 `legacy` 或 `partial`，不应静默显示为完整诊断。

## 验收标准

- 5-3 到 5-6 的学生提交全部通过 `manifest-submission-v2` 事件进入 `StudentStepResponse`。
- 5-3 到 5-6 的前测、后测能在教师复盘页形成 `pre/post/delta` 能力追踪。
- 学生成长页和教师学生详情页的证据摘要默认新证据在前。
- 对同一名 5-2 学生，5-2 证据不能再被 4-1 或 4-4 高分证据挤出最新展示。
- 全部证据浏览支持分页，能看到快照摘要之外的完整 `LearningFact` 时间线。
- `StudentEvidenceFeatureCache` 在 rebuild 后不为 0，并能在新增事实后刷新对应学生。
- session data quality report 能同时报告 submissions、rich/partial/legacy/missing、snapshot_after_last_fact、snapshot_after_end、cache freshness。
- 5-1 的回补报告必须显示可恢复与不可恢复数量，不能把不可恢复项计入 rich evidence。

## 建议验证命令

```bash
npm run test -- src/features/interactive/__tests__/manifest-submission-telemetry.test.ts
npm run test -- src/app/api/interactive/events/__tests__/route.test.ts
npm run test -- src/lib/data-governance/__tests__/competency-engine.test.ts
npm run test -- src/lib/data-governance/__tests__/session-data-quality-report.test.ts
npm run test -- src/lib/data-governance/__tests__/student-evidence-feature-cache.test.ts
npm run test -- src/app/classroom/teacher/[sessionId]/review/__tests__/page.test.tsx
npm run lint
npm run build
```

生产数据验收建议：

```bash
npx tsx scripts/db/report-session-data-quality.ts --session-id=<5-3-session>,<5-4-session>,<5-5-session>,<5-6-session>
npm run db:rebuild-student-evidence-feature-cache
```

## 风险与处理

- 风险: 改 `evidenceSummary` JSON 形状影响旧页面。
  处理: 保持旧字段可读，只新增时间与质量字段；前端增加 normalize。

- 风险: 全课程自动推断前后测 step 误判。
  处理: runtime manifest 推断只作为默认值，课程证据规格允许集中 override，并用测试锁定 5-3 到 5-6。

- 风险: 历史 legacy 数据无法完整恢复。
  处理: 质量报告显式区分 recoverable 与 unrecoverable，不把历史数据伪装成新证据。

- 风险: feature cache 刷新增加 worker 压力。
  处理: 学生级增量刷新优先，批量 rebuild 放入低峰调度；管理员页面展示 stale 数量。

## 后续正式提案需要补齐

- 最终 change_id 是否拆成一个大变更，还是拆为 `course-evidence-spec-registry`、`evidence-summary-timeline`、`student-evidence-browser`、`feature-cache-refresh` 四个串联变更。
- 专业开发计划中如果已有 API 或 UI 路由命名，应以开发计划为准。
- 是否将 5-1 可恢复回补纳入本变更，还是作为独立数据修复任务执行。
- 是否把全课程提交门禁扩展到模块 1 到模块 4 的所有 runtime-first 课程。

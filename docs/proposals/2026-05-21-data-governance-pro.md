以下分析以 GitHub `yong-wei/act` 的 `integration` 分支为准。我没有在本地执行构建或数据库命令；结论来自当前分支源码、项目说明和记忆文件读取。

## 一、当前集成分支的数据治理现状判断

`integration` 分支已经不是“只有数据治理雏形”的状态。它已经具备完整的四层治理骨架：原始事件层、课堂提交证据层、学习事实层、画像/推荐/报告层。项目说明明确把平台目标定义为：教师创建课堂，学生进入同步课堂，互动提交、仿真操作、AI 交互和 Arena 评测被记录为学习事件，数据治理链路将高价值事件物化为学习事实，再生成学生能力画像、风险提示、班级洞察和个性化建议。

当前数据表链路也已经明确写入项目说明：`InteractionLog` 是课堂、资源、知识卡、Arena 和交互组件的原始事件；`LearningFact` 是统一学习事实；`StudentCompetencySnapshot`、`StudentProfileSummary`、`ClassCompetencySnapshot`、`StudentRiskFlag`、`GrowthRecord`、`LearningRecommendation` 分别承担学生画像、展示摘要、班级画像、风险、成长和推荐。

源码层面，`integration` 已新增或接入以下关键能力：

1. `LearningFact.contextJson` 已进入 schema，可承载 `interactiveQuiz`、Arena 上下文、回填状态等事实解释信息。
2. `StudentEvidenceFeatureCache` 已进入 schema，字段包括 `features`、`evidenceWindow`、`sourceCounts`、`sourceCoverage`、`freshness`、`confidenceMarkers`、`statusMarkers`、`sourceFactCount`、`lastSourceFactAt`、`rebuildCount` 等。
3. `package.json` 已包含 `test:course-data-quality-gates`、`db:session-data-quality`、`db:backfill-course-evidence`、`db:rebuild-student-evidence-feature-cache` 等治理验收脚本。
4. `/api/interactive/events` 已经能在事件入库前做提交证据质量判定，把 manifest 提交标成 `rich / partial / missing`，非 manifest 提交标成 `legacy-envelope`。
5. `manifest-submission-v2` 已有共享提交控制器和遥测构造器，能生成 `answers`、`answerDigest`、`questionSummaries`、`scoringSupported`、`score`、`subjectiveCompleteness`、`parameterSnapshots`、`extraEvidence` 和 `evidenceQuality`。
6. session report 已经开始统计 durable submissions、evidenceQualityCounts、scoreableObjectiveSubmissions、syncHealth、snapshotCoveragePolicy 等，不再只做简单事件计数。
7. `db:session-data-quality` 背后的报告逻辑已经覆盖 submission coverage、report freshness、snapshot freshness、sync quality。
8. 推荐引擎已优先读取 `StudentEvidenceFeatureCache`，并把 recommendation rationale 结构化为 `evidenceBasis`、`evidenceRole`、`evidenceWindow`、`evidenceCount`、`sourceCoverage`、`confidence` 等字段。

因此，当前整改不应再从“补一个画像表”开始，而应围绕“证据质量闭环、缓存刷新闭环、前端消费闭环、课堂并发质量闭环”做系统性收敛。

## 二、当前主要短板

### 1. 证据质量分类逻辑重复，后续会漂移

当前 `evidenceQuality` 分类逻辑至少分散在三个地方：`/api/interactive/events/route.ts`、`session-reports.ts`、`session-data-quality-report.ts`。三处都在判断 `schemaVersion === manifest-submission-v2`、`answers`、`answerDigest`、`extraEvidence`、`parameterSnapshots`、`questionSummaries` 等字段。

这会带来治理风险：同一条提交在 API 入库时可能是 `partial`，session report 中可能被归为 `rich` 或 `legacy`，质量报告中又按另一个规则统计。编程代理应首先抽出统一模块。

### 2. `StudentEvidenceFeatureCache` 已有表和推荐消费，但刷新链路不闭合

`StudentEvidenceFeatureCache` 已有 builder、refresh、rebuild、read、admin summary 等函数。 但当前 worker 的学生快照任务在生成 `StudentCompetencySnapshot`、更新 `StudentProfileSummary`、刷新成长评价、更新风险后，没有调用 `refreshStudentEvidenceFeatureCache`。 当前 scheduler 也只安排 nightly event ingestion、hourly active student snapshot、daily class snapshot，没有安排 feature cache refresh 或 rebuild。

结果是：推荐引擎虽然优先读 feature cache，但 cache 可能长期缺失或过期，只能 fallback 到 snapshot / facts。`scripts/db/rebuild-student-evidence-feature-cache.ts` 目前只是手动全量重建入口。

### 3. 画像分数仍主要按 fact contribution 计算，证据质量未进入权重

当前能力计算按最近窗口筛选 `LearningFact`，按 `competencyContribution` 分组，并用 recency、outcome、timeSpent 做加权。 但 `evidenceQuality`、`sourceCoverage`、`contextJson.interactiveQuiz.scoring.supported`、`legacy-envelope` 等质量信息没有直接影响能力分数。

这意味着一个 legacy submit 仍可能通过 `lesson_submit` 的默认 competency mapping 进入画像贡献。`eventToLearningFactInput` 对 core event 直接物化为 fact，且 lesson submit 会带默认映射；虽然它现在能把 `interactiveQuiz` 写入 `contextJson`，但没有将低质量证据降权或改为 context-only。

### 4. `manifest-submission-v2` gate 当前只覆盖模块 5 的 5-2 到 5-6

当前 gate inventory 只有 `5-2` 到 `5-6` 五门课。 gate 本身能识别 response-producing steps 并检测是否使用 `useManifestSubmissionController`、`submitManifestStepResponse`、manifest getter，以及是否直接发送 `COURSE_EVENT_TYPES.LESSON_SUBMIT`。

短板是覆盖范围不足。集成分支的项目说明显示当前精品互动课覆盖模块 2、模块 3、模块 4、模块 5 多门单元课，并且多数新课走 runtime-first/manifest-runtime。 只检查模块 5 无法保证全平台课堂证据质量。

### 5. 学生端和教师端还没有充分消费 feature cache

学生个人中心仍直接读取 `StudentCompetencySnapshot`、`StudentProfileSummary`、`InteractionLog`、`LearningFact`、`StudentState`、Arena submission 等数据，并没有把 `StudentEvidenceFeatureCache` 作为统一证据状态输出。

教师班级洞察也主要读取 class snapshot、student snapshots、profile summaries、risk flags、growth/recommendation count、Arena submissions/facts，未纳入 feature cache 的 coverage、confidence、statusMarkers。 教师个体页虽然会展示 recommendation rationale，但学生 evidence cache 状态本身没有出现在 payload 顶层。

这会影响教师判断：一个学生“分数低”到底是能力低，还是证据不足、缓存过期、提交缺失、同步异常，目前 UI 不容易直接解释。

### 6. 同步事故治理已有模型，但需要进入课堂实时和课后质量闭环

同步事故模型已经定义 incident key 字段、30 秒 burst window、最小连续失败次数、`sync_recovered`、severity 分类、source/failure kind 解析、transient client noise 判断。 session report 也会聚合 raw error、recovery、incident、affected users、dominant source/failure kind、severity、recovered/unresolved、transient/broad/concentrated。

但从整改角度看，仍需要两件事：第一，教师端课堂结束页必须看到“本堂数据是否可信”；第二，质量报告的红黄绿阈值要固化为上线门槛，而不是只有 CLI 输出。

### 7. 面向竞赛/验收的真实用户数据、合规和可追溯还需要产品化

上传的项目说明和赛题材料都指向同一类验收压力：平台不能只展示功能，还要能展示真实教学闭环、学情诊断、用户验证、合规说明和可复现数据。学科垂类大模型赛题强调学情精准诊断、个性化与自适应、内容可追溯、真实用户反馈和规模化使用数据；职教智能体赛题也明确把数据孤岛、能力成长不可视、个性化自适应学习和真实用户反馈作为痛点与验收方向。

因此，数据治理整改不仅是内部工程质量问题，也是作品展示、答辩、评审可信度的核心证据。

## 三、整改总目标

把当前集成分支的数据治理统一成以下闭环：

`InteractionLog / StudentStepResponse / ArenaSubmission / SimulationLog / UserAnswer / PromptAssessment / DesignSession`
→ `EvidenceSourceCatalog 分类与过滤`
→ `LearningFact + contextJson`
→ `StudentCompetencySnapshot / StudentProfileSummary`
→ `StudentEvidenceFeatureCache`
→ `ClassCompetencySnapshot / ClassSessionReport / StudentSessionReport`
→ `学生端画像 + 教师端学情 + 管理员数据治理看板 + 质量验收报告`

整改完成后的核心标准：

1. 每个进入画像的事实都能追溯来源。
2. 每个课堂提交都有 durable response 或明确 legacy/missing 标记。
3. 每堂课都有数据质量报告，能说明答案、分数、题目摘要、证据等级、报告新鲜度、快照新鲜度、同步事故。
4. 学生端和教师端展示的分数必须带证据置信度、来源覆盖和新鲜度。
5. feature cache 不是手动脚本产物，而是 worker/scheduler 闭环的一部分。
6. 所有 response-producing manifest 课程都有静态 gate，不能绕过共享提交路径。

## 四、面向编程代理的整改计划

### Phase 0：基线确认与禁止事项

执行分支：

```bash
git checkout integration
git pull --ff-only
```

先运行静态校验：

```bash
npx prisma validate
npx tsc --noEmit
npm run test:course-data-quality-gates
npm run db:session-data-quality -- --json --compact
npm run lint
npm run test
npm run build
```

这些命令入口已经在 `package.json` 中存在，尤其是 `test:course-data-quality-gates`、`db:session-data-quality`、`db:backfill-course-evidence`、`db:rebuild-student-evidence-feature-cache`。

禁止事项：

不要删除 legacy 证据；只能显式标记并隔离。不要让前端直接伪造 `score` 或官方 Arena 成绩。不要让低质量 `InteractionLog` 直接贡献画像。不要在单课页面直接发送 `LESSON_SUBMIT`，必须走共享 manifest submission controller。不要把 feature cache 当成唯一真源；它是 approved aggregate cache，底层事实仍是可审计来源。

### Phase 1：抽出统一证据质量模块

目标：消除 `evidenceQuality` 分类漂移。

新增文件：

`src/lib/data-governance/submission-evidence-quality.ts`

建议导出：

```ts
export type SubmissionEvidenceQuality = 'rich' | 'partial' | 'legacy' | 'missing';

export interface SubmissionEvidenceSummary {
  quality: SubmissionEvidenceQuality;
  answerAvailable: boolean;
  scoreAvailable: boolean;
  questionSummaryAvailable: boolean;
  scoreableObjective: boolean;
  subjectiveAvailable: boolean;
  parameterEvidenceAvailable: boolean;
  extraEvidenceAvailable: boolean;
  scoringSupported: boolean;
  reason: string;
}

export function summarizeSubmissionEvidencePayload(responseData: unknown): SubmissionEvidenceSummary;
export function classifySubmissionEvidenceQuality(responseData: unknown): SubmissionEvidenceQuality;
export function createEvidenceQualityCounts(): Record<SubmissionEvidenceQuality, number>;
```

迁移调用点：

`src/app/api/interactive/events/route.ts`
`src/lib/data-governance/session-reports.ts`
`src/lib/data-governance/session-data-quality-report.ts`
`src/lib/data-governance/course-evidence-backfill.ts`

验收：

所有现有测试通过；新增单元测试覆盖：

1. objective rich：有 `questionSummaries`、`isCorrect`、`score`。
2. subjective partial：有主观答案、无可评分 objective。
3. parameter partial：有 `parameterSnapshots` 或 `extraEvidence`。
4. manifest missing：`schemaVersion=manifest-submission-v2` 但无答案证据。
5. legacy：非 manifest 或 `evidenceQuality=legacy-envelope`。
6. backfilled final-state enriched。
7. unrecoverable legacy。

### Phase 2：扩大 manifest submission gate 覆盖范围

目标：从模块 5 gate 扩展为全 manifest response-producing lesson gate。

当前仅有 `MODULE5_RESPONSE_PRODUCING_LESSON_INVENTORY`，覆盖 `5-2` 到 `5-6`。 应改成全局 inventory：

新建或替换：

`src/features/interactive/manifest-submission-gate-inventory.ts`

保留模块 5 常量兼容，但新增：

```ts
export const RESPONSE_PRODUCING_LESSON_INVENTORY = [
  // 2-1, 2-2, 2-3, 2-4,
  // 3-x,
  // 4-x,
  // 5-2 ... 5-6,
] as const;
```

代理执行步骤：

1. 枚举 `course-content/runtime/lessons/*/interactive-manifest.json`。
2. 用 `collectManifestResponseProducingSteps` 自动判断是否产生响应。该函数已经能识别 objective、drag-match-sort、parameter、simulation、subjective、training-result。
3. 对有响应的课程补齐 `studentPagePath`、`manifestGetterName`、`minimumResponseSteps`。
4. 修改 `src/features/interactive/__tests__/module5-submission-migration.test.ts` 或新增 `manifest-submission-gate.test.ts`，使用全局 inventory。
5. 保留故意失败 fixture，确保绕过共享路径会失败。

验收：

```bash
npm run test:course-data-quality-gates
```

新增验收条件：

任何 response-producing manifest 课程如果 student page 没有 `useManifestSubmissionController`、`submitManifestStepResponse`、manifest getter，或直接出现 `COURSE_EVENT_TYPES.LESSON_SUBMIT / LESSON_RESUBMIT`，测试失败。

### Phase 3：修正 LearningFact 画像污染风险

目标：低质量课堂提交不能与高质量答题等价贡献画像。

当前 `eventToLearningFactInput` 会对 core event 生成事实，`lesson_submit`、`lesson_resubmit` 属于 core event，且 `buildInteractiveQuizContext` 会把可评分题目写入 `contextJson.interactiveQuiz`。 但对 legacy/missing 提交仍可能生成有默认能力贡献的 fact。需要增加质量权重策略。

建议修改：

`src/lib/data-governance/learning-fact-materialization.ts`

新增：

```ts
function resolveProfileEvidenceWeight(actionType: string, payload: Record<string, unknown>): number
function shouldCountAsProfileEvidence(actionType: string, payload: Record<string, unknown>): boolean
```

规则建议：

1. `lesson_submit / lesson_resubmit` 且 `evidenceQuality=rich`：保留当前贡献。
2. `partial`：保留事实，但 contribution 乘以 0.3–0.5，并在 `contextJson.evidenceGovernance` 写入 `profileWeight`。
3. `legacy-envelope` 或 `missing`：保留 context fact 或 report fact，但 contribution 置 `{}` 或写入 `skipProfileContribution=true`，不要推进能力分。
4. `session_finalize`：只影响自主学习/探究反思时，必须检查 completionRatio 或 finished steps。
5. `arena_evaluation_complete / arena_submit`：只有官方服务端成绩进入高权重；客户端预览不进入正式画像。
6. `workspace_param_change`：仍只允许 sampled 进入，且必须带 `sampled=true`，当前函数已这样限制。

同步修改：

`src/lib/data-governance/competency-engine.ts`

让 `calculateDimensionScore` 读取 `fact.contextJson.evidenceGovernance.profileWeight`，或把 contribution 在物化时已经降权。优先推荐在物化时降权，避免快照计算多处复杂化。

验收：

新增 `learning-fact-materialization.test.ts` cases：

1. rich objective submit 生成 score 和 contextJson。
2. partial subjective submit 生成 fact，但 contribution 降权。
3. legacy submit 生成 fact 可用于报告，但不贡献画像。
4. missing submit 不产生画像贡献。
5. Arena official evaluation 保留高质量上下文。

### Phase 4：打通 feature cache 自动刷新闭环

目标：feature cache 不再依赖手动脚本。

当前 `refreshStudentEvidenceFeatureCache` 已存在，能从 `LearningFact`、最新 `StudentCompetencySnapshot`、`StudentProfileSummary` 构建 cache。 但 worker 的 `processStudentSnapshotJob` 没调用它。

修改文件：

`src/lib/data-governance/student-evidence-feature-cache.ts`
`scripts/workers/data-governance-worker.ts`
`scripts/workers/types.ts`
`scripts/workers/scheduler.ts`

最小改法：

在 `processStudentSnapshotJob` 的 `updateProfileSummary` 和 `refreshStudentGrowthEvaluation` 之后调用：

```ts
await refreshStudentEvidenceFeatureCache(db, userId, { now: snapshotAt });
```

更好改法：

新增 `student-evidence-cache` BullMQ queue，学生快照任务完成后 enqueue cache refresh。这样不会拖慢 snapshot job。scheduler 增加 daily full cache rebuild 或 active cache refresh。

建议优先实现“最小改法”，再做独立队列。

同时修正 feature cache 的窗口：

当前 `refreshStudentEvidenceFeatureCache` 读取该用户全部 facts。 建议 payload 同时提供：

```ts
features.activity30d
features.activityAll
features.competencyContributions30d
features.competencyContributionsAll
```

推荐与画像默认使用 30 天窗口，管理员审计可看 all。

验收：

```bash
npm run db:rebuild-student-evidence-feature-cache
npm run db:session-data-quality -- --json --compact
npm run test:unit -- src/lib/data-governance/__tests__/student-evidence-feature-cache.test.ts
```

新增断言：

学生快照 job 完成后，对应 `StudentEvidenceFeatureCache.updatedAt/refreshedAt/rebuildCount` 变化；推荐引擎读取 state 为 `ready`；admin status 的 `featureCache.totalEntries` 增长。

### Phase 5：课堂并发质量与同步事故可视化

目标：教师能判断“本堂课学情是否可用”。

现有 sync incident model 已具备 key、severity、burst window、recovery、transient noise 分类。 session report 已汇总 syncHealth。

新增统一数据质量状态函数：

`src/lib/data-governance/session-quality-status.ts`

输出：

```ts
export type SessionQualityStatus = 'green' | 'yellow' | 'red';

export interface SessionQualityDecision {
  status: SessionQualityStatus;
  reasons: string[];
  metrics: {
    participants: number;
    durableSubmissionCoverage: number;
    richEvidenceRatio: number;
    legacyOrMissingRatio: number;
    reportFresh: boolean;
    snapshotFresh: boolean;
    syncSeverity: 'none' | 'low' | 'medium' | 'high';
    unresolvedSyncIncidents: number;
  };
}
```

规则建议：

green：rich+partial ≥ 90%，legacy/missing ≤ 10%，report fresh，snapshot fresh 或明确不需要，sync high=0。
yellow：rich+partial 60–90%，或存在 medium sync incident，或 snapshot 部分缺失。
red：legacy/missing > 40%，无 durable submissions，报告缺失，存在 unresolved high sync incident，或 affectedUsers 占比过高。

接入点：

1. `session-data-quality-report.ts`：每个 session 输出 `qualityStatus`。
2. `session-reports.ts`：`classReportData.sessionGovernanceSummary` 增加 `qualityStatus`。
3. 教师课堂结束页或班级课堂记录页：展示红黄绿。
4. `/admin/data-governance`：展示最近 20 堂课质量分布。

验收：

构造 fixture：

1. 全 rich，无 sync error → green。
2. partial 多，snapshot 缺 → yellow。
3. legacy/missing 多，高严重 sync unresolved → red。

### Phase 6：学生端画像增加证据状态

目标：学生看到“能力分 + 证据可信度 + 更新时间 + 来源覆盖”。

修改：

`src/app/api/user/profile/route.ts`

当前返回 `competency`、`recentActivity`、`personalizedReinforcement`、`arenaPortfolio`、`arenaSummary`，但未返回 feature cache。

新增 payload：

```ts
evidenceStatus: {
  state: 'ready' | 'stale' | 'missing';
  evidenceWindow: StudentEvidenceWindow;
  sourceCounts: unknown;
  sourceCoverage: unknown;
  confidence: unknown;
  statusMarkers: string[];
  refreshedAt: string | null;
}
```

数据来源：

```ts
const evidenceFeatures = await readStudentEvidenceFeatures(prisma, userId);
```

UI 建议：

`/profile` 顶部能力卡旁显示：

“基于近 30 天 X 条有效证据；来源覆盖：课堂提交/仿真/Arena/测评；置信度：高/中/低；最近更新：YYYY-MM-DD HH:mm”。

推荐资源卡显示 `RecommendationRationale` 中的 `evidenceBasis`、`evidenceCount`、`confidence.state`。推荐引擎已经生成 rationale，学生端映射函数需要保留或展示这些字段。

验收：

1. 没有 cache 的学生端展示“证据不足”，不展示精确解释。
2. cache stale 展示“画像可能滞后”。
3. low-confidence 推荐不使用过强语气，如“建议优先尝试”而非“系统判定你薄弱”。

### Phase 7：教师端班级洞察增加证据覆盖与课堂质量

目标：教师能从班级页直接看“哪些学生数据可信、哪些学生需补采证据、哪些课堂不可直接用于评价”。

修改：

`src/app/api/teacher/classes/[classId]/insights/route.ts`

当前班级洞察输出 governance、overview、ability、arena、students，但 students 中没有 feature cache coverage/confidence。

新增查询：

```ts
prisma.studentEvidenceFeatureCache.findMany({
  where: { userId: { in: studentIds } }
})
```

给 `TeacherClassInsightStudent` 增加：

```ts
evidenceState: 'ready' | 'stale' | 'missing';
evidenceConfidenceLevel: 'none' | 'low' | 'medium' | 'high';
evidenceCount: number;
sourceCoverage: Record<string, string>;
evidenceStatusMarkers: string[];
lastEvidenceAt: string | null;
```

班级 governance 增加：

```ts
featureCacheCoverage: {
  ready: number;
  stale: number;
  missing: number;
  lowConfidence: number;
}
```

再接入最近 session quality：

从 `ClassSessionReport.reportData.sessionGovernanceSummary.qualityStatus` 聚合最近 N 堂课，输出：

```ts
recentSessionQuality: {
  green: number;
  yellow: number;
  red: number;
  latestRedSessions: [...]
}
```

验收：

教师端班级页能按 `evidenceState` 排序；spotlight students 排序权重应区分“风险高且证据可信”和“证据不足需补采”。

### Phase 8：教师端学生个体页增加 evidence drawer

目标：教师点击某学生后能追溯“这个判断来自哪些证据”。

修改：

`src/app/api/teacher/classes/[classId]/students/[studentId]/insights/route.ts`

当前 payload 有 snapshot、profileSummary、classComparison、riskFlags、growthRecords、recommendations、evidenceSummary。

新增：

```ts
evidenceStatus
recentSessionReports
recentDurableSubmissions
recentLearningFacts
```

但注意不要把所有 raw `InteractionLog` 返回到页面。建议只返回：

1. 最近 10 条 `LearningFact`，含 `contextJson.interactiveQuiz` 摘要。
2. 最近 10 条 `StudentStepResponse`，只保留 stepId、lessonKey、quality、score、answer count、question summary count，不返回完整主观文本。
3. 最近 5 条 session report quality。
4. feature cache confidence/source coverage。

UI：

每个能力维度卡片旁增加“查看证据”。点击后显示：

课程、步骤、题型、学生答题摘要、参考答案、得分、证据等级、是否计入画像、sourceLogId/sourceEventId。

验收：

敏感文本不默认展示；主观答案默认截断；教师只能查看自己班级学生；管理员可查看全量。

### Phase 9：管理员数据治理看板增强

当前 admin status 已加入 `sourceCatalog` 和 `featureCache` admin summary。

继续增加三类接口：

1. `/api/admin/data-governance/session-quality`：包装 `collectSessionDataQualityReport`，支持 session、lesson、date filters。
2. `/api/admin/data-governance/source-coverage`：包装 `getEvidenceSourceCatalog` 和 coverage report。
3. `/api/admin/data-governance/cache-health`：展示 feature cache stale/missing/low-confidence 分布。

管理员 UI 分四个 tab：

1. Evidence Sources：来源目录、eligible/context-only/excluded、provenance。
2. Session Quality：最近课堂数据质量红黄绿。
3. Feature Cache：缓存覆盖、新鲜度、重建次数。
4. Pipeline：队列、worker、snapshot、fact distribution。

验收：

管理员能从 UI 看到 `db:session-data-quality` CLI 同等信息，而不需要 SSH 到服务器。

### Phase 10：历史数据回填与迁移脚本执行顺序

先只 dry-run，不直接 apply。

建议顺序：

```bash
npm run db:evidence-source-coverage -- --json --compact
npm run db:session-data-quality -- --json --compact
npm run db:backfill-course-evidence -- --json --compact
```

按 lesson 或 session 缩小范围：

```bash
npm run db:backfill-course-evidence -- --lesson-key=5-2 --json --compact
npm run db:backfill-course-evidence -- --session-id=<class-session-id> --json --compact
```

确认 recoverable/unrecoverable 后：

```bash
npm run db:backfill-course-evidence -- --session-id=<class-session-id> --apply --regenerate-reports
npm run db:rebuild-student-evidence-feature-cache
npm run db:session-data-quality -- --session-id=<class-session-id> --json --compact
```

验收标准：

1. backfill 前后 answer coverage、score coverage、question summary coverage 提升。
2. unrecoverable rows 被标记 legacy，不伪造分数。
3. report freshness 恢复。
4. feature cache refreshedAt 更新。
5. 推荐 rationale 从 fallback / approved-snapshot 转为 student-evidence-feature-cache。

## 五、建议新增的测试矩阵

最低必须增加这些测试文件：

```text
src/lib/data-governance/__tests__/submission-evidence-quality.test.ts
src/lib/data-governance/__tests__/learning-fact-quality-weight.test.ts
src/lib/data-governance/__tests__/session-quality-status.test.ts
src/lib/data-governance/__tests__/student-evidence-feature-cache-worker.test.ts
src/features/interactive/__tests__/manifest-submission-gate-all-lessons.test.ts
```

核心断言：

1. 所有 response-producing lessons 不得绕过共享提交。
2. legacy/missing submit 不得推进画像分数。
3. rich objective submit 必须产生 score 和 question summary。
4. parameter/subjective submit 至少 partial，不能 missing。
5. session quality status 可稳定分出 green/yellow/red。
6. 学生快照任务会刷新 feature cache。
7. 推荐 rationale 能正确显示 evidenceBasis 和 confidence。
8. sync error + sync_recovered 能被归并为 incident，并能判定 recovered/unresolved。

## 六、编程代理任务卡

### 任务卡 A：统一证据分类

范围：`src/lib/data-governance/submission-evidence-quality.ts` 及三处调用迁移。
优先级：P0。
验收命令：

```bash
npm run test:unit -- src/lib/data-governance/__tests__/submission-evidence-quality.test.ts
npm run test:course-data-quality-gates
```

完成标准：API、session report、session data quality report 对同一 payload 分类一致。

### 任务卡 B：全课程 manifest gate

范围：`src/features/interactive/manifest-submission-gate-inventory.ts`、相关测试。
优先级：P0。
验收命令：

```bash
npm run test:course-data-quality-gates
```

完成标准：所有有响应产物的 manifest 课程都在 inventory 中；绕过 shared submission 的页面测试失败。

### 任务卡 C：LearningFact 质量权重

范围：`learning-fact-materialization.ts`、`competency-engine.ts` 或 contribution 写入逻辑。
优先级：P0。
验收命令：

```bash
npm run test:unit -- src/lib/data-governance/__tests__/learning-fact-quality-weight.test.ts
```

完成标准：legacy/missing 不再与 rich submit 等价影响画像。

### 任务卡 D：feature cache 自动刷新

范围：`data-governance-worker.ts`、`scheduler.ts`、`types.ts`、feature cache tests。
优先级：P0。
验收命令：

```bash
npm run db:rebuild-student-evidence-feature-cache
npm run test:unit -- src/lib/data-governance/__tests__/student-evidence-feature-cache.test.ts
```

完成标准：学生快照后 cache 自动刷新；推荐默认能读 ready cache。

### 任务卡 E：session quality status

范围：`session-quality-status.ts`、`session-reports.ts`、`session-data-quality-report.ts`、教师/管理员 API。
优先级：P1。
验收命令：

```bash
npm run db:session-data-quality -- --json --compact
npm run test:unit -- src/lib/data-governance/__tests__/session-quality-status.test.ts
```

完成标准：每堂课有 green/yellow/red 质量状态和明确原因。

### 任务卡 F：学生端证据状态

范围：`src/app/api/user/profile/route.ts`、profile UI、profile-center resource card mapping。
优先级：P1。
完成标准：学生端展示 evidence state、confidence、source coverage、last refreshed，并展示推荐 rationale。

### 任务卡 G：教师端班级与个体证据视图

范围：`teacher/classes/[classId]/insights`、`teacher/classes/[classId]/students/[studentId]/insights`、前端页面。
优先级：P1。
完成标准：教师能看到学生证据置信度、班级 cache coverage、最近课堂质量、个体证据抽屉。

### 任务卡 H：admin 治理看板

范围：`/api/admin/data-governance/*`、admin UI。
优先级：P2。
完成标准：admin 页面可查看 source coverage、session quality、feature cache health、pipeline health。

## 七、最终验收标准

工程验收：

```bash
npx prisma validate
npx tsc --noEmit
npm run test:course-data-quality-gates
npm run test:unit -- src/lib/data-governance/__tests__/*.test.ts
npm run db:session-data-quality -- --json --compact
npm run lint
npm run test
npm run build
```

数据验收：

1. 最近课堂 durable submission 覆盖率 ≥ 95%。
2. response-producing steps 中 rich+partial ≥ 90%。
3. legacy/missing ≤ 10%，否则课堂质量至少 yellow。
4. LearningFact 中 profile-grade 事实 sourceEventId/sourceLogId 可追溯率 ≥ 95%。
5. 学生 snapshot 后 feature cache 30 分钟内刷新。
6. 教师班级页能说明 covered/pending/stale/low-confidence 学生数。
7. sync incident 能区分 raw error、incident、recovery、dominant source、failure kind、severity。
8. 推荐卡必须带 evidenceBasis、evidenceWindow、evidenceCount、sourceCoverage、confidence。

展示/比赛验收：

1. 能导出一份班级数据质量报告。
2. 能展示真实用户/班级规模使用数据，不把测试/seed/demo 数据混进正式效果。
3. 能说明学生个人数据脱敏、教师授权边界、AI 输出标识和可追溯证据链。学科垂类和职教赛题都强调真实场景、用户反馈、数据合规和能力成长可视化，这部分应作为最终材料的一部分。

## 八、优先级排序

最先做 P0：统一证据分类、全课程 manifest gate、LearningFact 质量权重、feature cache 自动刷新。这四项不完成，后面的 UI 都会把不稳定数据包装得更漂亮，但可信度仍不足。

随后做 P1：session quality status、学生端 evidence status、教师端班级/个体证据视图。P1 完成后，教师和学生才真正能理解画像结果。

最后做 P2：admin 看板、导出报告、比赛材料数据视图。P2 是展示和运营增强，但必须建立在 P0/P1 的可信事实链之上。

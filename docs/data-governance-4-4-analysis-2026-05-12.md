# 4-4 课后数据治理有效性分析与改进方案

分析时间：2026-05-12
数据来源：已从远端生产库全量同步到本地 `act_obe`

## 一、本次同步结果

同步脚本：`scripts/db/sync-remote-db-to-local.sh`

本地覆盖前备份：

- `data/backups/local_act_obe_before_remote_sync_20260512_104731.dump`

远端导出快照：

- `data/backups/remote_act_obe_sync_20260512_104731.dump`

恢复后的关键表计数：

| 表 | 数量 |
|---|---:|
| `User` | 292 |
| `LearningFact` | 3083 |
| `StudentCompetencySnapshot` | 1055 |
| `StudentProfileSummary` | 167 |
| `ClassCompetencySnapshot` | 60 |
| `LearningEventBatch` | 354 |

`LearningEventBatch` 当前无未处理批次，最新处理时间为 `2026-05-12 02:10:00.234`。

## 二、4-4 课堂数据概况

课堂会话：

| 字段 | 值 |
|---|---|
| sessionId | `cmp1vz3l3001ue3jfwnwwvzio` |
| joinCode | `703810` |
| 班级 | `2024自动化` |
| classId | `cmma7g0590004g9q2nl2jyzdf` |
| 班级人数 | 143 |
| 开始时间 | `2026-05-12 00:22:20.391` |
| 结束时间 | `2026-05-12 02:05:09.624` |
| 状态 | `FINISHED` |
| 课次 | `4-4：多目标权衡与控制器优化设计` |
| lessonKey | `unit-4-4-fixed-structure-optimization-modeling-v1` |

课堂内数据：

| 指标 | 数量 |
|---|---:|
| `StudentState` 学生数 | 77 |
| `InteractionLog` 用户数 | 73 |
| `InteractionLog` 总数 | 1824 |
| `LearningFact` 用户数 | 50 |
| `LearningFact` 总数 | 237 |
| `StudentSessionReport` | 73 |
| `ClassSessionReport` | 1 |

事件分布：

| canonical event | 日志数 | 用户数 |
|---|---:|---:|
| `lesson_step_view` | 928 | 73 |
| `lesson_step_leave` | 627 | 58 |
| `lesson_resubmit` | 131 | 43 |
| `lesson_submit` | 105 | 49 |
| `sync_error` | 32 | 11 |
| `session_finalize` | 1 | 1 |

核心事实沉淀情况：

| 事件 | 日志数 | 用户数 | 已匹配事实 | 未匹配 |
|---|---:|---:|---:|---:|
| `lesson_resubmit` | 131 | 43 | 131 | 0 |
| `lesson_submit` | 105 | 49 | 105 | 0 |
| `session_finalize` | 1 | 1 | 1 | 0 |

事实全部为 `factType=question`、`outcome=success`，且 `score` 全为空。

## 三、有效性判断

当前治理链路已经不是“没有数据”的状态。课堂事件进入 `InteractionLog`，核心提交和结课事件能进入 `LearningFact`，`LearningEventBatch` 没有积压，50 名学生在课后生成了新的能力快照和个人摘要，班级快照也在课后生成。

但是，这条链路目前只能证明“学生发生了提交”，还不能可靠证明“学生在 4-4 的哪些能力上表现如何”。它对运行状态的追踪有效，对学习质量的解释还偏弱。

## 四、主要问题

### 1. 能力映射过粗，不能表达 4-4 的真实教学目标

4-4 的课次目标是固定结构下的优化建模、多目标权衡、候选解解释和无约束结果的边界理解。但当前 `lesson_submit` 统一映射到：

- `controlModeling: 0.5`
- `selfDirectedLearning: 0.3`

`lesson_resubmit` 统一映射到：

- `controlModeling: 0.4`
- `selfDirectedLearning: 0.4`

因此本次 237 条事实只贡献到：

| 能力维度 | 事实数 |
|---|---:|
| `selfDirectedLearning` | 237 |
| `controlModeling` | 236 |
| `inquiryReflection` | 1 |

`parameterDesign`、`engineeringDecision`、`crossDomainTransfer` 没有被 4-4 的课堂提交直接激活。这会导致班级快照看起来变化很小，且无法体现“优化建模课”应当沉淀的能力证据。

### 2. 事实层没有答案证据和评分

本次所有 4-4 `LearningFact.score` 为空，`outcome` 全部是 `success`。提交事件的 `eventData` 只保留了 `stepId`、`attemptKey`、`clientEventId` 等追踪字段，没有携带学生答案摘要、题目编号、评分结果或 rubric。

这意味着系统无法区分：

- 认真完成并答对；
- 只提交了空泛文本；
- 反复修改但仍未达到要求；
- 后测题是否真正理解。

数据治理因此会把“提交行为”误当成“学习成效”。

### 3. `StudentState` 与提交日志存在证据不一致

最终 `StudentState.responses` 中保留的答题覆盖为：

| step | 最终状态中有答案的学生数 |
|---|---:|
| `step-13` | 44 |
| `step-08` | 20 |
| `step-10` | 16 |

而提交日志记录为：

| step | 提交用户数 |
|---|---:|
| `step-08` | 35 |
| `step-10` | 23 |
| `step-13` | 45 |

最终状态不是可靠的完整答题事实源；但提交日志又没有答案内容。因此当前系统既不能只依赖最终状态，也不能只依赖提交日志来做高质量学习证据。

### 4. 班级快照的 `activeStudentCount` 语义容易误读

课后班级快照显示：

| 字段 | 值 |
|---|---:|
| `activeStudentCount` | 92 |
| `totalStudentCount` | 143 |

但本次 4-4 课堂 `StudentState` 学生数是 77，`InteractionLog` 用户数是 73，产生事实的用户数是 50。当前 `activeStudentCount` 实际表示“班级中有有效能力快照的学生数”，不是“本次课堂活跃学生数”。教师端如果直接解释为课堂参与人数，会造成误判。

### 5. 结课报告存在统计口径错误和时序偏差

`ClassSessionReport` 当前 summary 为：

> 73 名学生产生 1823 条互动日志，沉淀 236 条学习事实。

实际库中同一 session 已经有 1824 条互动日志、237 条学习事实。少的 1 条来自 `session_finalize`，说明结课报告生成早于结课事件完全落库。

另外，报告中的 `eventTypes` 使用旧的 `InteractionLog.eventType`，其中同步错误记录为 `error: 32`；但 `syncErrors` 字段读取的是 `eventTypes.sync_error`，因此显示为 `0`。这会掩盖真实同步错误。

### 6. 同步错误规模不大，但需要区分前台错误和后台中止

本次 32 条 `sync_error` 影响 11 名学生，约占互动日志 1.8%。大部分发生在浏览器隐藏状态或请求中止场景，不能直接判定为课堂故障；但 `step-04` 出现 12 条，且有可见状态网络失败，需要在教师复盘中单独标出。

## 五、改进方案

### A. 先修统计正确性

1. `session-reports.ts` 中统一使用 canonical event type 统计 `syncErrors`，不能再用旧的 `error/view/submit/interact` 口径直接推断。
2. `session_finalize` 事件落库后应触发一次报告刷新，或将 session report 延迟到结课事件和对应事实完成后生成。
3. `ClassSessionReport.reportData` 同时保留 legacy event type 和 canonical event type，避免旧看板和新治理口径互相覆盖。

验收标准：

- 4-4 报告刷新后应显示 `interactionLogs=1824`、`learningFacts=237`、`syncErrors=32`。
- 单元测试覆盖 legacy `error` 与 canonical `sync_error` 的转换。

### B. 建立课次级事实映射

为 4-4 增加 step-level competency mapping：

| step | 事实语义 | 建议能力映射 |
|---|---|---|
| `step-08` | 目标函数与权重表达 | `parameterDesign`、`controlModeling` |
| `step-10` | 候选解与 Pareto 解释 | `engineeringDecision`、`parameterDesign` |
| `step-13` | 后测与总结判断 | `inquiryReflection`、`selfDirectedLearning`、`crossDomainTransfer` |

映射来源应优先来自 runtime manifest 或 interactive contract，而不是在 worker 中硬编码单课逻辑。

验收标准：

- 4-4 新事实不再只进入 `controlModeling/selfDirectedLearning`。
- 班级快照中 `parameterDesign`、`engineeringDecision` 至少能反映本课证据变化。

### C. 提交事件必须携带可解释证据

`lesson_submit` / `lesson_resubmit` 的 payload 应增加最小证据字段：

- `evidenceTitle`
- `questionSummaries`
- `answerDigest` 或结构化答案摘要
- `rubricScore` / `score`
- `competencyContribution`
- `outcome`

闭题、选择题、固定字段卡应先做确定性评分；开放文本题至少给出 rubric 完整度、关键词覆盖和教师复核状态。

验收标准：

- 新增事实的 `score` 不再全为空。
- `StudentCompetencySnapshot.evidenceSummary` 能显示题目、学生答案摘要、步骤和得分。

### D. 修正答题事实源

当前最终 `StudentState.responses` 与提交日志不一致，说明“最终状态”不适合作为唯一证据源。后续应采用以下之一：

1. 增加不可变 `StudentStepResponse` 表，按每次提交保存答案、step、attemptKey、sourceLogId。
2. 或在提交事件中携带完整答案摘要，并让 `LearningFact.sourceLogId` 成为证据回查入口。

建议优先方案 1，因为它能同时服务教师课后复盘、学生个人报告和数据治理回放。

### E. 区分班级长期画像与本次课堂画像

`ClassCompetencySnapshot.activeStudentCount` 应改名或补充字段，避免被误解为课堂活跃人数。建议新增 session-level governance summary：

- `sessionParticipants`
- `loggedParticipants`
- `factParticipants`
- `submittedParticipants`
- `snapshotUpdatedParticipants`
- `syncErrorUsers`

班级长期画像继续服务趋势，课堂画像服务课后复盘，两者不要共用同一个“活跃人数”口径。

### F. 对 4-4 当前数据做一次有限回补

由于提交日志没有答案正文，当前 4-4 只能有限回补：

1. 用现有 `InteractionLog` 修正报告统计。
2. 用 `StudentState.responses` 为仍保留答案的学生补充 step 级证据摘要。
3. 不对缺失答案的 step-08/step-10 伪造评分。
4. 回补后重新生成 session report、学生快照和班级快照。

这一步的目标不是把历史数据补成完美，而是把已经可追溯的部分先变成可解释证据，并避免以后继续丢失。

## 六、整改执行记录

执行时间：2026-05-12
执行范围：本地同步后的 `act_obe` 数据库与本仓库数据治理链路。

### A. 统计正确性已修复

`ClassSessionReport` 已改为同时保存旧事件口径和 canonical 事件口径，并用 canonical 口径统计 `syncErrors`。`session_finalize` 事件持久化后会刷新本次课堂报告。

4-4 当前刷新结果：

| 指标 | 值 |
|---|---:|
| `interactionLogs` | 1824 |
| `learningFacts` | 237 |
| `syncErrors` | 32 |
| `summary` | 73 名学生产生 1824 条互动日志，沉淀 237 条学习事实。 |

### B-C. 4-4 新提交证据与能力映射已接入

4-4 运行态提交会在支持评分的目标步骤携带 `evidenceTitle`、`questionSummaries`、`answerDigest`、`score`、`outcome` 与 `competencyContribution`。当前仅对完整作答的 `step-08`、`step-10`、`step-13` 生成评分事实；任一必需题缺失或为空白时不生成评分事实，避免把缺题当错题。

4-4 目标步骤能力映射：

| step | 能力映射 |
|---|---|
| `step-08` | `parameterDesign: 0.7`、`controlModeling: 0.4` |
| `step-10` | `engineeringDecision: 0.7`、`parameterDesign: 0.5` |
| `step-13` | `inquiryReflection: 0.6`、`selfDirectedLearning: 0.4`、`crossDomainTransfer: 0.4` |

### D. 不可变答题事实源已建立

已新增 `StudentStepResponse`，按提交保存 `userId`、`sessionId`、`lessonKey`、`stepId`、`attemptKey`、`sourceLogId`、`clientEventId`、`submittedAt` 与 `responseData`。`sourceLogId` 只来自服务端持久化后的 `InteractionLog`，客户端伪造的 `sourceLogId` 会被剥离。

当前 4-4 本地回补后的不可变作答证据：

| step | `StudentStepResponse` |
|---|---:|
| `step-08` | 9 |
| `step-10` | 10 |
| `step-13` | 35 |
| 合计 | 54 |

### E. 课堂画像与班级长期画像已分离

`ClassSessionReport.reportData.sessionGovernanceSummary` 已新增本次课堂画像字段：

| 字段 | 当前 4-4 值 |
|---|---:|
| `sessionParticipants` | 77 |
| `loggedParticipants` | 73 |
| `factParticipants` | 50 |
| `submittedParticipants` | 49 |
| `snapshotUpdatedParticipants` | 50 |
| `syncErrorUsers` | 11 |

报告同时写入 `participationSemantics`，明确 `ClassCompetencySnapshot.activeStudentCount` 是班级长期画像中的有效快照人数，不是本次课堂活跃人数。快照更新人数只统计结课后 2 小时窗口：`2026-05-12T02:05:09.624Z` 至 `2026-05-12T04:05:09.624Z`。

最新班级长期画像仍保持长期口径：

| 字段 | 值 |
|---|---:|
| `activeStudentCount` | 92 |
| `totalStudentCount` | 143 |

### F. 4-4 历史数据已做有限回补

回补脚本：`scripts/db/backfill-unit-4-4-governance.ts`

回补边界：

- 只使用 `StudentState.responses` 中仍保留的最终答案。
- 必须匹配同一用户、同一步骤、同一提交时间的 `InteractionLog`。
- 缺少提交日志、缺少任一必需题答案、答案为空白的记录不评分。
- 脚本默认不写库，必须显式传入 `--apply`；`--dry-run` 可复核计划。

执行结果：

| 指标 | 值 |
|---|---:|
| 可读最终作答 | 80 |
| 缺少可匹配日志 | 22 |
| 不完整作答 | 4 |
| 实际回补证据 | 54 |
| 更新有分 `LearningFact` | 54 |
| 回补后坏行检查 | 0 |

有分事实分布：

| step | outcome | 数量 | 平均分 |
|---|---|---:|---:|
| `step-08` | `success` | 3 | 100 |
| `step-08` | `failure` | 6 | 0 |
| `step-10` | `success` | 10 | 100 |
| `step-13` | `success` | 31 | 100 |
| `step-13` | `partial` | 4 | 67 |

已发现并修复一次回补污染：最初有 4 条 `step-13` 缺题答案被错误计分，随后通过 `scripts/db/repair-unit-4-4-incomplete-backfill.ts --apply` 删除对应 `StudentStepResponse`、恢复对应 `LearningFact` 为未评分提交事实，并重新刷新学生画像、班级画像和课堂报告。当前 `answerDigest` 中含 `null` 或空白答案的坏行数为 `0`，`step-13` 已无缺题导致的 `failure` 评分事实。

## 七、验证记录

已通过的定向验证：

```bash
rtk npm run test:unit -- src/lib/data-governance/__tests__/unit-4-4-backfill.test.ts src/lib/data-governance/__tests__/unit-4-4-submission-telemetry.test.ts src/lib/data-governance/__tests__/session-reports.test.ts src/lib/data-governance/__tests__/learning-fact-materialization.test.ts src/lib/data-governance/__tests__/interactive-event-ingestion.test.ts src/app/api/interactive/events/__tests__/route.test.ts
```

结果：6 个测试文件，35 个测试通过。

其他验证：

- `rtk npx prisma validate` 通过。
- `rtk git diff --check` 通过。
- `rtk npx tsc --noEmit --pretty false` 仍失败，但剩余错误均在既有互动课测试文件：`control-charts.test.tsx`、`unit-4-1-course.test.ts`、`unit-5-2-course.test.ts`、`unit-5-3-course.test.ts`、`unit-5-5-course.test.ts`，未出现本次数据治理新增文件错误。

子代理复审：

- 第一项统计口径修复：通过。
- 第二项 4-4 提交证据与能力映射：通过。
- 第三项不可变答题事实源：经多轮修复后通过。
- 第四项课堂画像与班级长期画像分离：经快照窗口修复后通过。
- 第五项有限回补：经缺题评分污染清理与实时入口封闭后通过。

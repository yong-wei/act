# Ledger — separate-classroom-live-state-from-submission-evidence

写者/读者清单、分类、事务边界、迁移与删除条件的实现台账。学籍/学习记录域（LearningFact、Learning Record）未做全局重写，仅按既有契约消费。

## 1. Live 投影写者（可覆盖，非证据）

| 生产者 | 位置 | 分类 | 幂等/事务 | 迁移状态 |
| --- | --- | --- | --- | --- |
| 学生 course 态 upsert | `src/features/classroom/session/application/state.ts` `writeClassroomSessionState` → `adapters/prisma-state-runtime.ts` `upsertStudentState` | LiveStateWriter（覆盖式，`@@unique(sessionId,userId,stateKey)`） | upsert 覆盖；新增 FINISHED 会话 410 只读拒绝 | 完成 |
| 教师 teacher-sync 态 | 同上（`stateKey='teacher-sync'`，manage 授权） | LiveStateWriter | stable-signature 客户端去重 + 服务端覆盖 | 完成 |
| 只读上下文包装 | `state.ts` `createReadOnlyClassroomStateRuntime` | 只读端口（preview 用） | 写入抛 `ReadOnlyClassroomContextError('preview-read-only')` | 完成（`submission-evidence.ts` `createReadOnlySubmissionEvidencePort` 同理） |

## 2. 提交证据写者（追加式，分类提交）

| 生产者 | 位置 | 分类 | 幂等/事务 | 迁移状态 |
| --- | --- | --- | --- | --- |
| 事件路由分类提交 | `src/app/api/interactive/events/route.ts` `POST` → `submission-evidence.ts` `acceptClassroomSubmissionEvidence` → `adapters/submission-evidence-commands.ts` `acceptClassifiedSubmissionCommand` | SubmissionEvidenceWriter；`lesson_submit`/`lesson_resubmit` 且可推导规范身份 | 单事务：`pg_advisory_xact_lock('class-session-submission:'+sessionId)` → 幂等快路径 → 唯一约束冲突回滚后重读回执 → ACTIVE/PAUSED 分配单调 `submissionSequence`；源 `InteractionLog` 与 `StudentStepResponse` 同事务落库 | 完成 |
| 遗留无身份提交 | 同路由 legacy 分支（`partitionClassifiedSubmissionEvents` 落选者） | 未分类（`submissionIdentity=null`） | 原路径：应用层去重键 + `sourceLogId @unique` + `skipDuplicates` | 保留为兼容路径；删除条件：客户端事件全部携带 clientEventId/attemptKey（见 §6） |

Local Review 披露（2026-08-28，均不阻断）：遗留 legacy 分支不区分会话是否已结束——闭课后到达的无身份提交仍以 ACCEPTED + null 序列入库并被默认报告纳入（spec 的晚到承诺只覆盖分类提交）；end 请求若同时携带 currentItemId/currentStage 会被忽略（现网客户端仅发送 status）。
| 响应载荷血缘 | 路由 `buildClassifiedSubmissionInput`：先剥离客户端 `sourceLogId` 再规范化；`buildResponseData(sourceLogId)` 在事务内以真实源日志 id 回填（含 controlWorkbench/annotatedMedia 证据草稿） | 防伪造血缘 | — | 完成 |

## 3. 身份、序列与水位

- 规范身份：`classroom-submission-identity-v1`，公式 `userId|sessionId|lessonKey|stepId|cardId|attempt( attemptKey ?? clientEventId )`，落库于 `InteractionLog.submissionIdentity` 与 `StudentStepResponse.submissionIdentity/identityVersion`；DB 唯一锚点 `@@unique([userId,sessionId,submissionIdentity])` 与 `@@unique([sessionId,userId,submissionIdentity])`（可空列，PostgreSQL null 语义允许多行历史 null）。
- 序列：`ClassSession.submissionSequence`（BigInt，默认 0）在提交事务内 +1 并随证据同事务提交；`StudentStepResponse.submissionSequence` 记录归属。
- 水位：end 事务（`persistSessionEndTransactionCommand`）与提交共享同一会话锁，写 `status/endTime/acceptedSubmissionWatermark/closureRevision` 并 stage 恰好一条 `SessionClosureOutbox`（`@@unique(sessionId,closureRevision)`）；重复 end 幂等返回既有水位。PAUSED 视为闭课前状态（提交仍被接受），仅 FINISHED 后到达为 `POST_SESSION_REVIEW`。

## 4. 晚到事件、worker 与报告

- 晚到分类：`StudentStepResponse.evidenceStatus = 'POST_SESSION_REVIEW'`（默认 `ACCEPTED`），无序列、不动水位；被动事件维持既有 `afterSessionEnd` 标记。
- worker：`scripts/workers/data-governance-worker.ts` `processSessionReportJob` 以水位限定读取（`session-reports.ts` `submissionEvidenceWhere`），成功后 `session-closure-outbox.ts` `settleSessionClosureOutbox` 幂等结算；失败 `failSessionClosureOutbox` 记录 `lastErrorCode/attemptCount`。
- 报告：`generateSessionSummaryReports` 默认仅纳入水位以内 ACCEPTED 证据（历史 null 序列行保持纳入）；`reportData.closure/recompute/phases` 暴露闭包身份、排除计数与 captured/materialized/summarized/cached 阶段（cached 为 DEFERRED，由既有 per-user 缓存 worker 负责，失败经 qualityStatus 快照新鲜度可见）；重算仅经显式 `options.recompute { recomputeRevision, recomputeInputWatermark }`，原闭包修订/水位不可变更。
- LearningFact 物化：`persistCoreLearningFact` 维持既有身份/血缘契约，仅对 ACCEPTED 回执执行；POST_SESSION_REVIEW 不物化、不入原闭包。

## 5. 预览隔离

- 服务端：FINISHED 会话 live-state 写入拒绝（`session-finished` → 410）；事件路由对 demo/无会话/禁入上下文维持既有 `learningContext/invalidContextReason` 归一化。
- 端口级：preview 上下文使用 `createReadOnlyClassroomStateRuntime` / `createReadOnlySubmissionEvidencePort`，写调用以 `preview-read-only` 可观察拒绝；教师预览组件（preset-lesson-preview、smart-courseware previews、arena preview）勘察确认无学生态/证据写路径。

## 6. 迁移与删除条件

| 项 | 状态 | 删除条件 |
| --- | --- | --- |
| state-as-evidence 读法（教师复盘 `parseCourseReviewPrepostRecord` → `buildAssessmentFromState`） | 已删除：评估仅从持久化提交恢复，无提交即 `missing`，不再从 `StudentState.data.responses` 重建作答 | — |
| 应用层提交去重（`dedupeClassroomSubmissionEvents` + clientEventId 预查） | 降级为非权威快路径（批量短路与计数）；权威移交给 DB 唯一约束 + 写入器回执 | 遗留无身份提交路径下线后随之删除 |
| `course-evidence-backfill.ts`（读 state 回填历史证据） | 保留（一次性迁移工具，非运行时读者） | 历史数据回填完成后下线脚本 |
| 兼容性 payload（`course_review`/`showcase_review` tracking 读取） | 保留（历史会话复盘记录，非作答恢复） | 历史兼容会话归档、零消费者证明后删除 |
| `stateData` 其余用途（kind 门控、lessonId 推断、live 面板） | 保留（live 投影用途，非证据） | — |

## 7. 验证证据

- 写入器/身份/只读端口：`src/features/classroom/session/__tests__/submission-evidence.test.ts`（10 通过）。
- 事件路由编排（写入器打桩）：`src/app/api/interactive/events/__tests__/route.test.ts`（21 通过）。
- 真 PostgreSQL 并发（`CLASSROOM_SUBMISSION_EVIDENCE_REAL_DB_TEST=1`，per-run schema + `prisma db push`）：`src/lib/__tests__/classroom-submission-evidence.real-db.integration.test.ts`（4 通过：同身份并发幂等、新尝试单调、submit-vs-end 双锁序、水位绑定、重复 end 幂等、报告水位限定与显式重算、outbox 重投幂等）。
- 报告/attribution/lifecycle/state 既有测试适配后通过；受影响领域套件（classroom/data-governance/interactive）与 API 契约套件、`tsc` 全量类型检查通过。
- 浏览器验收（任务 5.5：submit/resubmit/refresh/overwrite 旅程 + preview 零写断言）：本轮未执行，作为残余风险在 PR 中披露；其服务端等价断言由 route 零写测试与真 PG 预览/晚到负例覆盖。

## 8. Codex Review feedback 修复（2026-08-28，PR #1668）

- P1 源日志晚到分类：`acceptClassifiedSubmissionCommand` 晚到分支在源 `InteractionLog.eventData` 注入 `afterSessionEnd: true` 与 `evidenceStatus: 'POST_SESSION_REVIEW'`；`generateSessionSummaryReports` 全部闭包统计（interactionLogs/eventTypes/canonicalEventTypes/learningContexts/invalidContextReasons/syncHealth/participants/lessonKey/submittedUserIds）改用排除晚到的 `closureLogs`，晚到仅以 `afterSessionEndEvents` 显式披露。
- P1 闭包 outbox 补投：新增 `redispatchPendingSessionClosures` 扫描 PENDING/FAILED 行并按既有幂等 jobId 补投报告刷新；worker `processSessionReportJob` 增加 coordinator 分支，scheduler 以 10 分钟周期调度，Redis 恢复后自动闭合漏投。
- P2 重算独立化：重算结果写入独立 `class-summary-recompute` 报告行（原 `class-summary` 不再被覆盖、可独立查询）；重算输入由调用方命名的 `includeReviewSubmittedBefore` 时点界定（记录于 reportData.recompute.includedReviewCutoffAt），结合 `recomputeInputWatermark` 共同构成命名输入集。

## 9. Codex Review 第二轮整改（2026-08-28，PR #1668）

- P1 学生报告闭包谓词：闭包谓词下沉到日志读取点（`afterSessionEndLogs`/`closureLogs` 结构性拆分），学生报告循环改用 `closureLogs`，与班级报告共用同一谓词，消除"新增统计口径绕过晚到过滤"的整类漏点。
- P1 补投投递身份：coordinator 补投改为每次扫描使用唯一 jobId（`session-closure-redispatch-<sessionId>-<ts>`），绕开 BullMQ 对 failed 集合中既有 jobId 的 no-op add；处理侧报告生成与 outbox 结算幂等，重复投递不双计。
- P2 resourceId 保真：分类提交源事件透传已验证的 `item.resourceId`，不再无条件置空。

## 10. Codex Review 第三轮整改（2026-08-28，PR #1668）

同主题（闭包完备性）连续第三轮出现后停止局部补丁，按设计不变量"任何证据路径与状态写入都不得绕过闭课边界"做类别闭合：

- P1 状态转移绕过：`persistAdvance` 携带 status 时改为 CAS（`status != FINISHED` 才可转移），count=0 抛 `session-finished`（410）。FINISHED 回退在应用层被禁止，杜绝闭课后把会话改回 ACTIVE/PAUSED 再产生高于水位的序列。
- P1 补投只恢复报告：coordinator 重放全部收尾阶段——事件摄取 coordinator（幂等 jobId `event-ingestion-session-finalize-<sessionId>`）、按会话学生逐个的证据特征缓存刷新（沿用既有 jobId 约定）、再以唯一身份补投报告；报告作业成功后结算闭包。结算语义=闭包 handoff 已完整重放；各阶段失败仍经 qualityStatus/phases 可观察。
- P1 无身份提交绕过水位：删除遗留提交路径（dedupeClassroomSubmissionEvents/buildStudentStepResponseRows/createMany 兜底全部移除）。无法建立规范身份的 lesson_submit/lesson_resubmit 按 `submission_without_canonical_identity` 降级拒绝、不入库；所有分类提交必须经写入器事务边界。

## 11. Codex Review 第四轮整改（2026-08-28，PR #1668）

- P1 CAS 后残留无条件写：`persistAdvance` 状态转移改为单次条件 `updateMany`（count=0 即 `session-finished`），返回行改由只读 `findUnique` 取得，消除"CAS 成功后再被并发闭课覆盖"的二次写窗口。
- P1 结算早于阶段完成：报告作业不再直接结算闭包；缓存刷新作业携带 `sessionId` 并经 `recordSessionReportPhase` 记录 cached 阶段成功/失败；coordinator 补投后按阶段判定（summarized 晚于闭包入队 + cached SUCCEEDED）调用 `settleSessionClosureIfPhasesComplete` 结算，失败闭包保持 PENDING/FAILED 由后续周期恢复；materialized 阶段如实降为 OBSERVED 观测计数（其完成由事件摄取流水线负责，不声称完成）。

## 12. 第五轮审查发现（2026-08-28，PR #1668）— 已停止自动循环，待用户裁决

按 AGENTS.md fix-and-re-review 一轮上限规则，同主题（闭包完备性）问题连续多轮出现后停止自动整改。以下 3 个 P1 已在线程上确认成立并保持 unresolved，等待显式授权后作为设计增量批次处理：

1. 可恢复物化交接：DUPLICATE 回执不重放事实物化，提交事务内缺持久化 handoff——进程中断会使已接受作答永久缺少 LearningFact（违反 spec 的可重放物化要求）。
2. 摄取阶段会话级回执：结算谓词未纳入事件摄取完成状态，摄取失败后闭包仍可能被表示为完成。
3. 缓存扇出按证据参与者聚合：当前从 StudentState 推导缓存目标并共享单一 cached 阶段位，"live state 决定证据消费者"耦合未完全消除，且多学生课堂单个成功可掩盖另一失败。

## 13. 根治重构：闭包完备性状态机（2026-08-29，PR #1668，经负责人授权）

不再逐条修补第五轮 finding，而是落实设计不变量"闭包完备性 = 从持久化证据可重放的收敛状态机"：

- **阶段台账**（新增 `SessionClosurePhase`，`@@unique(closureOutboxId, phase)`）：materialize / summarize / cache 三阶段各有持久化回执（status/total/done/detail）。台账是闭包完备性的唯一真源——结算不看任何旁路作业（Redis 队列、内联调用、event-ingestion coordinator）的成功与否。
- **收敛协调器**：10 分钟周期对每个未完成闭包确保台账行存在、按台账重放未完成阶段（唯一 jobId）、全部阶段 SUCCEEDED 才结算（`settleSessionClosuresIfComplete`）。失败阶段停在 FAILED，下个周期自动重试；每阶段幂等可重放。
- **materialize 阶段**：从水位以内 ACCEPTED 证据重放缺失的 LearningFact（`replayMissingClosureFacts` + `materializeEvidenceRow`，与提交内联快路径共用 `persistCoreLearningFact`，sourceEventId 唯一约束兜底）。这是提交后到闭课间一切物化丢失的恢复边界；route 的 DUPLICATE 回执现在也幂等重放物化（客户端重试即自愈）。
- **cache 阶段**：参与者从水位内证据 distinct userId 推导（与 StudentState 彻底解耦），逐人刷新并在台账行聚合 done/total/detail，任一失败保持 FAILED 待重放。
- **summarize 阶段**：水位限定报告重算（幂等 upsert）。
- 真 PG 集成测试覆盖：台账收敛结算、重复投递不双计、事实丢失→重放补齐→幂等、缓存参与者从证据推导（fixture 无 StudentState 行）。

## 14. 根治重构的第二轮精化（2026-08-29，PR #1668）

对阶段台账状态机的三条精化（仍属同一收敛模型，非新设计）：

1. **重放权威输入**：DUPLICATE 回执重放改为 `materializePersistedEvidenceById`——按回执 ID 读取持久化 `StudentStepResponse` 行作为事实物化的唯一输入；规范身份不含答案内容，重试载荷永远不作为事实来源。
2. **依赖有序计划**：`planClosurePhaseRun` 统一协调器与测试的执行计划——materialize 未成功只调度 materialize；materialize 成功后调度未成功或 `updatedAt` 早于最近一次物化的下游（summarize/cache），物化重跑后陈旧消费者强制重算。
3. **台账投影到报告**：`generateSessionSummaryReports` 读取最近闭包的阶段台账，reportData.phases 的 materialized/cached 直接反映真实回执状态（含 FAILED 与 detail 原因），无台账时 NOT_APPLICABLE；教师报告与结算真源一致。

## 15. 报告投影收敛（2026-08-29，PR #1668）

阶段回执变化（materialize/cache 成功或失败，含异常路径）后经 `projectClosureLedgerIntoReport` 主动把台账状态回写进 class-summary 报告，与报告生成时的投影共用同一形状——报告不再是生成时快照，教师页面看到的是与台账一致的最终阶段状态。

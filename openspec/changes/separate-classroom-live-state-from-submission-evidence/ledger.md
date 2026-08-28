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

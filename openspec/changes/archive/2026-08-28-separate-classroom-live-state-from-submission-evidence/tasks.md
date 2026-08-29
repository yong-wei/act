## 1. Preconditions and writer denominator

- [x] 1.1 Verify `extract-classroom-session-application-service` and the CourseBundle/session identity contract are qualified inputs before changing writers.
- [x] 1.2 Freeze every `StudentState` writer/reader, teacher sync path, response-producing course/manifest page, `/api/interactive/events` branch, submission controller, evidence builder/materializer, preview route, session-end path, worker, report, and cache consumer.
- [x] 1.3 Characterize mutable state fields, evidence classifications, dedupe keys, source-log links, retry behavior, preview calls, finalization order, and existing readiness/quality metrics.

## 2. Live-state and evidence contracts

- [x] 2.1 Define `LiveStateWriter`, `SubmissionEvidenceWriter`, and `LearningFactMaterializer` ports with explicit overwrite, append, and derived-fact semantics.
- [x] 2.2 Mark draft/progress/parameter fields as live projection data and migrate all reports/workers away from using `StudentState.data` to recover submitted answers.
- [x] 2.3 Define the canonical non-empty submission identity from session/student/lesson/step/card/attempt/client event inputs, record its normalization/version, and allocate a monotonic submission/evidence sequence for accepted ACTIVE submissions.
- [x] 2.4 Add a database-enforced uniqueness/conflict path for classified submissions and source events compatible with PostgreSQL null semantics.
- [x] 2.5 Keep passive view/focus/reveal events as `InteractionLog` evidence and prevent them from producing response/fact rows without a declared response/scoring contract.

## 3. Concurrent write and preview migration

- [x] 3.1 Implement one session-scoped transaction that locks/CASes `ClassSession`, verifies ACTIVE status, allocates the sequence, and writes source `InteractionLog`, `StudentStepResponse`, and the existing durable handoff/receipt with conflict-safe retry behavior.
- [x] 3.2 Migrate manifest/course submitters to the shared evidence writer, preserving canonical response kind, answer envelope, attempt, source-log, and server-time lineage.
- [x] 3.3 Migrate session state and teacher sync callers to the live-state writer without coupling a successful state patch to submission success.
- [x] 3.4 Add explicit read-only preview context and migrate every preview route/component to reject live/evidence/fact writes with an observable reason.
- [x] 3.5 Keep LearningFact materialization behind its existing governed identity/filter contract; do not rewrite path, recommendation, or Learning Record domains.

## 4. Finalization, worker, and deletion

- [x] 4.1 Make session end lock/CAS the same `ClassSession` boundary, write `status`/`endedAt`/`acceptedSubmissionWatermark`, and stage one closure/outbox handoff bound to that watermark with idempotent lifecycle semantics.
- [x] 4.2 Migrate outbox/worker/report/cache consumers to select only evidence at or below the accepted watermark, use watermark-scoped idempotency, and expose captured/materialized/summarized/cached partial failure without fabricating evidence.
- [x] 4.3 Classify late submissions as `POST_SESSION_REVIEW` (or an equivalent explicit status), keep them out of the original closure by default, and require an explicit recompute revision/input watermark for later reports.
- [x] 4.4 Add source-lineage, submit-vs-end race, worker-redelivery, duplicate-attempt, late-event, recompute, and report-quality evidence to the live/evidence ledger with owner and deletion conditions.
- [ ] 4.5 Delete state-as-evidence readers, check-then-insert duplicate authorities, and compatibility payloads only after zero-consumer proofs; retain accepted evidence and historical attempts.

## 5. Targeted, domain, and browser verification

- [x] 5.1 Add reducer/classification and privacy projection tests for live, passive, submission, and derived-fact paths.
- [x] 5.2 Add real-PostgreSQL tests for same-identity retries, concurrent identical requests, distinct attempts, source-log uniqueness, materializer idempotency, and submit-vs-end ordering in both lock acquisition orders.
- [x] 5.3 Add preview zero-write tests that assert no `StudentState`, `InteractionLog`, `StudentStepResponse`, or `LearningFact` writes.
- [x] 5.4 Add worker redelivery, report recompute, and late-event negative tests proving the original watermark closure is unchanged and post-session review is not silently mixed in.
- [ ] 5.5 Run teacher/student browser submit-resubmit-refresh-overwrite journeys and verify durable attempts, live latest view, teacher review, report phases, and reconnect behavior.
- [ ] 5.6 Run affected Classroom/Interactive/Data-Governance suites, typecheck, and `openspec validate separate-classroom-live-state-from-submission-evidence --type change --strict`, then `git diff --check`.

## Completion notes（2026-08-28）

- 4.5：state-as-evidence 读者（`buildAssessmentFromState`）已删除；应用层去重降级为非权威快路径，完整删除与兼容 payload 退役的零消费者条件记录在 `ledger.md` §6，故保持未勾选。
- 5.5：浏览器 submit/resubmit/refresh/overwrite 旅程与 preview 零写浏览器断言本轮未执行；服务端等价断言由 route 测试、真 PostgreSQL 晚到/预览负例覆盖，作为残余风险在 PR 中披露。
- 5.6：typecheck 零错误；受影响领域套件通过（除基线既有 `unit-5-5-course` 1 例与 knowledge-governance 清单 11 例、learning-paths 1 例，已用基线 stash 验证与本 change 无关）；`openspec validate --strict` 与 `git diff --check` 在提交前执行。

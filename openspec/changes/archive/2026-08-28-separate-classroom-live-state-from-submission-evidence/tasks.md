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
- [x] 5.5 Run teacher/student browser submit-resubmit-refresh-overwrite journeys and verify durable attempts, live latest view, teacher review, report phases, and reconnect behavior.
- [x] 5.6 Run affected Classroom/Interactive/Data-Governance suites, typecheck, and `openspec validate separate-classroom-live-state-from-submission-evidence --type change --strict`, then `git diff --check`.

## Completion notes（2026-08-28）

- 4.5：state-as-evidence 读者（`buildAssessmentFromState`）已删除；应用层去重降级为非权威快路径，完整删除与兼容 payload 退役的零消费者条件记录在 `ledger.md` §6，故保持未勾选。`course_review`/`showcase_review` 与 `course-evidence-backfill.ts` 仍有消费者，本轮不删除。
- 5.5：2026-08-30 补跑。Playwright `tests/classroom-live-state-submission-evidence.spec.ts`：`/student/demo` 零写入；班级绑定课堂 submit/resubmit 产生两条不同 identity 的 ACCEPTED `StudentStepResponse`；refresh/reconnect 保留；翻页不删持久尝试；闭课 `class-summary` 报告 `captured`/`summarized` 成功；教师复盘「有提交：1 人」。证据目录 `evidence/browser/`。
- 5.6：2026-08-30 补跑。事件路由与提交写入器单测、`unit-1-2-shared-classroom-shell` 与 learner-state reducer 通过；`npm run typecheck` 退出 0；归档 change 已无活动 delta，改校验正式 spec `classroom-live-state-submission-evidence --type spec --strict`；`git diff --check` 通过。本机 `act_obe` 曾缺 `InteractionLog.submissionIdentity`，已补齐迁移后再跑 5.5。

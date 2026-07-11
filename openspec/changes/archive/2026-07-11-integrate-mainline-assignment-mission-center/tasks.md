## 1. Submission Domain And Authorization

- [x] 1.1 Add Prisma models, enums, indexes, restrictive referential actions, and migration for assignment envelopes, question answers, submitted answer attempts, immutable assets, and idempotency keys.
- [x] 1.2 Implement current-delivery versus frozen-history audience, schedule, deadline, late-policy, response-type, attempt, and ownership authorization helpers.
- [x] 1.3 Implement and deploy `SubmissionObjectStore` with a private S3-compatible production bucket/service, opaque keys, quarantine, maximum-ten-minute signed access, immutable finalization, GC/tombstones, health checks, and a local test adapter.

## 2. Student Assignment APIs

- [x] 2.1 Implement Task Center mainline assignment query with authoritative assignment/question states and valid next actions.
- [x] 2.2 Implement per-question text draft, attachment draft, autosave version, history, and conflict APIs with immutable replacement assets.
- [x] 2.3 Implement transactional `提交本题` that seals one explicit answer version, derives aggregate assignment state, preserves other drafts, and rejects whole-assignment document uploads.
- [x] 2.4 Add shared mutation guards for Origin/CSRF, runtime schemas, body/field bounds, resource authorization, idempotency, and upload/autosave/submission rate or quota limits.

## 3. Task Center Experience

- [x] 3.1 Replace the profile name-card class-join action with `任务中心` while preserving class join in the class card.
- [x] 3.2 Redesign `/missions` with default `主线作业` and preserved `任务进阶` views, compact status presentation, counts, filters, and distinct loading/empty/filtered-empty/recoverable-error states with correct actions.
- [x] 3.3 Build `/missions/assignments/[assignmentId]` with instructions, question navigation, independent response/upload/`提交本题` regions, history, sticky aggregate progress, and explicit focus restoration after question change, submit success/failure, retry, and history return.
- [x] 3.4 Add historical-own-submission and missing/stale-context states without exposing reference answers, rubric internals, or unapproved grading.

## 4. Verification

- [x] 4.1 Add unit and integration tests for current/frozen authorization, deadline crossings, autosave conflicts, signed URL constraints, object finalization, mutation security, question submission, aggregate state, and idempotency.
- [x] 4.2 Add tests proving one question save/submit does not mutate other question answers, finalized assets cannot be overwritten, and one combined document is rejected.
- [x] 4.3 Add Playwright coverage for profile entry, both Task Center tabs, loading/empty/filtered-empty/error states, per-question upload/submit, aggregate completion, question-change and submit/retry/history focus restoration, and mobile/keyboard behavior at 320px, 375px, 1024px, and 1440px.
- [x] 4.4 Run Prisma validation/generation, targeted tests, `rtk npm run typecheck`, and `rtk openspec validate integrate-mainline-assignment-mission-center --strict`.

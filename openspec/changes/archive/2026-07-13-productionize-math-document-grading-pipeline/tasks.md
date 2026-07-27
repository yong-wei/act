## 1. Durable Pipeline Records

- [x] 1.1 Add Prisma models, enums, indexes, restrictive referential actions, policy versions, tombstones, retention fields, and migration for AnswerEvidence, conversions, blocks/anchors, grading batches, runs, criterion assessments, annotations, and job states.
- [x] 1.2 Consume `SubmissionObjectStore` and add current/frozen/purpose authorization plus pseudonymous audit and safe logging contracts for evidence, conversion, grading, and artifacts.
- [x] 1.3 Add deterministic dedupe keys and explicit rerun identities/reasons for evidence, conversion, batch, run, retry, and provider-version boundaries.

## 2. Mathematical Document Conversion

- [x] 2.1 Implement asynchronous conversion job orchestration with progress, cancellation, retry, and failure isolation.
- [x] 2.2 Implement text-native AnswerEvidence plus DOCX render/OOXML extraction, PDF/image handling, canonical Markdown, and explicit bbox/span/block/page precision mapping.
- [x] 2.3 Implement server-side Mathpix adapter and routing using rotatable secrets and the shared failure-closed provider policy for purpose, data, region/agreement, no-training, retention, deletion, rate, and disable controls.
- [x] 2.4 Implement governed MarkItDown/local fallback, converter warnings, blocked states, and artifact/version persistence.

## 3. AI-Assisted Rubric Grading

- [x] 3.1 Implement a provider-runtime grading adapter that receives one frozen question, answer, rubric, text-native or converted evidence, and limitations under the shared provider policy.
- [x] 3.2 Implement strict output validation for criterion ids, scores, levels, rationale, confidence, anchors, annotations, limitations, and overall comment.
- [x] 3.3 Restrict the deterministic evaluator to explicit fixtures/tests and make provider-backed evaluation the production path.
- [x] 3.4 Implement question-scoped class batch grading with frozen versions, item progress, outlier/failure visibility, retry, and deduplication.
- [x] 3.5 Add student-content prompt-injection isolation, no-tool/no-retrieval enforcement, and protected mutation guards for CSRF/Origin, schemas, bounds, authorization, idempotency, and quotas.

## 4. Verification And Operations

- [x] 4.1 Add adapter tests for text-native evidence, Mathpix success/failure/policy-block behavior, local fallback, formula/image documents, and honest anchor precision.
- [x] 4.2 Add evaluator tests for malformed output, unknown criteria/anchors, score overflow, missing evidence, prompt injection, privacy redaction, same-idempotency replay, explicit same/new-version reruns, and no automatic approval/writeback.
- [x] 4.3 Validate the supplied T1-1 DOCX through a privacy-safe fixture workflow and verify formulas, rendered pages, hand-drawn evidence, Markdown, and anchor limitations.
- [x] 4.4 Add batch load, mutation-security, idempotency, historical/purpose authorization, retention/deletion/hold/GC, referential action, metrics, and worker recovery tests.
- [x] 4.5 Run Prisma validation/generation, targeted tests, `rtk npm run typecheck`, and `rtk openspec validate productionize-math-document-grading-pipeline --strict`.

## 5. Issue #916 phase-one review hardening

- [x] 5.1 Add an independent migration for tombstone outcome states, provider-retention observability, nullable redaction lineage, lease indexes, and PostgreSQL identifier checks.
- [x] 5.2 Enforce per-object grading retention deletion, 404 continuation, claim/lease CAS, renewal, token-fenced completion/retry, and concurrency regression coverage.
- [x] 5.3 Use batch/item and job lease barriers before and after provider/converter calls and before persistence, with stable idempotency keys, abort signals, and takeover/provider-barrier tests.
- [x] 5.4 Fully redact run, batch, evidence, conversion, snapshot, export, and direct grading lineage fields while retaining strict active-record validation.
- [x] 5.5 Distinguish `RETAINED`, `BLOCKED`, and `DELETED` outcomes and expose governed-retained, content-deleted, pseudonymized, and provider-blocked metrics.
- [x] 5.6 Audit and block legacy evidence, conversion, run, batch, and text-snapshot records without provable lifecycle expiry or policy metadata.
- [x] 5.7 Separate audit event identity from command idempotency and preserve retry/attempt/error history with redacted metadata.
- [x] 5.8 Keep provider retention failure-closed, record deadline/request state/reason, and cover provider deletion retry behavior.
- [x] 5.9 Run focused Vitest, migration static checks, Prisma validation/generation, typecheck, diff checks, OpenSpec strict validation, and the explicit PostgreSQL integration script when infrastructure is available.

## 6. Issue #916 phase-three data-governance repair

- [x] 6.1 Fix the Vitest `server-only` isolation so the repository TypeScript gate passes without weakening the production server-only boundary.
- [x] 6.2 Make retention queries Prisma-schema complete, distinguish finite expiry from governed retention, and cover finite records with real field names and selects.
- [x] 6.3 Fence source, quarantine, derived-object, and provider deletion with claim-token CAS, lease heartbeat, hold rechecks, stale-owner takeover tests, and explicit provider-retention seconds.
- [x] 6.4 Close active batch item/job/parent associations as `BLOCKED` or `CONTENT_UNAVAILABLE` before nullable cleanup; make worker settlement observable when an attempt or association is missing.
- [x] 6.5 Check the parent job/item lease immediately before and after converter/provider work, pass abort signals, and preserve stable idempotency keys.
- [x] 6.6 Redact historical audit identifiers and metadata through an independent timestamp migration, count redactions, and clear source-asset lineage, names, finalization keys, and access-token associations.
- [x] 6.7 Correct tests and Prisma-shaped mocks for nullable relations and both `GradingRun` model-object keys, including partial-delete retry behavior.
- [x] 6.8 Extend migration/static checks and retain an executable PostgreSQL CAS/expiry/takeover script that refuses to run without an explicit `DATABASE_URL`.

## 7. Issue #916 phase-four review blocker closure

- [x] 7.1 Resolve complete source/quarantine lineage scopes, recheck class/assignment/answer holds around claim, heartbeat, store calls, and completion, and cover hold takeover tests.
- [x] 7.2 Interpret source retention from frozen asset policy fields, add explicit blocked outcomes for incomplete finite/governed metadata, and cover frozen v1 versus current v2 behavior.
- [x] 7.3 Make text-snapshot lifecycle projections explicit and add a projection-enforcing regression test for `textSnapshotExpiresAt` and related fields.
- [x] 7.4 Make all lease renewals live-clock, monotonic, token/state/lease-fenced, and cover slow calls, renew-after-heartbeat, and stale takeover behavior.
- [x] 7.5 Return explicit 410/blocked states for nullable or `CONTENT_UNAVAILABLE` conversion, batch, retry, cancel, status, and worker entrypoints.
- [x] 7.6 Persist DOCX rendered bytes through the owned submission object-store writer with abort propagation and lease-loss orphan cleanup tests.
- [x] 7.7 Freeze provider identity/request/deletion handles on tombstones, keep missing adapters/locators observable and failure-closed, and reject internal keys as provider locators.
- [x] 7.8 Remove direct object/resource keys and checksums after pseudonymization, clear source answer/attempt/name/finalization/access-token lineage, and assert raw values differ.
- [x] 7.9 Narrow object-absent recognition, add the independent timestamp migration and static/real PostgreSQL checks, then run the 13 related Vitest files, old routes, typecheck, Prisma, diff, and OpenSpec strict gates.

## 8. Issue #916 phase-five final review blocker closure

- [x] 8.1 Add the additive timestamp migration and schema fields for `CONTENT_UNAVAILABLE`, `DELETED_WITH_HOLD`, lifecycle block observability, and frozen `GradingRun` provider locators; keep PostgreSQL identifiers within 63 bytes.
- [x] 8.2 Implement abortable source/quarantine deletion barriers, persist `CONTENT_UNAVAILABLE`/`DELETED_WITH_HOLD` after physical deletion with a hold or owner loss, and prove the mid-delete parent-hold race.
- [x] 8.3 Convert all four renewal paths to monotonic database CAS, add interleaved/stale-owner regressions, and extend the explicit-`DATABASE_URL` PostgreSQL script with executable CAS/hold SQL.
- [x] 8.4 Extend provider runtime results and GradingRun/tombstone persistence with safe provider/request/handle locators, block positive-retention results without a locator, and pass real locators to the adapter fixture.
- [x] 8.5 Route finalized source-asset GC through frozen `sourceAssetLifecycleDecision`; give quarantine/revoked cleanup its independent expiry path, persist and audit blocked lifecycle metadata, and ensure governed retention never calls object deletion.
- [x] 8.6 Persist legacy lifecycle block timestamps/reasons, make lineage lookup failure-closed, and add database-error versus explicit-not-found tests.
- [x] 8.7 Make rendered orphan cleanup reachable after the post-upload owner fence, bind it to attempt/worker identity, protect replacement owners on stable keys, and persist cleanup failure tombstones/audits.
- [x] 8.8 Keep object-missing handling explicit and narrow, with bucket/endpoint failure regressions and migration/static assertions.
- [x] 8.9 Run related Vitest, Prisma validate/generate, typecheck, migration/static checks, `git diff --check`, OpenSpec strict validation, and the real PostgreSQL script when `DATABASE_URL` is explicitly provided.

## 9. Issue #916 phase-six lifecycle-safety closure

- [x] 9.1 Remove phase-five historical text clearing, add frozen governed-rule/provider-time schema fields, and add the independent timestamp migration with bounded identifiers.
- [x] 9.2 Enforce finite-retention versus retain-governed-record mutual exclusion and prevent runtime policy fallback for historical records.
- [x] 9.3 Freeze legacy evidence/conversion/run/batch/text associations, queue jobs, claims, and leases in one migration/runtime transaction while preserving real historical snapshots.
- [x] 9.4 Calculate provider deadlines from persisted provider request/processed time, pass run locators to tombstones, and block production seeding when no deletion adapter exists.
- [x] 9.5 Reconcile physical deletion after hold/takeover CAS loss into `DELETED_WITH_HOLD`/`CONTENT_UNAVAILABLE` with an auditable physical-delete fact.
- [x] 9.6 Use attempt/claim-specific rendered keys and observable ownership-failure cleanup; preserve replacement-owner objects and retryable orphan tombstones.
- [x] 9.7 Settle exhausted BullMQ attempts by exact attempt identity before clearing claims, with real token-state regression coverage.
- [x] 9.8 Extend migration static and explicit-`DATABASE_URL` PostgreSQL checks for historical snapshots, active freezes, policy contract, leases, holds, and token state.
- [x] 9.9 Run focused/full related Vitest, Prisma validate/generate, typecheck, migration/static checks, diff checks, and OpenSpec strict validation; report any unavailable PostgreSQL infrastructure.

## 10. Issue #916 data-plane reconciliation repair

- [x] 10.1 Persist per-object grading tombstone facts and reconcile post-delete hold/takeover CAS loss as `DELETED_WITH_HOLD` without the stale claim token; continue independent multi-object attempts and cover real takeover/hold tests.
- [x] 10.2 Replace unconditional historical audit metadata replacement with an explicit safe-runtime allowlist, preserving retry/attempt/error semantics and redaction counts while removing raw identifiers and content markers; add static fixture coverage.
- [x] 10.3 Recheck the complete frozen source-asset lifecycle tuple and current expiry under the claim lock for finalized source GC; use the independent quarantine deadline/abandoned-upload race path for quarantine and revoked rows.
- [x] 10.4 Clear reverse grading lineage according to the Prisma foreign-key graph, remove unsafe hashes/object keys/student attribution, preserve teacher-review statistics, and verify tombstoned artifacts cannot be resolved through jobs, reruns, or batch items.
- [x] 10.5 Run focused/full related tests, Prisma and type gates, migration/static checks, diff checks, OpenSpec strict validation, and the explicit PostgreSQL race script when infrastructure is available.

## 11. Issue #916 P0/P1 lifecycle-isolation repair

- [x] 11.1 Preserve later-retained GradingRun/BatchItem/Job/Rerun model handles and safe identities when an evidence, conversion, or batch parent expires; delete child content only at the child's own lifecycle deadline.
- [x] 11.2 Record each `GradingTombstoneObject` physical/deleted timestamp from the current object input while retaining the parent aggregate timestamp where required.
- [x] 11.3 Map historical producer `metadata.error` into bounded `safeRuntime.errorCode`, retain the approved runtime projection, and exclude allowed fields from `redactedFields`.
- [x] 11.4 Redact terminal delete-content resource identities with a stable opaque operation key and unique lookup key so repeated GC remains idempotent.
- [x] 11.5 Delete abandoned `QUARANTINED`/`REVOKED` uploads by quarantine lifecycle independently of future finalized source retention; keep finalized source policy behavior unchanged.
- [x] 11.6 Add lifecycle, migration/static, Prisma, type, diff, OpenSpec, focused Vitest, and explicit-`DATABASE_URL` PostgreSQL verification for the repair.
- [x] 11.7 Separate the stable lifecycle lookup secret from the rotatable audit secret, preserve lookup compatibility across rotation, and retain only bounded runtime error codes in live lifecycle audits.
- [x] 11.8 Let local retention deletion proceed when provider deletion is absent, waiting, or retryable; preserve provider locators and an explicitly blocked/retryable provider state for later reconciliation.
- [x] 11.9 Add stable lookup identities to submission-object tombstones and clear raw object keys/checksums after every terminal deletion strategy; validate deployment preflight and migration-recovery fail-closed behavior.

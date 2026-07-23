## 1. Canonical cumulative learner state

- [x] 1.1 Inventory portrait v2, journal processor, trend, risk, growth, student profile, teacher detail, and class-insight paths; enumerate and remove every recent portrait API/UI, `scope=recent` branch, 30-day portrait/risk/trend/diagnosis calculation, and primary goal-specific projection.
- [x] 1.2 Consolidate portrait updates behind one deterministic per-learner reducer that filters eligible facts, orders by occurrence time and stable identity, deduplicates facts, and updates only affected dimensions.
- [x] 1.3 Add an append-only per-user fact transition journal with monotonic sequence and `UPSERT`/`CORRECT`/`REVOKE` operations; keep LearningFact immutable, process appended facts incrementally, and use journal history for learner-bounded rebuilds after corrections, revocations, late facts, or calculation-version changes.
- [x] 1.4 Preserve `StudentPortraitV2Snapshot` as immutable cumulative history and materialize calculation-version/state-watermark current pointers plus durable no-evidence tombstones without deleting prior snapshots; include cumulative overall score, seven-dimension coverage, `evidenceAsOf`, confidence, last trend, last risk, and explicit availability reasons without calendar-time decay.
- [x] 1.5 Add version-fenced, idempotent learner and class reconciliation jobs; class requests enqueue independent current-member tasks, expose queued, processing, completed, no-change, and failed counts, and prevent superseded-version jobs from publishing.
- [x] 1.6 Persist evidence-derived risk independently from teacher disposition so attention/intervention/completion cannot clear evidence risk; exclude legacy `participation`/`ai_misuse` from new cumulative reads, clear `constraint` only after correction/revocation, and recompute `stagnation`/`cross_domain` only from deterministic fact/portrait conditions; append meaningful growth events idempotently and invalidate revoked events from public reads without deleting their audit history.

## 2. Individual portrait contracts and pages

- [x] 2.1 Make student profile/growth and teacher student-detail APIs project the same canonical cumulative portrait and overall diagnosis, with role-specific evidence redaction only.
- [x] 2.2 Allow an authorized current-class teacher to read the member's cumulative evidence and growth summaries across source contexts while preserving existing raw-answer, private-dialogue, hidden-evaluation, and trace redaction.
- [x] 2.3 Update student profile and growth pages to render available seven-dimension values, overall level, strengths, improvement areas, last trend, last risk, evidence cutoff, newest activity, and growth events; remove recent portrait controls and empty states.
- [x] 2.4 Update teacher student detail to render the same cumulative sections, dimension-level class comparisons where available, explicit missing reasons, and an idempotent update action; keep goal-specific diagnosis subordinate.

## 3. Current-member class portrait

- [x] 3.1 Build immutable `class-competency.cumulative.v2` overall and per-dimension aggregates from current members' latest canonical portraits using equal member weights and dimension-specific included/missing denominators; bind calculation version, member set, source portrait versions, evidence cutoff, generation, migration run, and input digest, then atomically advance a protected current pointer only after revalidation.
- [x] 3.2 Update member add, remove, and transfer handling to add or remove the learner's latest projection without rebuilding or copying learner facts.
- [x] 3.3 Derive class trend and risk distributions from members' last personal states and build the seven-dimension overall class diagnosis, strengths, improvement clusters, coverage, and drilldown payloads.
- [x] 3.4 Update teacher class APIs/UI to render only cumulative aggregates, coverage, trend, risk, diagnosis, evidence summary, member values, explicit missing reasons, and class reconciliation progress; remove recent controls and reject `scope=recent` explicitly instead of falling back to cumulative.

## 4. Migration and data verification

- [x] 4.1 Add the minimal Prisma schema/data migration for the append-only transition journal, immutable snapshot current/no-evidence state, growth-event invalidation, protected class publication, global cutover fence, and durable migration receipts; extend the cumulative backfill with idempotent dry-run/apply receipts and prohibit v1/v2 online dual reads.
- [ ] 4.2 Restore the latest production export locally and complete a full rehearsal, including incremental-versus-rebuild equivalence and representative students/classes with full, partial, and absent eligible evidence.
- [x] 4.3 Record the maintenance-window runbook: stop app/worker/scheduler, create and verify a recoverable database backup, deploy the matching version, run the rehearsed identical migration, atomically advance the global cutover fence, invalidate every superseded BullMQ pending/retry/delayed/in-flight migration job, verify durable receipts/counts/pages, and restore the backup plus previous app/worker/scheduler version on failure.
- [ ] 4.4 Execute the production migration only after the local rehearsal passes; prove superseded queue jobs cannot publish, verify representative student, teacher-student, and class pages read only the new cumulative materialization, then reopen the service.

## 5. Regression and acceptance

- [x] 5.1 Add reducer and database tests for no-time-decay preservation, relevant-dimension updates, append-only fact transitions, immutable snapshot retention, current/no-evidence pointer semantics, negative evidence, risk/disposition separation, legacy `participation`/`ai_misuse` audit-only exclusion, correction/revocation-only `constraint` clearance, deterministic `stagnation`/`cross_domain` recomputation, idempotent growth-event invalidation, context-only facts, retries, fact ordering, late facts, revocations, reconciliation idempotency, and rebuild equivalence.
- [x] 5.2 Add API and authorization tests for shared student/teacher portraits, explicit `scope=recent` rejection, absence of recent UI contracts, current-member historical summaries, departed-member denial, seven-dimension diagnosis, dimension-specific class denominators, trend/risk distributions, growth summaries, and availability reasons.
- [ ] 5.3 Add browser or Playwright acceptance for student profile/growth, teacher student detail, and teacher class insight with cumulative data, partial coverage, no eligible evidence, reconciliation states, and subordinate goal-specific diagnosis.
- [ ] 5.4 Run focused suites, data-governance tests, Prisma migration and queue-invalidation validation, typecheck, build, strict OpenSpec validation, and the required independent/domain reviews before the pull request.

## 1. Canonical cumulative learner state

- [ ] 1.1 Inventory current portrait v2, journal processor, trend, risk, growth, student profile, teacher detail, and class-insight paths; document which recent-window and goal-specific projections must be removed from primary reads.
- [ ] 1.2 Consolidate portrait updates behind one deterministic per-learner reducer that filters eligible facts, orders by occurrence time and stable identity, deduplicates facts, and updates only affected dimensions.
- [ ] 1.3 Keep appended facts incremental and implement learner-bounded rebuilds for corrections, revocations, late facts, and calculation-version changes while preserving the existing per-learner transaction guard.
- [ ] 1.4 Materialize cumulative overall score, seven-dimension coverage, `evidenceAsOf`, confidence, last trend, last risk, meaningful growth events, and explicit availability reasons without calendar-time decay.
- [ ] 1.5 Add idempotent learner and class reconciliation jobs; class requests enqueue independent current-member tasks and expose queued, processing, completed, no-change, and failed counts.

## 2. Individual portrait contracts and pages

- [ ] 2.1 Make student profile/growth and teacher student-detail APIs project the same canonical cumulative portrait and overall diagnosis, with role-specific evidence redaction only.
- [ ] 2.2 Allow an authorized current-class teacher to read the member's cumulative evidence and growth summaries across source contexts while preserving existing raw-answer, private-dialogue, hidden-evaluation, and trace redaction.
- [ ] 2.3 Update student profile and growth pages to render available seven-dimension values, overall level, strengths, improvement areas, last trend, last risk, evidence cutoff, newest activity, and growth events.
- [ ] 2.4 Update teacher student detail to render the same cumulative sections, dimension-level class comparisons where available, explicit missing reasons, and an idempotent update action; keep goal-specific diagnosis subordinate.

## 3. Current-member class portrait

- [ ] 3.1 Build class overall and per-dimension aggregates from current members' latest canonical portraits using equal member weights and dimension-specific included/missing denominators.
- [ ] 3.2 Update member add, remove, and transfer handling to add or remove the learner's latest projection without rebuilding or copying learner facts.
- [ ] 3.3 Derive class trend and risk distributions from members' last personal states and build the seven-dimension overall class diagnosis, strengths, improvement clusters, coverage, and drilldown payloads.
- [ ] 3.4 Update the teacher class page to render cumulative aggregates, coverage, trend, risk, diagnosis, evidence summary, member values, explicit missing reasons, and class reconciliation progress without `scope=recent` or `累计口径不适用` fallbacks.

## 4. Migration and data verification

- [ ] 4.1 Extend the existing cumulative backfill path with dry-run/apply receipts for eligible facts, learners, portraits, growth events, current-class aggregates, skips, and failures; make reruns idempotent.
- [ ] 4.2 Restore the latest production export locally and complete a full rehearsal, including incremental-versus-rebuild equivalence and representative students/classes with full, partial, and absent eligible evidence.
- [ ] 4.3 Record the maintenance-window migration runbook: stop app/worker/scheduler, create and verify a database backup, deploy the matching version, run the rehearsed migration, verify counts and pages, and restore the backup plus previous version on failure.
- [ ] 4.4 Execute the production migration only after the local rehearsal passes, then verify representative student, teacher-student, and class pages before reopening the service.

## 5. Regression and acceptance

- [ ] 5.1 Add reducer and database tests for no-time-decay preservation, relevant-dimension updates, negative evidence, context-only facts, retries, fact ordering, late facts, revocations, reconciliation idempotency, and rebuild equivalence.
- [ ] 5.2 Add API and authorization tests for shared student/teacher portraits, current-member historical summaries, departed-member denial, seven-dimension diagnosis, dimension-specific class denominators, trend/risk distributions, growth summaries, and availability reasons.
- [ ] 5.3 Add browser or Playwright acceptance for student profile/growth, teacher student detail, and teacher class insight with cumulative data, partial coverage, no eligible evidence, reconciliation states, and subordinate goal-specific diagnosis.
- [ ] 5.4 Run focused suites, data-governance tests, Prisma migration validation, typecheck, build, strict OpenSpec validation, and the required independent/domain reviews before the pull request.

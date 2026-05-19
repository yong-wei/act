## 1. Evidence Mapping And Reproduction

- [x] 1.1 Identify the current ingestion paths that create `InteractionLog`, `StudentStepResponse`, `LearningFact`, `ClassSessionReport`, and snapshot updates for interactive classroom sessions.
- [x] 1.2 Reproduce the 4-7 evidence gap locally with the synced database or a focused fixture: durable submissions lack answer payloads, objective LearningFact scores stay zero, and sync-error bursts inflate raw interaction counts.
- [x] 1.3 Document the exact source fields used for lesson key, step id, client event id, attempt identity, card id, selected value, and source log id.
- [x] 1.4 Phase 1 acceptance: a failing regression test or scripted check demonstrates the current evidence mismatch before implementation changes.

## 2. Durable Submission Evidence

- [x] 2.1 Persist submitted quiz-card or quiz-group answer payloads into `StudentStepResponse.responseData` at ingestion time.
- [x] 2.2 Preserve repeated submissions as distinguishable attempts using attempt key or client event id without overwriting earlier response evidence.
- [x] 2.3 Ensure post-class answer reconstruction can use `StudentStepResponse` without reading `StudentState.data.responses`.
- [x] 2.4 Phase 2 acceptance: tests verify two repeated submits on the same step produce separate durable response records with reconstructable card answers.

## 3. Objective Quiz LearningFact Scoring

- [x] 3.1 Add a narrow scoring adapter for objective interactive quiz submissions using lesson manifest or contract answer keys.
- [x] 3.2 Populate `LearningFact.score` and `LearningFact.contextJson` with normalized score, answered count, correct count, per-card correctness, lesson key, step id, and attempt identity.
- [x] 3.3 Mark unsupported scoring explicitly in fact context when objective answer keys are unavailable instead of silently writing a misleading zero score.
- [x] 3.4 Keep session-finalization facts distinguishable from per-step quiz facts in queries and report summaries.
- [x] 3.5 Phase 3 acceptance: tests cover correct answers, incorrect answers, missing answer keys, and session-finalization facts.

## 4. Auditable Reports And Sync-Error Incidents

- [x] 4.1 Update class session report generation so raw logs, durable submissions, LearningFact participants, state participants, snapshot-updated participants, and sync-error incidents are separately named.
- [x] 4.2 Add sync-error burst grouping by session, user, step, error signature, and short time window while preserving raw sync-error counts.
- [x] 4.3 Include affected sync-error user counts and make concentrated bursts distinguishable from broad classroom failures.
- [x] 4.4 Include snapshot update window and denominator policy in report data.
- [x] 4.5 Phase 4 acceptance: a report generated from the 4-7-style fixture has reproducible counts from stored tables and keeps raw error count separate from deduplicated incidents.

## 5. Verification And Migration Boundaries

- [x] 5.1 Add or update focused tests for ingestion, scoring, report generation, and sync-error burst handling.
- [x] 5.2 Run targeted data-governance tests, `npm run lint`, and the repository smoke test.
- [x] 5.3 If current JSON columns are sufficient, avoid a Prisma migration; if a migration becomes necessary, document the reason in the implementation PR.
- [x] 5.4 Decide whether a one-off historical analysis or backfill command is needed for old metadata-only `StudentStepResponse` records, and keep it separate from automatic production mutation.
- [x] 5.5 Phase 5 acceptance: final evidence summary states which 4-7 investigation gaps are fixed, which historical records remain unchanged, and which validation commands passed.

# Predecessor qualification — retire-legacy-adaptive-entrypoints

Do not treat GitHub `closed` / `status:archived` as sufficient. Qualification below is from archive artifacts, characterization, tests and ledger on `a6c32f37289cdc3e2667a80589204fe645364197`. Live `openspec/changes/<id>` copies of these six changes (if still present) are leftover propose trees with unchecked tasks; they are not the qualification set.

| Change | Archive | Tasks | Characterization / tests | Ledger | Result |
| --- | --- | --- | --- | --- | --- |
| `reconcile-reviewed-assessment-generation-governance` | `openspec/changes/archive/2026-08-28-reconcile-reviewed-assessment-generation-governance/` | all `[x]` including QUALIFIED receipt task 4.3 | generation-kind / catalog tests cited in archive ledger | archive `evidence/deprecation-ledger.md` | qualified |
| `cutover-path-owned-assessment-attempts` | `openspec/changes/archive/2026-08-28-cutover-path-owned-assessment-attempts/` | all `[x]` | Map/fallback characterization; public-api boundary tests | archive ledger; fallback wrappers deleted | qualified |
| `reduce-personalization-learner-state` | `openspec/changes/archive/2026-08-28-reduce-personalization-learner-state/` | all `[x]` | reducer/route/Konling suites; old service file absent | archive ledger | qualified |
| `externalize-control-correction-personalization-plugin` | `openspec/changes/archive/2026-08-28-externalize-control-correction-personalization-plugin/` | all `[x]` | plugin-registry tests; generic Personalization has no concrete course IDs | archive ledger | qualified |
| `cutover-personalization-path-planner` | `openspec/changes/archive/2026-08-28-cutover-personalization-path-planner/` | all `[x]` | `plan-learning-path` / assemble-plan suites; old planner files absent | archive ledger + import-call-graph | qualified |
| `migrate-personalization-recommendations-and-interventions` | `openspec/changes/archive/2026-08-28-migrate-personalization-recommendations-and-interventions/` | all `[x]` including 5.2 outbox identity/privacy/double-write | outbox-port tests; recommendation-intervention-boundary | archive ledger + caller-denominator | qualified |

Charter / dependency contract predecessors remain the archived `establish-modular-monolith-refactor-charter` and `enforce-modular-domain-dependency-contracts`. This change does not regenerate the frozen 2026-08-26 census.

## EvidenceOutbox replacement protocol

Independent of GitHub issue state, the replacement is qualified by:

- Prisma `EvidenceOutbox.dedupeKey @unique` plus `correlationId` / `causationId` indexes (`prisma/schema.prisma`).
- Durable status mapping `staged=pending`, `applied=projected`, `deduplicated=superseded` in Learning Record outbox port tests.
- Worker-only materialization: `scripts/workers/data-governance-worker.ts` calls `applyAllStagedMicroInterventionEvidence`; events/validation routes stage only.
- Double-write guard `LearningRecordDoubleWriteError` and privacy projection `assertPrivacySafeOutboxProjection`.
- Assessment adapter remains registered because the Learning Record port still delegates materialization to it; that is not a competing request-path consumer.

## Non-qualification notes

- Frozen `docs/architecture/*` census still lists deleted paths (including `kaq-quiz-coverage.ts` and already-deleted planner/state files). Those documents are a frozen 2026-08-26 snapshot; this change does not rewrite them.
- `generatedQuestions` Map is still used by template `generateQuestion`. Predecessor path-owned ledger deferred Map deletion here; this change does not delete it because generate-question still has production callers and no durable practice replacement.
- `cutover-personalization-path-planner` left a module-init cycle: `learner-state/internal` → `registered-goal-ids` → plugin `default-registry` → `slice-contract` → `internal`. This change breaks it by keeping slice constants on a plugin leaf and pointing `registered-goal-ids` at the registry singleton. That is not a second authority.

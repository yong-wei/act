# Owner / deprecation ledger — retire-legacy-adaptive-entrypoints

Do not edit the frozen global `docs/architecture/deprecation-ledger.md` census in this change.

Implementation branch: `retire-legacy-adaptive-entrypoints`. Inventory freeze SHA: `a6c32f37289cdc3e2667a80589204fe645364197`.

## Deleted

| Old entry | Consumers at freeze | Replacement | Deleted at | Evidence |
| --- | --- | --- | --- | --- |
| `src/features/adaptive-learning/kaq-quiz-coverage.ts` | test-only | `@/features/adaptive-assessment/kaq-quiz-foundation` | this change | inventory; retirement architecture test; file absent |
| predecessor planner/state/recommendation/intervention/fallback authorities | see those archive ledgers | canonical Assessment / Personalization public APIs | those changes | files remain absent; retirement test fails if resurrected |

## Retained adapters / storage

| Entry | Owner | Reason |
| --- | --- | --- |
| `assertDurableAssessmentPersistence` / `ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED=false` error | Assessment | explicit configuration error; not a second attempt path |
| `generatedQuestions` Map | Assessment | template practice lookup for generate-question; not catalog or path-owned attempt authority |
| `processPendingMicroInterventionEvidenceProjections` | Assessment adapter behind Learning Record | new protocol qualified; request-path callers are zero; worker uses LR port |
| Prisma `EvidenceOutbox`, `Question`, `UserAnswer`, LearningFacts, path history | declared owners in predecessor ledgers | other domains still read; this change does not delete data |
| `src/lib/adaptive-path-*` / `src/lib/adaptive-planning/*` | path UI and planner ports | not the deleted `src/lib/adaptive-*` planner/state authorities |
| plugin `slice-constants.ts` + registry singleton | Personalization plugin | leaf constants so learner-state and plugin init do not form a second authority or import cycle |

## EvidenceOutbox / worker

- Protocol owner: Learning Record `src/features/learning-record/personalization-ports/`.
- Unique async materializer: `scripts/workers/data-governance-worker.ts`.
- Request routes only stage. Direct+outbox double write is rejected.
- Old consumer function remains as Assessment adapter; not deleted.

## Verification

- `src/lib/__tests__/legacy-adaptive-entrypoint-retirement.test.ts`
- Moved KAQ coverage tests at `src/features/adaptive-assessment/__tests__/kaq-quiz-foundation.test.ts`
- Existing boundary tests: Assessment public API, learner-state reducer, plugin-registry, plan-learning-path, recommendation-intervention-boundary, outbox-port
- `openspec validate retire-legacy-adaptive-entrypoints --type change --strict`
- `openspec/changes/archive/2026-08-29-retire-legacy-adaptive-entrypoints/`
- No deployment, production selector activation, or data deletion

## Rollback

Restore this PR's parent and revert the KAQ test move. Re-running the same architecture scan must pass. Do not restore a second production Assessment/Personalization authority.

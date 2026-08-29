# Inventory — retire-legacy-adaptive-entrypoints

Frozen against `origin/integration` `a6c32f37289cdc3e2667a80589204fe645364197` before this change's deletions. Production vs test/docs are classified separately. Frozen global census files are historical observations, not current authority.

## Deleted in this change

| Path / symbol | Owner | Production callers at freeze | Replacement | Disposition |
| --- | --- | --- | --- | --- |
| `src/features/adaptive-learning/kaq-quiz-coverage.ts` | Assessment | none; only `src/features/adaptive-learning/__tests__/kaq-quiz-coverage.test.ts` | `@/features/adaptive-assessment/kaq-quiz-foundation` | deleted; test moved to `src/features/adaptive-assessment/__tests__/kaq-quiz-foundation.test.ts` |
| `src/features/adaptive-learning/` directory | Assessment | none | canonical Assessment modules | removed after the forwarding file |

## Already deleted by qualified predecessors (must stay absent)

| Path | Predecessor | Replacement public API |
| --- | --- | --- |
| `src/lib/adaptive-learning-path-planner.ts` | `cutover-personalization-path-planner` | `@/features/personalization/path-planning/public-api` (`planLearningPath`) |
| `src/lib/act-prerequisite-path-planner/` | same | same public API (`planActPrerequisitePath`, `applyLearningPathConsumerActivation`) |
| `src/lib/data-governance/adaptive-learner-state-service.ts` | `reduce-personalization-learner-state` | `@/features/personalization/learner-state/public-api` |
| `src/lib/data-governance/recommendation-engine.ts` | `migrate-personalization-recommendations-and-interventions` | `@/features/personalization/recommendations/public-api` |
| `src/features/ai/companion/intervention-engine.ts` | same | `@/features/personalization/interventions/public-api` |
| `*WithPersistenceFallback`, `isAdaptiveAssessmentPersistenceEnabled`, Map asked/answer stores | `cutover-path-owned-assessment-attempts` | Assessment `public-api` durable path |

## Retained (not a second Assessment/Personalization authority)

| Entry | Owner | Why retained | Deletion condition |
| --- | --- | --- | --- |
| `ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED === 'false'` | Assessment | fail-closed configuration error via `assertDurableAssessmentPersistence`; does not select Map/process-local attempts | may be removed later; must not regain a true branch |
| `globalThis.__adaptiveAssessmentStore.generatedQuestions` | Assessment | owner/session template practice for `/api/assessment/generate-question`; path-owned next/submit use reviewed catalog + durable sessions; published generated items use catalog overlay | zero generate-question consumers, or a durable practice store replacing the Map |
| `src/features/assessment/micro-intervention-learning-evidence.ts` `processPendingMicroInterventionEvidenceProjections` | Assessment fact adapter | Learning Record outbox port is the only production caller; request routes no longer call it | new protocol remains qualified and Learning Record inlines materialization without this adapter |
| Prisma `EvidenceOutbox` (`dedupeKey` unique) | Learning Record | worker-only async LearningFact path | other-domain producers still exist |
| Prisma `Question` / `UserAnswer` | admin data-governance / extracurricular analytics | not path-owned Assessment writes | other-domain readers remain |
| Prisma `AdaptiveAssessmentSession` / `Answer` / generated-candidate tables | Assessment | canonical durable attempt/catalog | n/a |
| `src/lib/adaptive-path-*`, `src/lib/adaptive-planning/*`, `src/lib/adaptive-generation-readiness.ts`, `src/lib/adaptive-cold-start-detection.ts`, `src/lib/adaptive-learning-optimization-experiments.ts` | path UI / planner adapters | not the deleted `src/lib/adaptive-learning-path-planner` authority | separate ownership; not this retirement |
| `src/features/adaptive/*` learning-center UI | Adaptive UI | not `src/features/adaptive-learning` forwarding | n/a |
| `ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG` | Adaptive UI | UI region flag, not persistence fallback | n/a |
| Historical `plannerVersion: 'adaptive-learning-path-planner.v1'` strings | path persistence schema | version discriminator on stored plans, not an import of the deleted module | do not rewrite history |

## EvidenceOutbox producer / consumer map at freeze

| Surface | Role | Status |
| --- | --- | --- |
| remediation events/validation routes | stage only via Personalization `stageInterventionEvidenceProjection` | no request-path `processPending*` |
| `scripts/workers/data-governance-worker.ts` | unique async materializer | `applyAllStagedMicroInterventionEvidence` |
| Learning Record `personalization-ports/outbox.ts` | protocol owner | wraps Assessment adapter; rejects direct+outbox double write; privacy projection |
| Arena writeback, teacher evidence interventions, path rounds, Konling simulation | other-domain producers | retained; not this change |

## Dynamic imports / generated entrypoints

Scan of `src/app`, `src/features`, `src/lib`, `scripts` (excluding `__tests__` and `*.test.*`) found no `import()`/`require()` of retired paths. Next.js routes listed above are the production HTTP entrypoints. No generated barrel re-exports the deleted files.

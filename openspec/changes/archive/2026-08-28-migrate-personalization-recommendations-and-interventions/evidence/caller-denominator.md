# Caller denominator — migrate-personalization-recommendations-and-interventions

Pre-move production imports of the old strategy files. Tests and docs are listed separately so 4.1 can prove zero **production** imports.

## recommendation-engine.ts

| File | Kind | After this change |
| --- | --- | --- |
| `src/app/api/student/recommendations/route.ts` | production | `recommendLearning` from Personalization public API |
| `src/lib/data-governance/profile-center.ts` | production types | Personalization recommendation types |
| `src/app/(main)/profile/page.tsx` | production types (client) | `recommendations/types.ts`（无 Prisma） |
| `src/lib/data-governance/__tests__/recommendation-engine.test.ts` | test | moved to `personalization/recommendations/__tests__/engine.test.ts` |
| `src/lib/data-governance/__tests__/profile-route.test.ts` | test mock | mock Personalization public API or drop unused mock |
| `src/lib/data-governance/__tests__/teacher-insights-evidence-governance.test.ts` | test mock | same |
| `src/features/personalization/learner-state/__tests__/learner-state-reducer.test.ts` | test path list | update to new engine path |
| `src/features/personalization/plugins/__tests__/plugin-registry.test.ts` | test path list | update to new engine path |

Deletion condition: no remaining production `from '@/lib/data-governance/recommendation-engine'`.

## intervention-engine.ts

| File | Kind | After this change |
| --- | --- | --- |
| `src/app/api/ai/intervention/check/route.ts` | production | `decideIntervention` |
| `src/app/api/ai/intervention/generate/route.ts` | production types | Personalization intervention types |
| `src/lib/konling-agent-runtime.ts` | production | `decideIntervention` / policy via Personalization public API |
| `src/lib/konling-intervention-client-payload.ts` | production types | Personalization intervention types |
| `src/features/ai/companion/ai-companion-panel.tsx` | production types (client) | `interventions/policy.ts` types |
| `src/features/ai/__tests__/intervention-engine-context.test.ts` | test | moved to `interventions/__tests__/policy.test.ts` |
| `tests/arena-companion-multi-method-1181.spec.ts` | Playwright source list | new policy path |

Deletion condition: no remaining production `from '@/features/ai/companion/intervention-engine'`.

## Micro-intervention outbox producers / consumers

| File | Role | After this change |
| --- | --- | --- |
| `src/app/api/assessment/remediation/interventions/events/route.ts` | producer | Personalization `stageInterventionEvidenceProjection` only |
| `src/app/api/assessment/remediation/interventions/validation/route.ts` | producer | same |
| `scripts/workers/data-governance-worker.ts` | unique async materializer | Learning Record `applyStagedMicroInterventionEvidence` |
| `src/features/assessment/micro-intervention-learning-evidence.ts` | retained Assessment fact adapter | listed in deprecation ledger; not deleted |

## Ports and owners

| Port | Owner | Deletion |
| --- | --- | --- |
| Recommendation evidence reads (snapshot, facts, risks, feature cache, userProgress) | Learning Record adapter | keep; Personalization engine must not import `@/lib/prisma` |
| EvidenceOutbox stage/apply for `micro-intervention-evidence` | Learning Record | keep Prisma `EvidenceOutbox` table |
| `MicroInterventionOutcome` / events / validation | Assessment | keep tables |
| `AIIntervention` persistence / cooldown | Konling runtime | keep; strategy decision comes from Personalization |
| Arena official evaluation | Arena evaluator | unchanged |
| learner-state reducer / control-correction plugin | Personalization (prior changes) | unchanged |
| Path planner | only via its public contract if a rule needs it; this change does not cut over planner |

## Equivalent outbox states

| Spec name | Durable `EvidenceOutbox.status` |
| --- | --- |
| staged | `pending` |
| applied | `projected`（含 `shadow` 投影回执） |
| deduplicated | unique `dedupeKey` upsert；watermark 冲突记 `superseded` |

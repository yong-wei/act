# Deprecation ledger — migrate-personalization-recommendations-and-interventions

Do not edit the frozen global `docs/architecture/deprecation-ledger.md` census in this change.

| Old entry | Consumers at freeze | Replacement | Deleted at | Evidence |
| --- | --- | --- | --- | --- |
| `src/lib/data-governance/recommendation-engine.ts` public strategy | student recommendations route; profile-center and profile page types | `@/features/personalization/recommendations/public-api` (`recommendLearning`) and `recommendations/types.ts` | this change | `recommendation-intervention-boundary` test; production files listed in `caller-denominator.md` |
| Convenience re-exports `getRecommendedScaffolding` / `getCompetencyLabel` / `getCompetencyLevel` from recommendation-engine | none in production (already imported from `risk-detector` / `competency-model`) | keep those modules as owners | this change | grep of production imports |
| `src/features/ai/companion/intervention-engine.ts` public strategy | AI intervention check/generate, Konling runtime, client payload, companion panel types | `@/features/personalization/interventions/public-api` (`decideIntervention`) and `interventions/policy.ts` for client types | this change | boundary test; policy tests |
| Request-path `processPendingMicroInterventionEvidenceProjections` in remediation events/validation routes | those two routes | Learning Record `applyStagedMicroInterventionEvidence` used only by the data-governance worker | this change | events/validation source no longer contains processPending; worker imports LR port |

## Retained fact adapters (not deleted)

| Adapter | Owner | Reason |
| --- | --- | --- |
| `src/features/assessment/micro-intervention-learning-evidence.ts` | Assessment | Envelope construction, watermark, validation weight cap, `not-terminal-mastery`; Learning Record port wraps enqueue/process |
| Prisma `EvidenceOutbox` | Learning Record | Unique `dedupeKey`; durable statuses `pending`/`projected`/`superseded` equal spec staged/applied/deduplicated |
| Prisma `MicroInterventionOutcome` / events / validation | Assessment | Scoring and independent-validation handoff |
| Prisma `AIIntervention` | Konling runtime | Persistence/cooldown; strategy decision is Personalization |
| Prisma `LearningFact` / snapshots / feature cache | Learning Record | Recommendation reads via `RecommendationEvidenceDb`; async Facts only from worker for this outbox path |
| Arena evaluator / official scores | Arena | Explicit non-goal |

## Privacy and rollback

- Public recommendation/outbox receipts use aggregated rationale and projection-task payloads. `assertPrivacySafeOutboxProjection` rejects raw answer/prompt/identifier keys.
- Rollback: restore the deleted engine files from this PR's parent and revert route imports. No production selector or historical fact migration is part of this change.
- Not deployed, not production-activated.

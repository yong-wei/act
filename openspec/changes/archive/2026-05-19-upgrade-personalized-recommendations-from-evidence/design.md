## Context

The previous phases make raw learning evidence cataloged, materialized, and cached. This final phase moves visible personalization consumers onto that governed evidence path. It should improve trust and consistency without replacing the existing competency model or inventing a new recommender.

## Goals / Non-Goals

**Goals:**

- Make profile and recommendation consumers prefer governed facts, snapshots, summaries, or evidence feature cache data.
- Add reason codes, evidence windows, evidence counts, and confidence markers to recommendation/profile outputs where relevant.
- Limit raw source-table reads to explicit audit, drilldown, migration, or debug paths.
- Preserve existing recommendation scope while improving evidence quality and explanation.
- Add tests that prove low-confidence and missing-evidence states are surfaced.

**Non-Goals:**

- Building a new AI recommendation engine.
- Redesigning learner or teacher page layouts.
- Changing the six-dimension competency model.
- Materializing new historical evidence or changing cache generation rules.
- Treating passive views as direct competency improvement evidence.

## Decisions

### Decision 1: Personalization consumes governed evidence first

Recommendation and profile services should prefer the feature cache and governed facts. Existing raw reads can remain only where they serve traceability or a detailed drilldown.

### Decision 2: Explanations are data contracts

Reason codes, evidence windows, evidence counts, and low-confidence markers should be part of API/service output, not only UI prose. This keeps teacher, student, and admin surfaces consistent.

### Decision 3: Missing evidence must not look precise

When evidence is sparse, stale, or low confidence, recommendations must expose that state. The system should not present a precise diagnosis from incomplete evidence.

### Decision 4: No new recommender in this phase

The change improves evidence plumbing and explanations. Algorithmic overhaul, AI-generated learning paths, or ranking experiments should be separate changes after the governed evidence path is stable.

## Risks / Trade-offs

- [Risk] Consumer changes can become broad. -> Limit scope to existing profile/recommendation consumers and service outputs.
- [Risk] Explanations can drift from scoring logic. -> Generate reason metadata from the same governed evidence reads used for recommendation decisions.
- [Risk] Missing cache data can degrade UX. -> Return explicit low-confidence and fallback states rather than hiding the gap.

## Migration Plan

1. Identify current profile and recommendation consumers that read raw or fragmented evidence.
2. Switch core evidence reads to the governed feature cache or governed fact services.
3. Add reason metadata to service/API outputs.
4. Preserve raw reads only for audit and drilldown.
5. Add focused tests and manual checks for recommendation rationale and low-confidence states.

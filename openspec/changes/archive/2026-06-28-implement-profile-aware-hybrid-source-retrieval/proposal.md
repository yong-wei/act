## Why

Source Pack cannot be useful if it only performs naive text matching. Different consumers need different retrieval behavior: lesson and homework authoring need broad, authoritative, reviewable evidence; Konling needs concise student-visible citations; path planning needs goal-aligned resource evidence without bypassing PlanningUnit eligibility. Retrieval therefore needs profile-aware filtering, mixed signals, ranking, diversity, and evaluable diagnostics.

## What Changes

- Implement Source Pack retrieval profiles for `handout-authoring`, `assessment-item`, `konling-answer`, `path-planning`, and `lesson-design`.
- Combine lexical/exact, graph/objective, authority, freshness, learner-context, and semantic/vector signals where available.
- Apply permission and AI-use filtering before ranking and serialization.
- Add pack assembly rules for source diversity, modality diversity, excerpt budgets, and limitation reporting.
- Add evaluation fixtures for common queries and failure modes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `source-pack-retrieval`: Add profile-aware hybrid retrieval, ranking, diversification, and evaluation requirements.
- `learning-evidence-rag-corpus`: Reuse existing hybrid ranking signals and governed scope filtering as Source Pack inputs.

## Impact

- Proposed modules: `src/lib/source-pack/hybrid-retriever.ts`, `retrieval-profiles.ts`, `pack-ranker.ts`, `pack-diversifier.ts`, `source-pack-eval.ts`.
- Proposed tests: exact term, formula, graph-bound, student-visible, teacher-scoped, path-planning, and no-result limitation cases.
- No production vector service is required in this change; semantic/vector signals may be optional inputs with deterministic lexical/graph fallback.

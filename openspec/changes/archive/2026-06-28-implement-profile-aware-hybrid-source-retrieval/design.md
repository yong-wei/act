## Design

Retrieval is a staged pipeline:

1. Normalize the query, graph context, objective context, resource constraints, role, and profile.
2. Filter candidates by visibility, AI-use permission, review state, source type, and profile policy.
3. Score candidates using exact/lexical, graph/objective alignment, authority, freshness, learner-context, resource eligibility, and optional semantic/vector scores.
4. Diversify the pack by source type, resource, modality, and citation target.
5. Serialize selected evidence plus excluded/limited coverage reasons.

## Profiles

- `handout-authoring`: broad, high-authority, teacher-scoped where allowed, emphasis on chapters, figures, equations, and concept boundaries.
- `assessment-item`: reviewed, non-frontier course content; avoid answer leakage and hidden learner data.
- `konling-answer`: concise, student-visible, citation-ready, privacy-filtered before ranking.
- `path-planning`: goal-aligned resource evidence, distinguishes PlanningUnit eligibility from supporting citations.
- `lesson-design`: broader than Konling but still bounded for authoring review.

## Evaluation

The implementation should include deterministic fixtures for representative course queries such as root locus, phase margin, PID integral action, simple feedback system, and controlled object. Evaluation checks should assert citation readiness, profile filtering, source diversity, and limitation reporting rather than only top-1 text relevance.

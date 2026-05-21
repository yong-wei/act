## Context

Arena profile aggregation currently returns controller count, method distribution, identification models, recent submissions, personal bests, frequent failure objects, and improving metrics. It does not map those signals back to training capabilities or recommended challenges.

## Goals / Non-Goals

**Goals:**

- Build a student Arena growth summary from official submission history.
- Recommend challenges based on missing capabilities, weak metrics, and next training stage.
- Integrate with the profile API and page without replacing the broader competency model.

**Non-Goals:**

- Do not implement teacher reports here.
- Do not create badges or showcase walls here.
- Do not fabricate competence from non-official submissions.

## Decisions

- Use `arena-training-map` metadata as the capability taxonomy.
- Use official Arena submissions as the primary evidence source.
- Reuse `LearningRecommendation` only if the recommendation lifecycle needs persistence.

## Risks / Trade-offs

- Recommendations can overfit sparse submissions. Include reason strings and fallbacks.
- Profile data can become noisy. Keep Arena growth separate from general competency snapshots.

## Migration Plan

1. Add capability aggregation from Arena submissions.
2. Add next-challenge recommendation helpers.
3. Extend profile API and page.
4. Add tests for sparse, improving, failing, and high-performing students.

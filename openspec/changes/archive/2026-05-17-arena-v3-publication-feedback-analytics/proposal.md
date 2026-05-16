## Why

After Arena official evaluation becomes reliable enough for backend use, teachers and students need to consume those results as teaching evidence rather than raw leaderboard rows. This change turns publication submissions, metrics, hard-constraint failures, and LearningFact context into report, feedback, and profile/insight surfaces without changing official scoring.

## What Changes

- Add publication-level teacher reports with participation, submission, validity, score, hard-constraint, metric, method, non-submission, personal-best, and excellent-solution summaries.
- Add reusable student diagnostic feedback rules for official Arena submissions, including whether the result ranked, hard-constraint reasons, metric satisfaction, personal-best comparison, bottleneck, and next-step suggestions.
- Make student submission panels and the future unified workbench submission panel consume the same feedback rules rather than each rendering separate explanations.
- Add Arena evidence summary builders for student profile and teacher class insight consumption.
- Aggregate from persisted Arena submissions and LearningFact Arena context, not from front-end reconstruction.
- Keep hidden black-box scenario details private while still explaining aggregate weaknesses.

## Capabilities

### New Capabilities

- `arena-publication-reporting`: Teacher-facing publication analytics and report entry points for Arena assignments.
- `arena-student-diagnostic-feedback`: Reusable student-facing diagnostic feedback generated from official Arena submission results.
- `arena-learning-evidence-consumption`: Student profile and teacher class insight summaries derived from persisted Arena submissions and Arena LearningFact context.

### Modified Capabilities

- None.

## Impact

- Depends on `arena-v3-plant-adapter-and-blackbox-official-evaluation` for stable black-box official metrics and protocol identity.
- `src/features/arena/teacher/**`
- `src/app/teacher/arena/publications/[publicationId]/page.tsx`
- `src/features/arena/student/**`
- `src/features/arena/submissions/**`
- `src/features/arena/analytics/**`
- `src/lib/data-governance/**`
- `src/app/api/user/profile/route.ts`
- `src/app/api/teacher/classes/[classId]/insights/route.ts`
- Teacher Arena, student profile, class insight, publication, feedback, and analytics tests

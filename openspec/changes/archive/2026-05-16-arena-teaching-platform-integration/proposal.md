## Why

Arena already has submissions, leaderboards, black-box experiments, teacher preview configuration, and basic LearningFact materialization, but these pieces do not yet form a teaching workflow. Teachers cannot persist and publish Arena challenges to classes, students cannot enter from a class assignment context, and Control Odyssey results do not become Arena submissions.

## What Changes

- Add a persisted Arena publication model for teacher-published class/course/public challenges with deadline, visibility, homework binding, grading policy, and leaderboard policy.
- Add teacher publication APIs beyond preview, including create/list/update or pause operations scoped to the teacher's classes.
- Let students resolve published Arena challenges from class and homework contexts and carry `publicationId`, `classId`, and optional `seasonId` into official submissions.
- Add class-scoped leaderboard behavior that respects publication visibility and deadline rules.
- Extend Arena LearningFact materialization so high-value Arena facts preserve Arena context in the available storage shape and can be aggregated by student and class insight code.
- Map Control Odyssey completion into an Arena-recognizable result artifact and submit it through `/api/arena/evaluate`; keep the existing Odyssey score and credit system independent.
- Add teacher and student UI surfaces that expose the publication lifecycle without turning preview configuration into a fake publish.

## Capabilities

### New Capabilities

- `arena-publication-workflow`: Teachers can persist, manage, and expose Arena challenge publications to classes or broader course audiences.
- `arena-assignment-submission-context`: Arena submissions can carry publication, class, and season context and can be filtered for class assignment leaderboards.
- `arena-learning-evidence-context`: Arena high-value learning facts retain enough Arena context for student profile and teacher class insight aggregation.
- `arena-odyssey-submission-bridge`: Control Odyssey completion can produce an Arena official submission without replacing the existing Odyssey scoring system.

### Modified Capabilities

- None. This repository currently has no active baseline specs under `openspec/specs/`.

## Impact

- Prisma schema and migrations for Arena publication and submission context
- `src/features/arena/teacher/*`
- `src/app/teacher/arena/page.tsx`
- New or extended `src/app/api/arena/publications/*` and teacher Arena APIs
- `src/app/api/arena/evaluate/route.ts`
- `src/features/arena/submissions/*`
- `src/features/arena/leaderboards/*`
- `src/lib/data-governance/*`
- `src/resources/interactive-learning/control-odyssey/*`
- `src/app/actions/control-odyssey.ts`
- Teacher, student, Arena, data-governance, and Odyssey tests

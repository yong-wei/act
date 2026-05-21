## Why

The student profile already aggregates Arena submissions, methods, failures, personal bests, and improving metrics. Arena Pro needs these signals to become a growth map and next-challenge recommendation system.

## What Changes

- Add Arena growth summaries by capability and metric.
- Recommend next challenges from training metadata and personal submission history.
- Surface skill radar, weak capability signals, and recent improvement in the student profile.

## Capabilities

### New Capabilities

- `arena-student-growth-recommendation`

### Modified Capabilities

- None.

## Impact

- `src/features/arena/profile.ts`
- `src/app/(main)/profile/page.tsx`
- `src/app/api/user/profile/route.ts`
- `prisma/schema.prisma` or `LearningRecommendation` integration if persistence is needed

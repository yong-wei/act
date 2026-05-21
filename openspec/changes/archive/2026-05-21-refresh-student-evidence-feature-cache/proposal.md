## Why

StudentEvidenceFeatureCache exists and recommendation can read it, but production showed zero cache rows. The cache must become part of worker and scheduler closure rather than a manual rebuild artifact.

## What Changes

- Refresh cache after student snapshot jobs or enqueue a cache refresh job.
- Add daily stale refresh or full rebuild scheduling.
- Expose activity30d, activityAll, competencyContributions30d, and competencyContributionsAll windows.
- Keep missing, stale, partial, and ready states explicit.

## Capabilities

### New Capabilities

- `student-evidence-feature-cache`

### Modified Capabilities

- None.

## Impact

- scripts/workers/data-governance-worker.ts
- scripts/workers/scheduler.ts
- scripts/workers/types.ts
- src/lib/data-governance/student-evidence-feature-cache.ts

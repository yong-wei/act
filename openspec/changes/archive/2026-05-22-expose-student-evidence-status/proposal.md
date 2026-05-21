## Why

Student profile and recommendations can show precise claims even when feature cache is missing, stale, or low confidence. Learner-facing surfaces need evidence state, source coverage, freshness, and rationale metadata.

## What Changes

- Add evidenceStatus to /api/user/profile.
- Read StudentEvidenceFeatureCache through governed feature services.
- Expose evidence window, source counts, source coverage, confidence markers, status markers, and refreshedAt.
- Preserve recommendation rationale fields such as evidenceBasis, evidenceCount, sourceCoverage, and confidence.

## Capabilities

### New Capabilities

- `student-evidence-status`

### Modified Capabilities

- None.

## Impact

- src/app/api/user/profile/route.ts
- student profile UI
- recommendation card mapping

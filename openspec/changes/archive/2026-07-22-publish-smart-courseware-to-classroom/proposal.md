## Why

Previewable generated courseware does not satisfy the contest until teachers can pass deterministic gates, publish an immutable revision, find it in the existing catalog, and run the exact revision in a classroom without later edits changing the session.

## What Changes

- Persist content-hash-bound static and browser gate receipts.
- Add independent courseware version numbers, individual goal/module source-gap and stale-plan acknowledgements, and immutable publication.
- Materialize published revisions into existing `LessonPlan`/`LessonItem`/`TeachingResource` catalog projections.
- Bind generated classroom sessions to an exact published courseware revision and manifest hash.
- Deliver the deterministic and real-provider 45-minute root-locus end-to-end demonstration, including natural-language multi-turn task intake and content-quality evidence.

## Capabilities

### New Capabilities

- `smart-courseware-publication`: deterministic publication eligibility, immutable courseware revisions, catalog projection, and contest demo acceptance.

### Modified Capabilities

- `audit-remediation-teacher-classroom-lifecycle`: generated sessions preserve exact immutable courseware revision identity through runtime and finalization.

## Impact

- Depends on `add-smart-courseware-generation-editor`.
- Adds publication transactions, gate receipts, runtime projections, classroom revision relations, integrity recovery, and end-to-end tests.

## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- Course pages do not copy fragile finalization sequences.
- Post-class data phases are visible and recoverable.
- 5-3 to 5-6 can be verified immediately after class.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Centralize finalization before extending it beyond module 5.
- Report partial closure instead of pretending all phases succeeded.
- Keep teaching content and page order unchanged.

## Risks / Trade-offs

- Finalization touches live classroom behavior. Mitigate with tests and rollout first through module 5 finalizers.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

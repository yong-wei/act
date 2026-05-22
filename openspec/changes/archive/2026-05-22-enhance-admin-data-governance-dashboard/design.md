## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- Admin UI matches CLI evidence governance reports.
- Operators can identify stale cache and red sessions without database shell access.
- Test, seed, showcase, and demo provenance remains separate from real activity.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Wrap existing report services rather than duplicating SQL.
- Keep filtering by session, lesson, and date where available.
- Expose provenance and exclusion reasons.

## Risks / Trade-offs

- Admin dashboard can become too broad. Mitigate by tab separation and compact summaries.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

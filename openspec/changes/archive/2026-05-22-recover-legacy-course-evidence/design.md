## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- Unrecoverable legacy data remains honest and visible.
- Recovery is idempotent and traceable.
- 5-1 can be improved only where source evidence exists.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Never fabricate answers, score, correctness, or question summaries.
- Treat final-state recovery as enriched but not original attempt evidence.
- Use scoped session or lesson apply after dry-run.

## Risks / Trade-offs

- Operators may over-apply historical recovery. Mitigate with dry-run default and explicit apply flags.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

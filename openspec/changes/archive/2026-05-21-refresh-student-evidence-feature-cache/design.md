## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- Cache refresh is deterministic and idempotent.
- Snapshot jobs produce usable evidence cache without requiring SSH-only manual rebuild.
- Normal recommendation and profile consumers can distinguish missing cache from ready cache.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Start with per-student refresh after snapshot job as the minimal reliable path.
- Add queue-based refresh only if latency or worker pressure requires it.
- Default learner-facing consumers to recent windows while retaining all-time audit windows.

## Risks / Trade-offs

- Synchronous refresh can slow snapshot jobs. Mitigate by measuring and moving to a queue if needed.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

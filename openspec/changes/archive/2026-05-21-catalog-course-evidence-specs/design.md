## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- Course-specific evidence metadata is centralized.
- 5-3 to 5-6 are locked by tests before the next teaching sessions.
- Unsupported historical lessons are classified explicitly.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Infer defaults from runtime manifest when possible.
- Use centralized override records for known exceptions.
- Do not scatter unit51/unit52 style state names across page code.

## Risks / Trade-offs

- Automatic pre/post inference can be wrong. Mitigate with explicit overrides and tests for module 5.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

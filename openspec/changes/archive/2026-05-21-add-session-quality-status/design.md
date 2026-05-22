## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- Quality status is deterministic and explainable.
- Red/yellow states do not hide underlying metrics.
- CLI and UI use the same status decision.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Use thresholds from the professional plan: green for high rich+partial coverage and no severe sync problems, red for high missing/legacy or unresolved high severity incidents.
- Expose reasons as first-class output.

## Risks / Trade-offs

- Thresholds may need calibration after real classes. Mitigate by keeping metrics visible and thresholds centralized.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

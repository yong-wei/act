## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- One classifier defines quality semantics for all governance consumers.
- Legacy and missing evidence remain visible but cannot look like rich evidence.
- The classifier is pure and unit-testable against stored responseData payloads.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Use a summary object instead of a bare enum so downstream reports can explain why a payload is rich, partial, legacy, or missing.
- Treat manifest-submission-v2 with no answer, parameter, or extra evidence as missing, not partial.
- Treat final-state recovery as a distinct source state in the summary.

## Risks / Trade-offs

- Migration can change report counts. Mitigate with fixture tests that compare old known cases and new canonical semantics.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

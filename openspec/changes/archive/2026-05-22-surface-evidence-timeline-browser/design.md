## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- Newest evidence is visible by default.
- High-score representative evidence is separate from timeline ordering.
- Full evidence browse reads governed LearningFact data and linked submission summaries.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Default ordering is startedAt desc, then createdAt desc.
- Keep old summary fields compatible while adding time and quality fields.
- Return submission summaries and source metadata without exposing excessive raw text by default.

## Risks / Trade-offs

- Payload shape changes can affect existing UI. Mitigate with normalization and backward-compatible fields.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

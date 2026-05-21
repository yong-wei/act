## Context

This change is part of the 2026-05-21 course data governance remediation series. It combines the professional data-governance plan with the production investigation of 5-1 and 5-2, where 5-2 rich evidence worked but 5-1 remained mostly legacy and 5-1/5-2 did not produce generic pre/post course tracking.

## Goals / Non-Goals

**Goals:**

- All response-producing runtime-first lessons are statically checked.
- The gate reports exact lesson and step identifiers.
- Direct COURSE_EVENT_TYPES.LESSON_SUBMIT usage is rejected in lesson pages.

**Non-Goals:**

- Do not rewrite course teaching content.
- Do not fabricate answers, scores, correctness, or question summaries from legacy data.
- Do not implement other changes in this series while applying this change.

## Decisions

- Inventory remains explicit enough for stable tests but can be generated from manifest metadata.
- Existing module 5 constants may remain as compatibility exports while the global inventory becomes authoritative.

## Risks / Trade-offs

- Some old lessons may need legacy classification. Mitigate by using unsupported or legacy status rather than silently omitting them.

## Migration Plan

1. Add or update the shared service boundary for this change.
2. Migrate the named consumers or reports to the shared boundary.
3. Add targeted tests and fixtures for rich, partial, legacy, missing, stale, and unsupported cases where relevant.
4. Run the targeted validation command named in tasks.md before broader lint/build verification.

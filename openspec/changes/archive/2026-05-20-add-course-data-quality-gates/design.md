## Context

Shared submission and sync governance improvements can regress unless future course pages are checked automatically. The gate should verify code paths and data output shape, not only TypeScript compilation.

## Goals / Non-Goals

**Goals:**

- Detect response-producing manifest pages that bypass shared submission evidence.
- Report session-level data usability after a class.
- Include 5-2 and later lesson coverage.
- Add implementation guidance so new courses know the gate.

**Non-Goals:**

- Implement shared submission evidence.
- Migrate course pages.
- Backfill historical rows.

## Decisions

### Decision: Use both static and data-level gates

Static tests can catch missing shared submit integration before runtime. Data-level reports can catch evidence quality problems after a session. Both are needed because static usage alone does not prove database usability.

### Decision: Make evidence quality explicit

The report should classify evidence as rich, partial, legacy, or missing. It should not rely on a single count such as `LearningFact` rows.

### Decision: Update the course implementation skill

Future course work follows the repo-local skill. The new gate must be written there so course authors do not repeat per-lesson telemetry drift.

## Risks / Trade-offs

- [Risk] Static guards may be brittle. Mitigation: base the guard on a course inventory and stable shared API names.
- [Risk] Quality reports may become too broad. Mitigation: focus on evidence availability, scoring, reports, snapshots, and sync incidents.
- [Risk] Skill updates can become prose-only. Mitigation: point to concrete commands and acceptance checks.

## Migration Plan

1. Add coverage inventory and static guard.
2. Add data-quality report command.
3. Add tests and dry-run fixtures.
4. Update implementation skill guidance.

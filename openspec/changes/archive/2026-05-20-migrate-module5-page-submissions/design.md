## Context

Module 5 lessons already share many manifest runtime primitives, but student pages still differ in how they submit activity-card answers, parameter snapshots, and custom panel outputs. This change consumes the shared submission evidence contract and makes 5-2 through 5-6 consistent.

## Goals / Non-Goals

**Goals:**

- Ensure every response-producing page in 5-2 and later module 5 lessons uses the shared submission path.
- Preserve all existing visible course behavior.
- Include special panel outputs in structured evidence.
- Add regression coverage that catches future page-level bypasses.

**Non-Goals:**

- Redesign module 5 lesson content.
- Migrate module 1-4 lessons.
- Change the shared evidence contract defined upstream.

## Decisions

### Decision: Inventory first, then migrate by lesson

The implementation should first enumerate all response-producing steps for 5-2 through 5-6. Migration should then proceed lesson by lesson so each page can preserve its state shape while using the same submit path.

### Decision: Treat parameter and training outputs as extra evidence

Custom outputs should be passed through `extraEvidence` rather than encoded as fake answers. This keeps activity-card answer summaries clean while preserving the data needed for diagnosis.

### Decision: Add a guard, not only spot tests

Unit tests for one page are insufficient. A static or manifest-driven inventory should fail if a module 5 response-producing step bypasses the shared submission path.

## Risks / Trade-offs

- [Risk] Course-specific teacher summaries may assume old response shapes. Mitigation: preserve `StudentState.responses` shape and standardize only telemetry evidence.
- [Risk] Custom panels may not map cleanly to card ids. Mitigation: store them in `extraEvidence` with step id and panel id.
- [Risk] The migration is broad. Mitigation: keep each lesson change mechanical and verify with targeted tests.

## Migration Plan

1. Build the module 5 response-page inventory.
2. Migrate 5-2 through 5-6 student submit paths.
3. Update affected teacher summaries only where necessary.
4. Add guard and targeted tests.

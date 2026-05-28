## Context

The current inventory shows 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 have runtime manifests with zero modules. Lesson 2-1 has 36 module kinds and many one-off names such as `formula-strip`, `drag-match-board`, `choice-check`, `path-highlight-stage`, and `three-field-form`.

This group should be migrated first because it establishes the pattern for moving old lesson-local pages into the standard module framework.

## Design

1. For 2-2 through 3-4, derive module lists from existing page contracts, runtime content, and student/teacher page behavior.
2. For 2-1, map every custom kind to canonical classes and response kinds.
3. Keep existing route segments, step ids, classroom codes, evidence specs, and submission behavior stable.
4. Preserve special workspace output as structured extra evidence where it cannot be represented by objective activity cards.
5. Mark the migrated lessons as standard-module lessons only after module and response gates pass.

## Non-Goals

- Do not rewrite lesson pedagogy.
- Do not replace the shared finalization adapter.
- Do not remove global legacy alias support; that is a later cleanup change.

## Risks

- Empty manifests require careful reconstruction from current runtime behavior; missing modules would degrade student pages.
- 2-1 includes custom interactions that must become canonical response kinds or structured extra evidence, not new module names.

## Verification

- Run focused tests for 2-1, 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4.
- Run module registry gates and submission data-quality gates.
- Run `npm run lint` if runtime code changes.
- Run `openspec validate migrate-early-lessons-to-standard-modules --strict`.

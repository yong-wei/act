## Context

The current inventory shows the most severe taxonomy divergence in 3-5, 3-6, and 3-7, with additional variants in 3-8. Many of these names are not real new capabilities:

- `derivation-reveal` and `step-reveal-list` map to `content.reveal`.
- `record-card`, `structured-submit`, and `worked-example-workspace` map to `activity.workspace` or structured text responses.
- `frequency-band-labeling`, `annotation-choice`, and `scenario-sort-matrix` map to canonical matching, classification, or ordering responses.
- `phase-peak-locator`, `shared-engine-root-locus-panel`, and `parametric-workspace` need compute/workspace contracts rather than custom module names.

## Design

1. Build a lesson-by-lesson alias map for 3-5 through 3-9.
2. Move card, table, formula, figure, and reveal variants to canonical content modules.
3. Move response-producing variants to canonical response kinds.
4. Move compute or parameter panels to `compute.panel` or `activity.workspace` with capability or structured evidence metadata.
5. Replace course-private renderer branches only after the standard runtime can render equivalent behavior.

## Non-Goals

- Do not simplify the lessons by dropping interactive evidence.
- Do not add new canonical module classes for one lesson's visual preference.
- Do not remove the legacy alias framework globally.

## Risks

- Some course-local workspaces have real interaction behavior and should not be flattened into static cards.
- Compute panel migration may expose missing capability references that need explicit migration exceptions.

## Verification

- Run focused tests for 3-5, 3-6, 3-7, 3-8, and 3-9.
- Run module registry and response contract gates.
- Run `npm run test:course-data-quality-gates`.
- Run `openspec validate migrate-variant-lessons-to-standard-modules --strict`.

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

## Alias Map

The runtime manifests keep the original variant name in `payload.legacyKind`
while replacing `module.kind` with the canonical class.

| Lesson | Legacy variants mapped to canonical module classes |
| --- | --- |
| 3-5 | `annotation-choice`, `binary-choice`, `frequency-band-labeling`, `quiz-group`, `rule-check`, `scenario-sort-matrix`, `short-response`, `single-choice-card`, `structured-compare` -> `activity.panel`; `worked-example-workspace` -> `activity.workspace`; `phase-peak-locator` -> `compute.panel`; card/list variants -> `content.cardSet`; graphic/figure variants -> `content.figure`; formula/table/stage variants -> `content.formula`, `content.table`, `content.stageMap`; `next-step-card` -> `layout.support`. |
| 3-6 | `categorize-and-confirm`, `quiz-group`, `short-response`, `single-choice`, `single-choice-card`, `structured-response`, `structured-submit` -> `activity.panel`; `parametric-workspace` -> `activity.workspace`; `parametric-risk-panel`, `shared-engine-root-locus-panel` -> `compute.panel`; `derivation-reveal` -> `content.reveal`; formula/table/figure/card/stage variants -> their matching canonical content classes; `drawer`, `entry-note` -> `layout.support`. |
| 3-7 | `activity-card-set`, `binary-choice-set`, `quiz-card`, `single-choice-card` -> `activity.panel`; `analysis-workspace` -> `activity.workspace`; `step-reveal-list` -> `content.reveal`; figure/formula/table/card/stage variants -> their matching canonical content classes; `feedback-strip`, `next-lesson-card` -> `layout.support`. |
| 3-8 | `activity-card-grid`, `card-sort`, `hotspot-labeling`, `quiz-group`, `reason-record`, `structured-compare` -> `activity.panel`; `interactive-figure-panel`, `rust-analysis-panel` -> `compute.panel`; `step-reveal-chain`, `step-reveal-column` -> `content.reveal`; graphic/media/formula/table/card variants -> their matching canonical content classes; `next-step-card`, `teacher-strip` -> `layout.support`. |
| 3-9 | `activity-card-set`, `table-builder` -> `activity.panel`; `rust-analysis-panel` -> `compute.panel`; `step-reveal` -> `content.reveal`; figure/formula/card variants -> their matching canonical content classes. |

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

## Context

The stable lesson group uses the shared manifest runtime more consistently than the early and variant-heavy groups. That makes this migration more mechanical, but it is still required: names such as `summary-card`, `formula-card`, `image-panel`, `native-table`, `activity-card-set`, and several rust or interactive panel variants should be represented by canonical module classes with explicit presentation and capability metadata.

## Design

1. Preserve all route segments, step ids, teacher controls, and evidence behavior.
2. Convert content modules to canonical classes and fields.
3. Convert activity slots to `activity.panel` plus canonical response contracts.
4. Convert rust or compute panels to `compute.panel` with registered capability references or approved migration exceptions.
5. Retain only course-local renderer overrides that represent real capability implementations, not naming aliases.

## Migration Inventory

The migrated stable group covers `4-1` through `4-7`, `5-1` through `5-6`, and `cruise-comfort-boppps`. The manifest inventory now resolves former content aliases to `content.rich`, `content.cardSet`, `content.formula`, `content.table`, `content.figure`, `content.reveal`, `content.stageMap`, or `layout.support`; former activity aliases to `activity.panel` or `activity.workspace`; former statistics aliases to `analytics.summary`; and real compute surfaces to `compute.panel`.

Compute panels are retained only where they represent real capability renderers:

- `4-1`: `interactive-figure` panels for ship/platform quadrant figures.
- `4-2`: `interactive-figure` panels for examples 5.1, 5.2, 5.3, 5.4, and ship candidate comparison.
- `4-3`: `interactive-figure` panels for disturbance feedforward, reference feedforward, setpoint filter, and anti-windup panels.
- `5-1`: `rust-analysis` panels for curve comparison pages.
- `5-2`: `interactive-figure` panels for phase-plane, harmonic balance, memoryless nonlinearity, relay/backlash, perturbation, and negative-inverse panels.
- `5-3`: `interactive-figure` panel for turning-radius analysis.
- `5-4`: `interactive-figure` panels for prediction error and route comparison.
- `5-5`: `interactive-figure` panels for toy training and heading RL training.
- `5-6`: `interactive-figure` panel for route comparison.

Lessons `4-4`, `4-5`, `4-6`, `4-7`, and `cruise-comfort-boppps` do not require compute panels after migration.

## Non-Goals

- Do not redesign the platform UI or course navigation.
- Do not rewrite course content.
- Do not remove final legacy alias support; the cleanup change handles that after this migration passes.

## Risks

- Some stable lessons intentionally hide or reveal modules based on teacher controls; migration must preserve teacher gating.
- Compute panels may need capability metadata not currently present in the manifest.

## Verification

- Run focused tests for migrated module 4, module 5, and cruise-comfort lessons.
- Run module registry gates and response gates.
- Run `npm run test:course-data-quality-gates`.
- Run `openspec validate migrate-stable-lessons-to-standard-modules --strict`.

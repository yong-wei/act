## Context

The stable lesson group uses the shared manifest runtime more consistently than the early and variant-heavy groups. That makes this migration more mechanical, but it is still required: names such as `summary-card`, `formula-card`, `image-panel`, `native-table`, `activity-card-set`, and several rust or interactive panel variants should be represented by canonical module classes with explicit presentation and capability metadata.

## Design

1. Preserve all route segments, step ids, teacher controls, and evidence behavior.
2. Convert content modules to canonical classes and fields.
3. Convert activity slots to `activity.panel` plus canonical response contracts.
4. Convert rust or compute panels to `compute.panel` with registered capability references or approved migration exceptions.
5. Retain only course-local renderer overrides that represent real capability implementations, not naming aliases.

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

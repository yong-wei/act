## Why

The largest module-kind explosion is concentrated in lessons 3-5, 3-6, 3-7, 3-8, and 3-9. These lessons include many single-lesson names that encode page intent, layout, or domain semantics rather than platform module capability.

## What Changes

- Migrate 3-5 through 3-9 to canonical modules and canonical response contracts.
- Replace one-off variants such as `derivation-reveal`, `step-reveal-list`, `parametric-workspace`, `frequency-band-labeling`, `phase-peak-locator`, and `scenario-sort-matrix`.
- Preserve complex workspaces through `activity.workspace`, `compute.panel`, structured extra evidence, and registered capability references.
- Add regression coverage so these lessons no longer need lesson-private module variants.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `interactive-course-standard-module-migration`: Adds the variant-heavy lesson group migration requirement.
- `interactive-module-taxonomy`: Applies canonical module classes to the most divergent manifests.

## Impact

- Affects runtime manifests and lesson-local panel code for 3-5, 3-6, 3-7, 3-8, and 3-9.
- May require shared runtime support for compute panels and structured workspaces.
- Does not change lesson sequence or mathematical content.

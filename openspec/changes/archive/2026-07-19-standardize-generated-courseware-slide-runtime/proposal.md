## Why

Generated courseware needs a deterministic page contract before an LLM editor can safely target it. The current interactive manifest supports ordered regions but does not guarantee fixed 16:9 geometry, non-overlapping slots, bounded module sizes, readable text, or repeatable layout validation.

## What Changes

- Define a generated-courseware hierarchy and a fixed 16:9 step/page boundary.
- Add finite registered layout templates, fixed grid slots, module size variants, and text budgets.
- Define the strict generatable content/activity allowlist on top of canonical module and response contracts.
- Add static occupancy/schema validation and pinned-browser overflow, clipping, overlap, formula-width, and font-size validation.
- Keep existing preset interactive lessons compatible without migrating them in this change.

## Capabilities

### New Capabilities

- `generated-courseware-slide-runtime`: fixed slide manifests, registered layouts and sizes, strict generatable modules, responsive rendering, and deterministic layout validation.

### Modified Capabilities

- None.

## Impact

- Extends shared manifest types, registries, layout renderer, validator scripts, and browser fixtures.
- Has no dependency on teacher source ingestion or LLM generation and can be implemented in parallel with the course-basis change.

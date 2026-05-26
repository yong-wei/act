## Overview

Create a server-safe registry module for interactive lesson identity. The
registry owns the canonical id and all accepted aliases. Consumers call one
resolver instead of embedding ad hoc maps.

## Registry Shape

Each record should include:

- `canonicalId`: short lesson id such as `5-3`.
- `runtimeLessonId`: runtime directory or full unit id.
- `routeSegments`: accepted route path aliases.
- `presetKeys`: teacher preset lesson keys.
- `lessonKeys`: manifest and event lesson keys.
- `planTitleAliases`: classroom plan-title aliases used in legacy sessions.
- `evidenceAliases`: aliases accepted by governance reports and backfills.

The resolver should expose strict and tolerant entry points:

- strict resolution for build-time checks and new code paths.
- tolerant classification for legacy rows, returning unsupported or ambiguous
  reasons rather than silently guessing.

## Migration Strategy

Start with existing mapping sources and make the new registry the source of
truth. Where a consumer still needs a legacy shape, generate or derive that
shape from registry records.

Initial migration targets:

- lesson id map and runtime lesson lookup.
- classroom session route aliases.
- session lesson snapshot logic.
- CourseEvidenceSpec lookup.
- course submission gate inventory.
- course AI context lookup.

## Drift Checks

Add tests or scripts that compare all identity surfaces against registry
records. The check must fail when a lesson appears in a consumer map but not in
the registry, or when a registry record is missing a required alias family.

## Open Questions

- Whether legacy lessons should live in the same registry with unsupported
  classification or in a separate legacy table.
- Whether generated compatibility maps should be committed or built in memory.

## Why

Interactive lesson identity is currently duplicated across short ids, route
segments, preset keys, lesson keys, runtime directories, plan aliases, evidence
specs, submission inventories, and AI contexts. That makes all-lesson evidence
governance fragile: one alias can be updated while reports, backfills, or
classroom routes continue to use an older identity.

## What Changes

- Add a canonical interactive lesson identity resolver and registry.
- Resolve short id, long lesson id, route segment, preset key, runtime
  directory, manifest lesson key, plan-title aliases, and evidence aliases to
  one canonical lesson id.
- Migrate identity consumers to the resolver or to generated artifacts derived
  from the resolver.
- Add drift checks so new or renamed interactive lessons cannot update only one
  mapping surface.

## Capabilities

### New Capabilities
- `interactive-lesson-identity-resolution`: Defines the canonical lesson
  identity registry, alias resolution behavior, and drift checks.

### Modified Capabilities
- None.

## Impact

- Affects classroom routing, lesson snapshots, evidence spec lookup,
  submission-gate inventory, AI context lookup, and lesson runtime discovery.
- Must apply to all interactive lessons. Lesson 5-3 is only a regression case.
- Does not change scoring, reporting semantics, or historical data.

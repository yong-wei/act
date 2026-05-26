## 1. Registry

- [x] 1.1 Add a canonical interactive lesson identity registry and resolver.
- [x] 1.2 Populate records for all currently registered interactive lessons.
- [x] 1.3 Return explicit unsupported or ambiguous classifications for legacy
  and incomplete identities.

## 2. Consumer Migration

- [x] 2.1 Migrate lesson id, route alias, runtime lookup, snapshot, evidence
  spec, submission inventory, and AI context consumers to the resolver or
  derived compatibility maps.
- [x] 2.2 Preserve existing public route and classroom behavior for current
  lesson aliases.
- [x] 2.3 Keep lesson 5-3 as a regression case without hardcoding it as the
  only supported lesson.

## 3. Validation

- [x] 3.1 Add drift tests that compare registry records with all identity
  consumers.
- [x] 3.2 Add resolver tests for canonical ids, long ids, route segments,
  preset keys, runtime dirs, manifest lesson keys, and plan-title aliases.
- [x] 3.3 Validate with `rtk openspec validate canonicalize-interactive-lesson-identity --strict`.

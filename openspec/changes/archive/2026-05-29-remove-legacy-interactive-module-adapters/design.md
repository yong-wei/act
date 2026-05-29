## Context

The alias layer is necessary while migration is underway, but it becomes a liability after all existing lessons have been converted. New lessons must not pass by adding course-specific kind names or relying on the alias layer.

## Design

1. Verify every existing runtime-first lesson is marked migrated and passes module, response, submission, and finalization gates.
2. Change module gates from alias-tolerant to strict for migrated and new manifests.
3. Keep any historical compatibility only behind explicit archive or legacy import paths that cannot be used for new authoring.
4. Remove lesson-private alias-only registry entries and tests that assert old kind names remain valid.
5. Update implementation guidance so new lessons use canonical modules from the start.

## Non-Goals

- Do not migrate courses in this final cleanup change; all migrations must already be complete.
- Do not remove legitimate compute capability renderers.
- Do not remove historical archives required for audit.

## Risks

- If a lesson was only partially migrated, this change will expose it as a hard gate failure. That is intended, but the apply phase must verify dependencies before starting.
- Removing alias-only tests may hide accidental behavior changes unless migrated lesson tests remain comprehensive.

## Verification

- Run the strict module registry gate.
- Run response contract and submission evidence gates.
- Run focused interactive lesson test inventory.
- Run `npm run test:course-data-quality-gates`.
- Run `openspec validate remove-legacy-interactive-module-adapters --strict`.

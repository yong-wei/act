## Context

Validation entrypoints should fail only on repository-owned source, tests, or intentionally governed generated artifacts. They should not be sensitive to sample repositories, local scratch directories, or a script's current filesystem depth.

## Decisions

- Lint should exclude `evaluate/**/*` consistently with `tsconfig.json`.
- Standalone scripts under `scripts/tests` should resolve repository modules through `@/*`, an explicit repo-root helper, or a correct relative path.
- This change should not weaken `--max-warnings=0`; it should reduce only false scope and resolution failures.

## Non-Goals

- Repairing all TypeScript errors.
- Repairing unit test assertion drift.
- Changing dependency versions.
- Suppressing real commercial UI governance failures.

## Verification

- `rtk npm run lint`
- `rtk npm run test:model-render-policy`
- `rtk openspec validate stabilize-validation-command-surfaces --strict`

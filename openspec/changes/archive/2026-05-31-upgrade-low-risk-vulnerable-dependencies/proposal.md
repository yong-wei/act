## Why

Several audit findings appear fixable through patch, minor, or lockfile-level dependency updates. These should be handled before major migrations so the remaining report is smaller and better attributed.

## What Changes

- Update low-risk vulnerable dependencies and transitive resolutions where the package line has compatible fixes.
- Target packages include `mathjs`, `bullmq`, `postcss`, `tailwindcss`, `vitest`, `eslint-config-next`, and related lockfile-only transitive packages when compatible.
- Keep framework major upgrades, auth migration, AI SDK migration, and `xlsx` replacement out of scope.

## Capabilities

### New Capabilities
- `dependency-vulnerability-catalog`: Adds the execution requirement for compatible patch/minor audit remediation.

### Modified Capabilities
- None.

## Impact

- Affects `package.json`, package lockfile, and dependency-driven tests.
- May require small test or config adjustments if tooling patch updates expose existing incompatibilities.
- Should not change user-facing behavior.

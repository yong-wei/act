## Why

The current Docker image installs and copies the full dependency tree, so production can run TypeScript worker and scheduler files through `tsx`. That works today, but it prevents the project from moving toward a clean production-only dependency model and hides whether packages belong to development tooling or runtime execution.

## What Changes

- Separate production runtime dependencies from development/build/test dependencies.
- Remove the production worker/scheduler reliance on development-only `tsx` by introducing a compiled JavaScript runtime path or by explicitly documenting a justified production dependency.
- Align Docker and Podman startup paths with the selected runtime dependency model.
- Do not perform broad package upgrades in this change.

## Capabilities

### Modified Capabilities
- `stable-dependency-chain-migration`: Requires production runtime dependency boundaries to be clean before major framework upgrades.

## Impact

- Affects Dockerfile, Podman worker startup, scheduler initialization, worker build output, and package dependency classification.
- Enables future production-only install or runtime pruning decisions.
- Requires production-focused validation in addition to local tests.

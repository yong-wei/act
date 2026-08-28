# Change: Remove duplicate host Next build

## Why

`scripts/build.sh` currently executes a complete production Next build on the host and repeats the same build in the Linux container builder. The host output is discarded and cannot be the release artifact because the production image must be compiled inside the target Linux environment. This doubles the dominant compilation and type-checking cost without adding an independent release guarantee.

## What Changes

- Replace the host `npm run build` with explicit release-input validation that does not generate `.next`.
- Keep CourseCoverage, external runtime, clean-worktree, optimized-model, Prisma schema/client, and TypeScript validation before Docker execution.
- Keep the Docker builder's `npm run build` as the sole complete production Next compilation.
- Preserve immutable revision labels, image tar SHA-256, provenance sidecars, cache publication ordering, and deployment boundaries.
- Add contract tests proving that the host path cannot invoke a complete Next build and that the container path still does.

## Non-Goals

- Changing application runtime behavior, Docker stage contents, release selectors, OSS publication, or deployment.
- Moving production compilation to macOS output.
- Adding GitHub Actions or PR CI.

## Impact

- Affected files: `scripts/build.sh`, build/release contract tests, package scripts only if needed.
- Affected capability: local release build validation.

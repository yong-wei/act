# Change: Minimize the container build context

## Why

The release Dockerfile copies the repository context into the builder. The current ignore policy admits more than 10 GB of lesson authoring media, documentation, historical knowledge workspaces, references, tests, and Rust sources that the production Next build explicitly excludes and the runner never copies. A fresh build transferred 11.62 GB before application compilation began.

## What Changes

- Establish an explicit container build-input contract covering application source, Prisma, optimized models, generated WASM, Next configuration, release scripts, and runtime/authority artifacts.
- Align `.dockerignore` with the existing Next trace exclusions and Docker runner copy contract.
- Retain `COPY . .` in the builder while the repository still has dynamic filesystem consumers; do not introduce a fragile grouped-COPY migration.
- Add regression tests for required and forbidden context paths and validate the real context through a fresh BuildKit transfer.
- Preserve external runtime, immutable revision, image provenance, and deployment behavior.

## Non-Goals

- Excluding `course-content/authoring/resources`, which remains present in current standalone tracing and needs a separate runtime-trace correction.
- Excluding runtime Authority cards/infographs/shards/projection or authoring authority/release inputs used by the runner.
- Changing Next tracing behavior, final image contents, OSS publication, or deployment.
- Adding GitHub Actions or PR CI.

## Impact

- Affected files: `.dockerignore`, container build-input contract tests, Docker readiness tests.
- Affected capability: container build input boundary.

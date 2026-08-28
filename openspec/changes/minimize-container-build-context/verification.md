# Verification Evidence

## Contract and static validation

- Container build context contract: passed.
- Docker migration, local cache, optimized-model, runtime externalization, runtime blob, remote deploy, and runtime-release remote deploy contracts: passed.
- `bash -n scripts/build.sh`: passed.
- `docker buildx build --builder act-local-build-cache --check .`: passed with no Dockerfile warnings.
- `openspec validate minimize-container-build-context --type change --strict`: passed.
- `npm run typecheck`: TypeScript compiler passed for web and worker; worker graph status passed. The web graph retained the pre-existing recorded documentation/tooling boundary status `blocked` under the repository's current non-failing receipt contract.

The context contract retains application, Prisma, model provenance, generated WASM, lesson-map, statically imported unit 3-6 and unit 4-1 analysis fixtures, Authority, projection, and runtime-governance inputs. It rejects the large non-runtime paths aligned with `next.config.js` trace exclusions and explicitly keeps authoring resources and runtime Authority media in scope.

## Fresh context transfer

- Revision: `e08ebf04acdb1db564dd18e3c20779397e47241d`.
- Builder: fresh temporary `docker-container` BuildKit instance with `FROM scratch` and `COPY . /context`; the instance was removed after measurement.
- Baseline: 11.62 GB transferred in 121.6 seconds.
- Result: 3.65 GB transferred in 27.2 seconds.
- Reduction: 7.97 GB, approximately 68.6 percent. The result remains above the lower bound because authoring resources and runtime Authority media are deliberate inputs in this change.
- Evidence: `/tmp/act-context-acceptance.K30ASF/context.log`.

## Full app-only image acceptance

- Revision and OCI label: `e08ebf04acdb1db564dd18e3c20779397e47241d`.
- Full build command: `BUILD_SCOPE=app-only OUTPUT_TAR=<temporary-path>/act-obe.tar ACT_BUILD_CACHE_ROOT=/Users/YW/Library/Caches/act-build-cache bash scripts/build.sh`.
- The host preflight ran Prisma validation/generation, optimized-model validation, and production TypeScript validation. The complete Next production compilation ran once inside the local Linux/amd64 Docker builder and completed successfully.
- Image tar SHA-256: `90ddc0a675d3263b961d4b564e7cc5786d9a769a63af5d11ea1eaacc6c10b3e0`; the provenance sidecar records the same digest and revision.
- Loaded runner verification: Chromium `151.0.7922.173`, LibreOffice `7.4.7.2`, `.app-revision` exact match, executable Wolfram readiness check, and required sealed registry, Authority manifest, domain shards, cards, infographs, and projection paths all passed.
- Evidence: `/tmp/act-context-image-acceptance.nsL0x0/build.log`, `/tmp/act-context-image-acceptance.nsL0x0/act-obe.tar`, and `/tmp/act-context-image-acceptance.nsL0x0/act-obe.tar.provenance.json`.
- No upload, remote load, service restart, runtime selector change, or production deployment was performed.

## Review disposition

- The release review initially found one P1: the context excluded JSON fixtures statically imported by production modules.
- The accepted finding was corrected with narrow lesson-path re-inclusions and a standard package test entry. A real builder target completed Next compilation, TypeScript, static generation, and trace pruning.
- Incremental re-review closed the P1 and found no newly introduced P0/P1 issues. The remaining static-test limitation is covered by the real builder and full image acceptance above.

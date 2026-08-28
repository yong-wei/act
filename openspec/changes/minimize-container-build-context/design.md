# Design

## Input denominator

The Docker context must retain:

- package and Next/TypeScript configuration, `src`, `public`, Prisma schema/config/migrations, and the entrypoint;
- generated control-engine WASM plus its build verifier;
- optimized model source/output assets, manifest, validator, and optimizer source used for provenance;
- build/prune scripts and runner operational script directories;
- the lesson ID map and assessment catalogs explicitly included by Next tracing;
- authoring Authority, release, CourseCoverage, and sealed envelope inputs copied into the runner;
- runtime resource projections, authority shards, learning-content manifest, cards, infographs, and teaching projection copied into the runner.

The context does not need lesson authoring media, questions, slide references, resource-library source, course tooling/docs/tests, general repository docs, OpenSpec history, generated design images, Rust sources when `SKIP_WASM_BUILD=1`, or repository tests. These paths are already excluded from production output tracing and are not copied by the runner.

## Selected mechanism

Use ordered `.dockerignore` rules with narrow re-inclusions. This removes known non-inputs before BuildKit hashing and transfer without changing the builder's file-layout assumptions. A grouped `COPY` rewrite is deferred because application code still contains dynamic filesystem reads and the runner packages numerous governance artifacts.

For `course-content/authoring/knowledge`, ignore the directory by default and re-include only:

- `releases/**`;
- `course-coverage/**`;
- `authority/**`;
- `cutover/envelopes/actkg-composite-envelope-registry.json`.

The existing offline governed-math exclusion and runtime allowlist remain fail-closed.

## Verification

- A static contract test checks ordered exclusions/re-inclusions and cross-checks required Docker/Next inputs.
- Existing Docker, cache, optimized-model, runtime externalization, runtime blob, and remote deploy contracts remain green.
- A fresh temporary BuildKit builder records actual transferred context size, independent of the shared cache.
- A full app-only release image confirms Next compilation, OCI label, tar hash, provenance, Chromium, LibreOffice, and required authority/runtime artifacts.

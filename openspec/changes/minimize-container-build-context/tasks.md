## 1. Build-input contract

- [x] 1.1 Add a container-context contract test for required application, Prisma, model, WASM, script, lesson-map, Authority, projection, and runtime-governance inputs.
- [x] 1.2 Add forbidden-path assertions for unused lesson authoring while preserving statically imported lesson fixtures, plus questions, references, course tooling/docs/tests, repository docs/OpenSpec/tests, generated images, and Rust sources.
- [x] 1.3 Assert that authoring resources and runtime Authority media remain admitted non-goals.

## 2. Context policy

- [x] 2.1 Align `.dockerignore` with production trace exclusions for unneeded course and repository paths.
- [x] 2.2 Default-deny authoring knowledge and narrowly re-include releases, CourseCoverage, Authority, and the sealed envelope registry.
- [x] 2.3 Preserve existing external runtime and script/tool allowlists without changing Dockerfile runner contents.

## 3. Verification

- [x] 3.1 Run context, Docker migration, cache, optimized-model, runtime externalization, runtime blob, and remote deploy contract tests.
- [x] 3.2 Run shell syntax, production typecheck, Dockerfile check, and strict OpenSpec validation.
- [ ] 3.3 Use a fresh temporary BuildKit builder to record transferred context size and compare it with the 11.62 GB baseline.
- [ ] 3.4 Run a full app-only release image build and verify revision label, tar digest, provenance, Chromium, LibreOffice, and required authority/runtime files without deployment.

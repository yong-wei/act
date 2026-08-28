## 1. Characterization and contracts

- [x] 1.1 Add a Docker/build-cache contract test that rejects runner-os dependencies on builder, application source, APP_REVISION, OpenSpec, or course/authority inputs.
- [x] 1.2 Add script-level tests for the shared default cache root, ACT_BUILD_CACHE_ROOT and legacy CACHE_ROOT overrides, rejection of every registered worktree path, normalized platform namespaces, fixed named builder, stable cache-mount IDs, and forced mode=max export.
- [x] 1.3 Add script-level tests for same-platform locking, stale-lock handling, failed-generation preservation, successful current-pointer publication, and runner-os-before-final-build ordering.

## 2. Stable runner operating-system layer

- [x] 2.1 Pin the shared Node base image by multi-architecture digest and introduce an application-independent runner-os stage.
- [x] 2.2 Make BUILD_OS_REV and RUNNER_OS_REV participate in their respective cache keys and move all Chromium, LibreOffice, font, and runtime system packages into runner-os.
- [x] 2.3 Add stable platform-scoped, sharing=locked npm, Prisma, and apt BuildKit cache-mount IDs; disable apt's cache-clean hook only inside mounted install steps.

## 3. Cross-worktree cache lifecycle

- [x] 3.1 Resolve the default ACT build cache outside worktrees, reject any configured root inside a registered ACT worktree, and isolate it by normalized target platform while retaining explicit legacy CACHE_ROOT compatibility.
- [x] 3.2 Implement a platform-scoped atomic mkdir lock with conservative same-host stale-lock recovery and cleanup traps.
- [x] 3.3 Export mode=max cache into a fresh generation and atomically replace the current symlink only after the final build succeeds; preserve the previous generation on failure.
- [x] 3.4 Ensure and select one named local buildx builder, then prewarm runner-os with cache-only output before the final image build using identical platform and system-layer arguments without separately publishing external cache.

## 4. Verification

- [x] 4.1 Run the new build-cache tests plus existing Docker migration, runtime externalization, optimized-model, runtime-blob, and remote-deploy contract tests.
- [x] 4.2 Run `openspec validate optimize-local-container-build-cache --type change --strict`, `npm run typecheck`, and shell syntax checks.
- [ ] 4.3 Build runner-os once against an isolated test cache and repeat it to record a real CACHED result without publishing or deploying an application image.
- [ ] 4.4 On a clean committed revision, run one full local app-only release image build and verify OCI revision, tar SHA-256, provenance sidecar, Chromium, and LibreOffice; do not deploy.

## ADDED Requirements

### Requirement: Runner operating-system layer has only versioned system inputs
The production Dockerfile SHALL derive build and runner operating-system stages from one digest-pinned Node image. It SHALL define separate explicit build and runner operating-system revisions, and the `runner-os` cache key SHALL be determined only by that image, target platform, declared apt source/package inputs, and runner revision. The stage MUST NOT copy or otherwise depend on application source, builder outputs, `APP_REVISION`, OpenSpec artifacts, or course/authority content.

#### Scenario: Application source changes
- **WHEN** only application source or `APP_REVISION` changes between two builds
- **THEN** the `runner-os` stage remains cache-eligible
- **AND** Chromium, LibreOffice, fonts, and runner system libraries are not reinstalled

#### Scenario: System layer is intentionally refreshed
- **WHEN** the pinned Node digest, apt inputs, package list, or runner operating-system revision changes
- **THEN** the `runner-os` stage is rebuilt
- **AND** the final image is subjected to the existing Chromium, LibreOffice, revision, tar digest, and provenance acceptance checks

### Requirement: Runner system installation precedes the application build graph
The local release build SHALL complete a dedicated `runner-os` target build before starting the final image build, using the same platform and system-layer build arguments. The prewarm step MUST NOT publish or replace the shared external cache by itself.

#### Scenario: Cold runner system layer
- **WHEN** the selected runner system layer is absent from both external and builder-local cache
- **THEN** the build completes its system package installation before the final image build starts
- **AND** the system installation does not run concurrently with the Next.js builder stage

#### Scenario: Warm runner system layer
- **WHEN** the selected runner system layer is already cached
- **THEN** the prewarm step resolves it from cache
- **AND** the final image build reuses the same result without reinstalling system packages

### Requirement: Local BuildKit cache is shared across ACT worktrees and isolated by platform
The release build SHALL resolve a host cache root outside Git worktrees by default, SHALL allow an explicit `ACT_BUILD_CACHE_ROOT` override, and SHALL store local exporter state under a normalized target-platform key. Existing explicit `CACHE_ROOT` configuration SHALL remain a compatibility override. The script MUST reject any resolved cache root located inside any Git worktree registered for the ACT repository.

#### Scenario: Two worktrees build the same platform
- **WHEN** two ACT worktrees use the default cache configuration for the same host and target platform
- **THEN** both resolve the same BuildKit cache namespace

#### Scenario: Different target platforms build on the same host
- **WHEN** builds target different platforms
- **THEN** they use different cache directories, locks, and current pointers
- **AND** neither build imports the other platform's local exporter cache

### Requirement: Shared cache publication is single-writer and failure-safe
The release build SHALL hold a platform-scoped single-writer lock from prewarm through final cache publication. A build SHALL export to a new generation and SHALL replace the `current` pointer only after the final image and cache export succeed. Failed or interrupted builds MUST leave the previous current generation usable.

#### Scenario: Concurrent build targets the same platform
- **WHEN** another live process owns the same platform cache lock
- **THEN** the new build fails closed before reading or writing the shared cache
- **AND** reports the lock owner without modifying current cache state

#### Scenario: Final build fails
- **WHEN** prewarm succeeds but the final image build or cache export fails
- **THEN** the previous current generation remains selected
- **AND** the failed generation is not admitted as current

#### Scenario: Final build succeeds
- **WHEN** the final image build and `mode=max` cache export succeed
- **THEN** the new generation becomes current through an atomic same-filesystem pointer replacement
- **AND** later worktrees may import that generation

#### Scenario: Successful builds retain bounded cache history
- **WHEN** three or more successful builds publish cache generations for one platform
- **THEN** the current generation and its immediate predecessor remain available
- **AND** older generations are removed while the platform writer lock is held

### Requirement: Dependency download caches use stable platform-scoped identities
The release build SHALL select one stable named local buildx builder. Docker dependency stages SHALL use stable, platform-scoped BuildKit cache-mount IDs for npm, Prisma, and apt downloads with locked sharing. Apt mounts SHALL retain downloaded packages when an apt layer is invalidated. The release contract MUST NOT claim that cache-mount contents are portable through the local exporter when BuildKit does not provide that guarantee.

#### Scenario: Different ACT worktrees use one buildx builder
- **WHEN** dependency stages run for the same target platform and stable cache-mount IDs
- **THEN** npm and Prisma download caches are eligible for reuse across those worktrees

#### Scenario: Lockfile changes
- **WHEN** package lock or Prisma dependency inputs change while runner system inputs remain unchanged
- **THEN** affected dependency and builder layers may rebuild
- **AND** the `runner-os` layer remains cache-eligible

### Requirement: Build-cache optimization preserves release authority
Build caches SHALL only accelerate computation. The final Linux image build, OCI revision label, exported tar SHA-256, provenance sidecar, clean-worktree gate, and existing deployment acceptance SHALL remain authoritative and fail closed.

#### Scenario: Cache entry exists but release evidence fails
- **WHEN** any authoritative revision, tar digest, provenance, input validation, or container acceptance check fails
- **THEN** the release is rejected regardless of cache hits

#### Scenario: Optimization change is verified locally
- **WHEN** the implementation is validated before deployment
- **THEN** static topology tests and script-level cache lifecycle tests pass
- **AND** a real cold/warm BuildKit acceptance is recorded separately before claiming measured cache-hit behavior

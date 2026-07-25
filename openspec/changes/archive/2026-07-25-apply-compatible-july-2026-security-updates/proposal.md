## Why

The July dependency remediation currently combines verified compatible security
updates with production findings that have no supported current-major fix.
Keeping both groups in one change delays already validated risk reduction and
leaves the executable scope unclear.

## What Changes

- Update NextAuth v4 and the Next 16 framework chain to the latest verified
  compatible releases, removing the baseline authentication and Next-owned
  advisories without changing authentication or routing contracts.
- Apply compatible lockfile-only fixes for the affected ESLint, AJV, YAML,
  archive, and TypeScript tooling paths.
- Pin live audit governance to the official npm registry, remove stale
  exceptions, and retain exact ownership for the remaining Prisma deprecation
  and advisory paths.
- Move GLB compression and its vulnerable image-tooling dependency chain into
  an isolated resource-production project that is excluded from the application
  install, build, and Docker context.
- Record the remaining Next/PostCSS/Sharp and Prisma/Hono findings under the
  blocked parent remediation issue instead of expanding this mergeable patch
  into unsupported overrides or major migrations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stable-dependency-chain-migration`: Permit a verified compatible security
  subset to ship independently when unresolved upstream-blocked lanes remain
  visible under a blocked parent change.

## Impact

- Dependency manifests and lockfile resolution for Next, NextAuth, ESLint and
  compatible transitive tooling.
- Dependency audit governance command, allowlist evidence, and remediation
  baseline documentation.
- GLB resource production tooling and ignored resource synchronization between
  the primary and isolated worktrees.
- No public API, authentication contract, Prisma schema, data migration,
  application route, framework major version, or production deployment change.

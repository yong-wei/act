## Why

The current lockfile reports 14 known vulnerabilities, including one critical and nine high-severity findings, while `npm run audit:governance` fails on unowned findings, stale allowlist entries, and one unowned deprecation warning. The dependency security gate therefore no longer reflects the repository's actual release risk, and the Prisma/Hono residual tracked by #291 can now be removed through a supported Prisma 7 update.

## What Changes

- Capture a commit-bound audit and dependency-tree baseline for the current lockfile, classifying each finding by runtime relevance, dependency path, remediation owner, and supported fix path.
- Remediate compatible findings on the repository's existing major lines, including the Next 16, NextAuth v4, Prisma 7, image-processing, and transitive tooling chains, without adopting audit-suggested downgrades or forced major migrations.
- Preserve the established credentials/JWT session contract, Prisma schema and data contract, production worker and migration entrypoints, standalone build, image/PDF processing, and current application routes while updating dependencies.
- Reconcile the dependency audit allowlist and deprecation residuals with the resulting lockfile: remove resolved or stale entries, keep only eligible evidence-backed temporary residuals with explicit ownership and release decisions, and make `audit:governance` pass.
- Close #291 when the Prisma-owned `@prisma/dev -> @hono/node-server` advisory path is absent from the verified dependency tree.
- Block the batch on every newly introduced moderate-or-higher finding and every unresolved baseline critical or production-runtime high finding. Only a baseline moderate or development-only high finding that cannot be safely remediated may become an explicit temporary residual with a dedicated owner issue; do not hide risk through a broad package match, `npm audit fix --force`, or an unsupported downgrade.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dependency-audit-governance`: Require each remediation batch to reconcile live audit findings, dependency paths, and temporary exceptions so the governance gate cannot pass through stale or overly broad allowlist state.
- `stable-dependency-chain-migration`: Define the compatibility and release verification required when security updates touch several existing dependency lanes without crossing their current major-version contracts.

## Impact

- Dependency manifests and resolution: `package.json`, `package-lock.json`, npm overrides, and the installed production/dev dependency tree.
- Security governance: `docs/security/dependency-audit-allowlist.json`, the current audit/deprecation baseline and report, #291, and any newly required residual owner issue.
- Compatibility surfaces: Next.js build and standalone output, NextAuth credentials/JWT sessions, Prisma client generation and worker/database entrypoints, image/PDF processing, and representative browser routes.
- No public API, authentication model, Prisma schema, database data migration, framework major migration, or unrelated dependency refresh is introduced by this change.

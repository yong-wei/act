# Dependency Audit Governance

Date: 2026-06-01
Base branch: `migration/audit-vulnerabilities`

## Policy

The dependency audit governance gate is `rtk npm run audit:governance`.
It runs `npm audit --json`, classifies each finding, and fails when any unallowlisted finding at `moderate`, `high`, or `critical` severity is present.

The threshold intentionally includes moderate findings because current approved residuals must be explicit, owner-tracked, and temporary. New moderate or higher findings are regressions unless they are approved through a reviewed allowlist entry.

The report records:

- vulnerable package
- severity
- advisory identifiers
- direct or transitive dependency status
- dependency path
- production runtime or dev-tooling relevance
- owning remediation issue when the finding is allowlisted
- owned deprecated-package residuals, separately from security audit findings

## Allowlist Rules

Allowlist entries live in `docs/security/dependency-audit-allowlist.json`.
Each entry must include:

- `id`
- `packageName`
- `dependencyPath`
- `advisoryIds`
- `severity`
- `reason`
- `ownerIssue`
- `reviewDate`
- `expiresOn`
- `removalCondition`

Expired entries fail the governance command. Unused entries also fail, so resolved findings force removal of their exceptions.

Deprecated install warnings are not security audit findings, but they must be owned while they remain visible in `npm ci`.
Those entries live in the same JSON under `deprecationResiduals`.
Each residual must include:

- `id`
- `packages`
- `dependencyPath`
- `ownerLane`
- `ownerIssue`
- `reviewDate`
- `expiresOn`
- `releaseBlocking`
- `removalCondition`

Expired or incomplete deprecation residual entries fail the governance command.
The command also compares `deprecationResiduals` with the current `package-lock.json` deprecated package metadata:
new deprecated packages fail as unowned warnings, and entries whose packages no longer appear as deprecated fail as stale residuals.
This keeps low-risk dependency refresh work from treating known warnings as local install noise while still surfacing any new unowned warning for review.

## Current Residual Findings

The approved security audit residual findings are the Next-owned bundled PostCSS advisory owned by #261 and the Prisma-owned Hono advisory record owned by #291.

Next/PostCSS residuals:

- `next` at `node_modules/next`
- `postcss` at `node_modules/next/node_modules/postcss`

Both are moderate severity and production-runtime relevant because `next` is a production dependency. `npm audit --omit=dev --json` currently suggests `next@9.3.3` through `npm audit fix --force`; that is an unsupported downgrade for this application and is rejected by governance. The exception expires on 2026-09-01 and must be removed earlier if a supported Next 15 backport or stable Next release stops reporting the bundled PostCSS advisory.

Prisma/Hono residuals:

- `prisma` at `node_modules/prisma`
- `@prisma/dev` at `node_modules/@prisma/dev`
- `@hono/node-server` at `node_modules/@hono/node-server`

These are moderate severity findings for `@hono/node-server <1.19.13` through the Prisma tooling dependency path. `npm audit` currently suggests `prisma@6.19.3`, which is a downgrade from the current supported Prisma line rather than a Tailwind/Turbopack source-boundary remediation. The exception expires on 2026-09-01 and must be removed earlier if the supported Prisma line clears `@prisma/dev` or upgrades its Hono dependency.

The current lockfile has no deprecated-package residuals. Previous ESLint 8, Tailwind 3/Sucrase, and Drei 9 warning ownership entries were removed because `package-lock.json` no longer marks those packages as deprecated; stale residual entries fail the governance command by design.

## Verification

Run:

```bash
rtk npm run audit:governance
rtk node ./scripts/tests/test-dependency-audit-governance.mjs
```

The test script verifies that approved residual findings pass, that a new unallowlisted high-severity finding fails, and that an expired allowlist entry fails.

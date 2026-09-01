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

The official-registry audit of the committed lockfile currently reports zero moderate-or-higher findings, so `docs/security/dependency-audit-allowlist.json` has no security-exception entries.

Resolved by the 2026-09-01 compatible batch (#1032):

- Next `16.3.4` with PostCSS `8.5.23` and Sharp `0.35.4` removed the production Next/PostCSS/Sharp highs owned by #1035.
- Prisma CLI/client/adapter `7.10.0` with `@prisma/dev@0.24.17` removed the Prisma/Hono path owned by #291 and installed patched `find-my-way@9.7.0`.
- A nested override of `@prisma/config` → `deepmerge-ts@8.0.2` removed `GHSA-ggr8-5vv4-36mx`. Remove the override when a supported Prisma 7 release depends on `deepmerge-ts>=8`.
- Compatible tooling resolutions `brace-expansion@1.1.18` / `5.0.9`, `fast-uri@3.1.6`, and `js-yaml@4.3.2` removed the remaining current-major highs.

The only remaining owned residual is the development-only `whatwg-encoding@3.1.1` deprecation installed by `jsdom@26.1.0`, owned by #1033 until the supported jsdom line removes it.

## Verification

Run:

```bash
rtk npm run audit:governance
rtk node ./scripts/tests/test-dependency-audit-governance.mjs
```

The test script verifies that approved residual findings pass, that a new unallowlisted high-severity finding fails, and that an expired allowlist entry fails.

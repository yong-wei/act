# Dependency Audit Governance

Date: 2026-06-01
Base branch: `migration/audit-vulnerabilities`

## Policy

The dependency audit governance gate is `rtk npm run audit:governance`.
It runs `npm audit --json`, classifies each finding, and fails when any unallowlisted finding at `moderate`, `high`, or `critical` severity is present.

The threshold intentionally includes moderate findings because the current migration series ends with only the Next-owned bundled PostCSS advisory remaining. New moderate or higher findings are regressions unless they are approved through a reviewed allowlist entry.

The report records:

- vulnerable package
- severity
- advisory identifiers
- direct or transitive dependency status
- dependency path
- production runtime or dev-tooling relevance
- owning remediation issue when the finding is allowlisted

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

## Current Residual Findings

The only approved residual findings are the Next-owned bundled PostCSS advisory after #244:

- `next` at `node_modules/next`
- `postcss` at `node_modules/next/node_modules/postcss`

Both are moderate severity and production-runtime relevant because `next` is a production dependency. The exception expires on 2026-09-01 and must be removed earlier if a supported Next 15 backport or stable Next release stops reporting the bundled PostCSS advisory.

## Verification

Run:

```bash
rtk npm run audit:governance
rtk node ./scripts/tests/test-dependency-audit-governance.mjs
```

The test script verifies that the approved residual finding passes, that a new unallowlisted high-severity finding fails, and that an expired allowlist entry fails.

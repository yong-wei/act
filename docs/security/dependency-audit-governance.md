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

Expired or incomplete deprecation residual entries fail the governance command. This keeps low-risk dependency refresh work from treating known warnings as local install noise while still surfacing any new unowned warning for review.

## Current Residual Findings

The only approved security audit residual findings are the Next-owned bundled PostCSS advisory now owned by #261:

- `next` at `node_modules/next`
- `postcss` at `node_modules/next/node_modules/postcss`

Both are moderate severity and production-runtime relevant because `next` is a production dependency. `npm audit --omit=dev --json` currently suggests `next@9.3.3` through `npm audit fix --force`; that is an unsupported downgrade for this application and is rejected by governance. The exception expires on 2026-09-01 and must be removed earlier if a supported Next 15 backport or stable Next release stops reporting the bundled PostCSS advisory.

The approved deprecated-package residuals are:

- ESLint 8 dev tooling: `eslint@8.57.1`, `@humanwhocodes/config-array@0.13.0`, `@humanwhocodes/object-schema@2.0.3`, `rimraf@3.0.2`, `glob@7.2.3`, and `inflight@1.0.6`. Owner lane: `dev-tooling-eslint9-migration`.
- Tailwind 3 transitive tooling: `tailwindcss@3.4.19 -> sucrase@3.35.0 -> glob@10.5.0`. Owner lane: `tailwind-major-or-transitive-tooling-refresh`.
- Drei 9 graphics line: `@react-three/drei@9.122.0 -> three-mesh-bvh@0.7.8`. Owner lane: `react18-r3f8-drei9-graphics-line`.

These deprecation residuals are not release-blocking on their own. They must be removed when the named owner lane clears the corresponding `npm ci` warnings.

## Verification

Run:

```bash
rtk npm run audit:governance
rtk node ./scripts/tests/test-dependency-audit-governance.mjs
```

The test script verifies that the approved residual finding passes, that a new unallowlisted high-severity finding fails, and that an expired allowlist entry fails.

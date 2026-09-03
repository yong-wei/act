## Context

At commit `7bb5e5182dd8db2704731b1ec786cb205a31e15e`, the application uses Next `^16.2.7`, NextAuth `^4.24.14`, Prisma CLI/client `^7.8.0`, Sharp `^0.33.0`, and npm 11 lockfile resolution. Against the official npm registry, the live audit reports 14 findings (1 critical, 9 high, 3 moderate, 1 low), and the governance gate rejects 11 unallowlisted findings, three stale allowlist entries, and one unowned deprecation warning. The affected dependency paths span production framework/auth/image packages and Prisma development tooling, so a lockfile-only update is not sufficient evidence of compatibility.

The existing specifications already prohibit unsafe automatic downgrades, require temporary exceptions to be owned and time-bounded, and require runtime-specific validation for Next, Prisma, and production dependencies. This change applies those rules to one bounded remediation batch; it does not reopen the completed framework, auth, or Prisma major migrations.

## Goals / Non-Goals

**Goals:**

- Restore `npm run audit:governance` as a truthful release gate against the final lockfile.
- Remove every current finding that has a supported compatible remediation on the repository's existing major package lines.
- Preserve the application contracts affected by Next, NextAuth, Prisma, Sharp, and their transitive dependency paths.
- Remove the Prisma/Hono path owned by #291 when supported package resolution permits it.
- Resolve or govern every deprecated-package warning under the existing deprecation residual contract.
- Block on baseline critical and production-runtime high findings; leave only eligible baseline moderate or development-only high residuals visible, narrowly allowlisted, time-bounded, and owned by a dedicated issue.

**Non-Goals:**

- Migrating from NextAuth v4 to Auth.js v5 or changing credentials, JWT, role, or session semantics.
- Changing the Prisma schema, application data, database migration history, or database deployment procedure.
- Upgrading Next, Prisma, React, Tailwind, visualization, AI, or other packages across major lines.
- Refreshing unrelated outdated dependencies or reorganizing dependency sections without runtime evidence.
- Forcing an audit-generated downgrade, using `npm audit fix --force`, or pursuing an artificial zero-finding total at the expense of supported runtime contracts.

## Decisions

### 1. Freeze the audit baseline before selecting versions

Implementation begins by recording the base commit, Node/npm versions, configured registry, reproducible official-registry command, direct package ranges, audit summary, advisory identifiers, dependency paths, production/dev relevance, deprecated-package warnings, current governance matches, and `npm ls` ownership chains. Candidate updates are evaluated against that frozen evidence.

This prevents the task from becoming an unbounded package refresh and makes every resolved, remaining, or newly introduced finding attributable to a concrete lockfile change. Treating the current `npm audit` suggestions as the plan was rejected because they can recommend unsupported downgrades or major-line changes.

### 2. Use supported current-major updates and the narrowest proven transitive resolution

Direct packages are updated only within their current supported major lines. A transitive override is permitted only when:

1. the parent package's declared compatibility accepts the selected transitive version;
2. `npm ls` shows the override affects only the intended advisory path;
3. installation, targeted contract checks, and the production build pass; and
4. the override is documented with a removal condition.

The implementation must not assume an unpublished or merely observed package version remains available. Candidate versions are resolved from the registry during implementation and committed through the lockfile. Broad overrides that change unrelated dependency paths are excluded.

### 3. Preserve contract-specific verification for each touched lane

The remediation remains one OpenSpec change because all updates pursue the same current audit snapshot and governance gate, but verification is separated by affected contract:

- Next: typecheck, lint, default tests, production build, standalone/deployment assumptions, and representative authenticated and public routes.
- NextAuth: credentials success/failure, JWT encode/decode, custom user/role/session fields, server session retrieval, and protected-route behavior.
- Prisma: configuration loading, schema validation, client generation, database-backed scripts, worker entrypoints, and the documented migration-deploy command executed against a disposable database without creating a schema migration or touching shared/production data.
- Sharp and image consumers: representative image processing, smart-courseware/PDF rendering where the dependency path is exercised, and production build packaging.
- Audit governance: raw audit report, dependency trees, governance test, stale-entry removal, and final gate.

The final Linux/amd64 image built by `scripts/build.sh` is the verification unit for native and production-only behavior. That same image must start the app, data-governance worker, and scheduler against disposable PostgreSQL/Redis services; execute the real Prisma deploy/status commands; exercise Sharp/PDF behavior; and serve representative public, authenticated, and protected browser routes. Host-only build or test success does not replace this check.

An update that cannot satisfy its lane's checks is reverted or, only when it is a baseline moderate or development-only high finding, isolated as a residual. It is not hidden by weakening the test or allowlist.

### 4. Reconcile governance state from the final lockfile

After compatible updates stabilize, the implementation regenerates the audit evidence and compares it with the frozen baseline:

- resolved findings are removed from the allowlist and report;
- stale entries are removed because unused exceptions fail governance;
- every newly introduced moderate-or-higher finding blocks completion and cannot be allowlisted by this batch;
- every baseline critical or production-runtime high finding must be removed; if no compatible fix exists, this change is blocked and the broader migration or risk decision is proposed separately;
- only an eligible baseline moderate or development-only high finding may receive an exact package/advisory/path entry after a dedicated owner issue, expiry, removal condition, and release-blocking decision exist;
- deprecated-package warnings are removed or reconciled through the existing owner-lane, expiry, removal-condition, and release-blocking fields;
- #291 is closed only after the Prisma/Hono path and advisory are absent from both `npm ls` and `npm audit`.

The final expected condition is a passing governance gate, not necessarily an empty raw audit result.

### 5. Publish as one serialized remediation batch

Package and lockfile changes are applied in contract lanes and verified after each lane, then combined only after all touched-lane checks pass. The final commit records the complete audit delta and one rollback point. This keeps the proposal compact while avoiding the ambiguity of changing every package simultaneously.

Splitting a separate OpenSpec change for each direct dependency was rejected because no major migration or independent product outcome is planned. If implementation discovers that a candidate requires a public contract change, data migration, or major-version transition, that lane is removed from this change and proposed separately.

## Risks / Trade-offs

- **A compatible package release can alter runtime behavior despite semver** → Run the contract-specific checks and browser/build verification for every touched lane before accepting it.
- **A transitive override can produce an unsupported tree** → Require parent-range compatibility, narrow `npm ls` evidence, targeted tests, and an explicit removal condition.
- **Registry metadata or advisories can change during implementation** → Bind baseline and final evidence to commits and include the resolved lockfile, rather than relying on mutable “latest” labels in the proposal.
- **One remediation batch can obscure the source of a regression** → Apply and verify lanes serially, retaining per-lane audit/tree evidence before the final combined verification.
- **Some findings may have no safe current-major fix** → Keep them visible through exact temporary exceptions and dedicated owner issues; do not expand this change into a major migration.

## Migration Plan

1. Capture the immutable pre-change audit, dependency tree, toolchain, and allowlist baseline.
2. Update and verify compatible dependency lanes serially, reverting any lane that breaks its existing contract.
3. Reconcile documentation, allowlist entries, owner issues, and #291 against the final lockfile.
4. Run the full repository verification required for a final dependency revision, including production build and affected browser/runtime checks.
5. Build the release image with `scripts/build.sh`, record its immutable image ID/digest and SHA256 artifact, and run the app, worker, scheduler, Prisma, Sharp/PDF, and browser checks against that exact image with disposable PostgreSQL/Redis services.
6. Produce a release handoff that retains the previous immutable image digest and preserves the existing PostgreSQL/Redis containers and volumes. Production deployment is a separate authorized operation and must not use a path that rebuilds or restores the database for this dependency-only change.
7. If a later deployment fails, roll app, worker, and scheduler back together to the retained previous image while preserving the database and Redis state. Database restore is reserved for separately demonstrated data corruption.

## Open Questions

None. Exact package versions and any narrowly required override are implementation evidence, not proposal-time constants; they must satisfy the decisions and acceptance conditions above.

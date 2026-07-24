## Context

The frozen July baseline contains 14 vulnerability package records. Compatible
updates already remove the critical finding, all NextAuth findings, all
Next-owned advisories, and several tooling findings, but stable Next 16 still
pins vulnerable PostCSS and cannot accept the fixed Sharp line. Prisma 7.9
replaces its existing Hono residual with a new high-severity dependency.

The remaining upstream-blocked paths belong to #1032 and its linked tracking
issues. They are not a reason to retain already remediated vulnerabilities in
the integration branch.

## Goals / Non-Goals

**Goals:**

- Ship only supported current-major updates with demonstrated audit reduction.
- Preserve NextAuth credentials/JWT/session behavior and Next application
  behavior.
- Remove the GLB producer's image-tooling chain from application installation
  and build boundaries while retaining compressed runtime assets.
- Keep unresolved production findings visible and owned without weakening the
  audit gate.

**Non-Goals:**

- Making `npm run audit:governance` pass while the three known production high
  package records remain.
- Allowlisting production high findings.
- Adopting preview releases, dependency overrides outside declared parent
  ranges, forced audit fixes, package-major migrations, or production
  deployment.
- Updating Prisma, the database schema, or application data.

## Decisions

### 1. Split at supported-remediation boundaries

This change contains only package resolutions whose current parent ranges accept
the patched versions and whose affected contracts have already passed focused
verification. The unresolved Next/PostCSS/Sharp and Prisma/Hono paths remain in
the blocked parent change. Keeping the original all-or-nothing batch was
rejected because it unnecessarily retains resolved critical and authentication
findings.

### 2. Treat the audit delta, not a passing final gate, as this patch's evidence

The committed baseline and official-registry audit must show that this patch
introduces no finding and reduces the total from 14 records to the documented
remaining set. `audit:governance` is expected to continue failing specifically
on the linked production blockers; its failure must not be hidden by an
allowlist.

### 3. Isolate GLB production as a separate npm project

The application dependency graph, application build, and Docker context do not
install or execute the GLB compressor. An explicit resource-production command
owns its separate lockfile and generates ignored `models-opt` resources in the
primary worktree. Isolated worktrees receive those resources as real files.
Removing compression or producing models during the application build was
rejected.

### 4. Preserve the exact compatible lockfile checkpoint

The mergeable revision is reconstructed from the verified commits rather than
rerunning a broad dependency refresh. Only changes attributable to the recorded
security lanes are accepted.

## Risks / Trade-offs

- **The governance command remains red** → Its output must contain only the
  three linked production high records plus explicitly owned moderate
  residuals; #1032 remains blocked.
- **An isolated model-production run can partially fail** → The command writes
  diagnostics but exits nonzero, and failed output sets must not be published
  or synchronized.
- **Patch releases can still regress runtime behavior** → Preserve focused auth,
  simulation, typecheck, install, OpenSpec, and audit-delta evidence and run the
  repository's final merge checks.

## Why

`src/lib/data-governance/**` still contains a mixed residual surface: domain
state, cross-domain evidence kernels, operator/backfill tools, fixtures, and
compatibility bridges share one directory but do not share one owner.  The
post-convergence successor capture now provides the only acceptable
revision-bound owner-residue and full-inventory evidence; this change narrows
the existing charter contract so the residual surface can be adjudicated
without inventing an owner or reopening already completed migrations.

## What Changes

- Modify only `modular-monolith-refactor-charter` with a scoped residual-owner
  adjudication contract for every current member of `src/lib/data-governance/**`
  and every production, test, tooling, dynamic-load, re-export, documentation,
  worker, scheduler, and Prisma caller.
- Require the parent coordination gate for Issue #1876 (closed,
  `status:archived`, and native `blockedBy` resolved) before claim, apply, any
  implementation (including validator/fixture), adjudication run, normalized
  decision/evidence write, or qualified projection.  If the gate fails, only a
  parent coordination-layer gate-rejection may be output; it does not consume
  A and is neither a D result nor a D artifact.  Once admitted, consume change
  A's exact owner-residue subject identity and full-artifact digest; B and C
  remain independent.
- Preserve the canonical invariant that every in-scope and out-of-scope
  capability, route, API, model, worker, script, registry, and test surface has
  exactly one accountable target domain owner.  Only A-bound
  `src/lib/data-governance/**` records additionally receive one orthogonal
  outcome per member or homogeneous family: exact business-domain owner,
  strict cross-domain processing kernel, explicit operator tooling/backfill
  boundary, fixture/demo/test/generated asset, compatibility/retirement
  candidate, or unresolved conflict.  Every qualified scoped record therefore
  has one owner and one qualified outcome; unresolved evidence blocks scoped
  and global qualification.  Out-of-scope surfaces do not receive this
  six-outcome extension; a compatibility outcome without its canonical owner
  fails the global charter requirement.
- Define the proof required for a processing kernel: at least two real domain
  consumers, intrinsically cross-domain fact semantics, no single-domain state
  machine, no direct page ownership, no one-off backfill, one public API, and
  an explicit privacy/authority boundary.  A kernel, tooling, fixture, or
  compatibility outcome also requires one existing domain owner/steward for
  its public boundary, privacy, retention/deletion, and maintenance; a consumer
  list cannot substitute for that owner.  Missing proof resolves to a domain,
  tool, or unresolved outcome only with an independently evidenced owner.
- Preserve the existing Learning Record ingestion writer, identity/dedupe,
  trusted time, outbox, current-pointer, and watermark contracts; Assignment
  remains the owner of approved-snapshot/CAS/idempotency orchestration, and
  document-grading processing policy remains subject to the C16 constraints.
- Preserve ArenaSubmission as official score authority, simulation/Arena
  LearningFact as privacy-safe auxiliary evidence, Portrait V2 as the primary
  profile, and teacher/class authorization, redaction, and independent-learner
  small-sample suppression.  No raw payload, answer, or context JSON is added.
- Bind any adjudicator/validator implementation to a clean tool checkpoint and
  keep tool identity separate from A's subject identity.  Same subject, tool,
  schema, and frozen inputs are required for deterministic decisions; drift
  fails closed.
- Emit a compact decision matrix, owner/kernel/tool/fixture/compatibility/
  unresolved summaries, charter/deprecation projection, privacy and
  determinism evidence, and future migration-ready slices.  Keep the complete
  ledger outside Git and do not claim a qualified projection when any scoped
  record is unresolved.
- Keep the change governance-only: it does not move files, change imports or
  exports, delete barrels, modify Prisma/schema/migrations/backfills/replay,
  alter LearningFact/Arena/portrait/privacy behavior, open an Issue, deploy,
  or activate a production selector.

## Capabilities

### New Capabilities

None.  This is a scoped modification of the existing charter rather than a new
Data Governance capability or owner catalog.

### Modified Capabilities

- `modular-monolith-refactor-charter`: add a revision-bound, fail-closed
  adjudication contract for residual `src/lib/data-governance/**` owners,
  kernels, tooling, fixtures, compatibility candidates, and unresolved
  conflicts, including its bounded charter projection and future slices.

## Impact

- Reads the exact A successor owner-residue/full-inventory subject and digest,
  current `src/lib/data-governance/**` members, all caller classes, and the
  existing Learning Record, Assignment, evidence, Arena, portrait, and
  data-governance specifications.
- Updates only OpenSpec artifacts under this change.  The resulting delta spec
  is consumed by later charter/migration work; it does not alter the canonical
  charter, implementation code, database, runtime, tests, deployment, or
  GitHub state in this change.
- A missing A handoff, stale or mixed identity, incomplete caller evidence, or
  any unresolved outcome is a non-qualified blocker.  No migration-ready
  projection is asserted until a later authorized decision resolves it.

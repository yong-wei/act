# Proposal: Isolate migration, backfill, and competition toolchains

## Why

One-off migrations, historical repair/backfill scripts, and competition/demo
submission helpers currently live beside product and release scripts. The
baseline contains 3 files under `scripts/migrations`, 76 under `scripts/db`,
and competition acceptance/demo helpers under `scripts/tests`. Their purpose,
destructive behavior, input snapshot, and public-output boundary are not
uniformly visible to the production/tool/test TypeScript graphs. This creates a
real risk that a historical repair or submission-material generator becomes an
accidental product dependency or is rerun without an auditable receipt.

The canonical course-evidence backfill and competition-demo specifications
already define integrity and public-material semantics. The missing capability
is an execution boundary and a safe lifecycle for these non-product tools.

## What Changes

- Register isolated migration, historical backfill/repair, and competition
  submission tool entries under the independent toolchain boundary.
- Classify every existing script, preserve only the approved canonical behavior,
  and migrate callers to explicit commands with portable receipts.
- Make dry-run the default for data-changing operations. Any `--apply` mode
  requires explicit approval, a plan/input hash, target database identity, and
  a durable receipt; this change performs no data mutation.
- Keep competition helpers limited to deterministic public submission/demo
  materials, route ledgers, and resettable fixtures. They must not become
  product runtime code or expose credentials, learner identifiers, raw answers,
  or private evidence.
- Delete or archive retired one-off entrypoints after migration; do not leave a
  facade that can still be mistaken for product authority.

No migration, backfill, repair, competition submission, deployment, selector
change, or production data change is executed by this proposal.

## Capabilities

### New capabilities

- `migration-backfill-competition-toolchains`: explicit, independently tested
  boundaries for data repair and public competition materials.

### Modified capabilities

None. `course-evidence-backfill-reporting` and `competition-demo-baseline`
remain the canonical semantic contracts.

## Impact

- **Code:** the migration and database script denominator is characterized and
  classified; competition helpers are separated from product routes and test
  fixtures.
- **Safety:** every apply-capable command has an approval/receipt gate and
  idempotency/rollback evidence. This change creates the gate but runs no
  apply operation.
- **Outputs:** public competition material is deterministic and redacted;
  private repair evidence is not placed in runtime or public bundles.
- **Dependencies:** requires
  `establish-independent-toolchain-execution-boundary` and
  `split-production-tooling-test-typescript-graphs`; reuses the canonical
  evidence-backfill and competition specifications.
- **Coordination:** it does not overlap with
  `coordinate-latest-authority-and-active-oss-cutover` or
  `stabilize-commercial-ui-qa-capture-contract`; those changes retain their
  own release and capture owners.


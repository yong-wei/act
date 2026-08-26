# Design: Migration, backfill, and competition toolchains

## Baseline and denominator

The baseline is `edb98945e78ab0824f801806751fd57f97056347`. The initial
denominator is all 3 files in `scripts/migrations`, all 76 files in
`scripts/db`, and every script/test helper classified as historical repair,
backfill, migration, competition baseline, demo acceptance, or submission
material generation under `scripts/tests`. Product Arena routes, normal product
tests, and the content/knowledge/runtime release writers are explicitly
excluded and assigned to their existing owners.

Characterization records each command's purpose, owner, callers, read/write
tables or files, expected denominator, source snapshot, idempotency behavior,
destructive flags, output paths, and privacy class. It also records which
competition helpers produce a route ledger, reset fixture, screenshot, or
public submission bundle.

## Tool classes and safety contract

### Migration and repair

These commands require an explicit target and plan. The default command is
read-only/dry-run and emits a plan hash plus affected-row estimate. An apply
command must receive an explicit approval token or operator confirmation in the
repository's established mechanism, recheck the target identity and plan hash,
and write a receipt containing before/after counts, transaction status, and
rollback information. No command may treat a missing approval as approval.

### Historical backfill

Backfills reuse `course-evidence-backfill-reporting`: no fabricated evidence,
stable learner/record identity, idempotent writes, traceable source, and
selected report regeneration only. Public reports contain aggregates and
suppression rules, not raw answers, event payloads, user identifiers, or parser
text. The tool boundary does not change the canonical backfill semantics.

### Competition materials

Competition helpers produce deterministic, resettable demo state and public
submission material according to `competition-demo-baseline`. A bundle contains
the route ledger, version/source identity, redacted representative evidence,
and verification receipt. Credentials, local absolute paths, learner data, raw
answers, and private audit evidence are rejected before publication.

## Boundary and deletion

The three classes have distinct command IDs and owners in the independent tool
registry. Product code can consume approved public contracts or route metadata,
but cannot import migration writers, backfill mutators, or submission-material
generators. After callers and tests move, obsolete entrypoints are deleted or
archived with an explicit ledger entry and no executable duplicate. Historical
scripts that cannot be safely classified remain blocked from production graph
inclusion until classified; they are not silently wrapped.

## Verification and rollback

Run dry-run characterization, independent tool typecheck/tests, schema/contract
tests, privacy scans, and import-boundary checks. Apply-mode verification is
limited to a test database or fixture in this change and must prove plan-hash
and approval rejection; no production or user data is touched. Every output
receipt includes command, source revision, target identity (redacted where
needed), input/output hashes, row/fixture counts, and status.

## Dependencies and non-goals

This design depends on the independent toolchain boundary and split graph and
reuses `course-evidence-backfill-reporting` and `competition-demo-baseline`.
Migration/data execution, production deployment, knowledge cutover, commercial
UI capture, and selector changes are non-goals.


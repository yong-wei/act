## Why

The repository contains a large, heterogeneous payload surface whose paths and
names do not prove whether an item is source, generated output, release state,
QA evidence, cache, or privacy-sensitive evidence. Before any future storage or
materialization decision can be considered, the project needs one
revision-bound, evidence-bearing classification that preserves uncertainty and
does not silently turn duplicate detection into deletion authority.

This change records the classification contract and produces compact,
reviewable outputs from the immutable successor capture supplied by change A.
It is intentionally an inventory and decision-boundary change: it neither moves
payloads nor changes existing runtime, release, QA, knowledge, or selector
contracts.

The proposal-time estimates of approximately 5.97 GB of payload and 1.19 GB of
duplicate candidates are observations for investigation context only. They are
not denominator values, thresholds, or future-eligibility evidence.

## What Changes

- Add one compact `repository-payload-classification` capability covering a
  revision-bound inventory of the payload families in A's immutable successor
  capture.
- Require each qualified record to have exactly one mutually exclusive primary
  class: hand-authored source of truth, reproducible generated output,
  immutable release/rollback artifact, ephemeral QA evidence,
  cache/materialized view, or regulated/privacy-sensitive evidence. Preserve
  authorship/reproducibility, release/rollback, QA, cache/materialized,
  privacy, and retention facets alongside that class, with deterministic
  precedence `F > C > D > E > A > B` and `unresolved` for unknown privacy or
  missing key evidence (including D+F→F, B+C→C, B+E→E, and A+F→F).
- Bind records to path or family, hash and size, A subject identity, producer
  and reproducibility evidence, consumers, authority/manifest, retention,
  privacy, materialization, rollback, and recovery conditions.
- Keep denominator member disposition independent from duplicate observations:
  every member is independently `qualified`, `unresolved`, or
  `justified-excluded`; exact/near duplicate groups only reference member IDs.
- Compute package identity from normalized member identity/digest and the
  subject/tool/schema envelope without self-hashing `index.json`; scan the full
  inventory, locators, and every compact projection for forbidden content.
- Keep subject identity separate from classifier/tool identity, and fail closed
  on drift of either identity or frozen inputs.
- Define evidence-based duplicate and future-eligibility gates without treating
  exact/near duplicates, generated status, or ephemeral status as deletion or
  externalization authority.
- Produce compact summaries, an index, policy matrix, unresolved register,
  future-eligibility register, and full-inventory content-addressed locator;
  compute a package digest without hashing/indexing `index.json` itself; scan
  every compact projection and full-inventory member for privacy before
  qualification; keep raw private evidence, binaries, secrets, absolute paths,
  and a giant per-file ledger out of Git.
- Add validators and focused tests for capture gating, denominator coverage,
  one-class assignment, family homogeneity, identity drift, privacy, and
  no-mutation behavior.

## Capabilities

### New Capabilities

- `repository-payload-classification`: Classify repository payloads against an
  immutable A capture with explicit authority, consumer, privacy, retention,
  and materialization evidence while preserving unresolved items.

### Modified Capabilities

None. Existing runtime blob/manifest/materializer/GC, knowledge release
toolchain, QA evidence registry/privacy/publication, architecture fitness, and
release selector requirements remain unchanged.

## Impact

- Adds OpenSpec artifacts, inventory/summary outputs, and validation tooling
  under this change only; it does not modify production code, schemas, CI,
  selectors, runtime data, release objects, or Git history.
- Consumes only A's immutable successor capture after the required Issue #1876
  closure/archive and native `blockedBy` release; C and B/D remain independent.
- The review surface includes course runtime/release trees, artifacts,
  architecture JSON, archived evidence, WASM/package/generated assets, large
  fixtures/snapshots, and the concrete binary/JSON families found by A.
- Any required remote production or OSS fact is represented as unresolved; no
  server operation, upload, download, deletion, or materialization is invoked.

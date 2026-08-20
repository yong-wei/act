## Why

Production still serves the v0.18 Authority while the Authority domain
catalog/shard bindings remain on v0.9, so `/knowledge` shows only one or two
reviewed objects per domain. The qualified v0.22 composite release envelope
must become the single production state, but the current runtime hard-codes
v0.18 selectors in source (for example
`src/lib/authority-domain-shards/labels.ts` pins
`ctr:release:control-theory-engineering-v0.18`), so no deployed code can even
address a v0.22 envelope. Advancing one selector at a time would recreate
exactly the mixed composite state the cutover language forbids.

## What Changes

Two distinct release actions inside one change:

- **Runtime release**: freeze and publish an application/runtime revision whose
  envelope selectors (Authority release, Projection Profile, domain shard and
  catalog, label overlay) are read from configuration bound to one qualified
  composite release envelope instead of hard-coded v0.18 constants. Deploy this
  runtime while production still serves the current v0.18 envelope; publishing
  the runtime MUST NOT itself switch any production data selector.
- **Production activation**: one controlled, journaled activation transaction
  that atomically moves all five production selectors — Authority, Teaching
  Projection, prerequisites, Authority domain shard/catalog, and shared
  consumer activation — to the same qualified v0.22 composite release envelope.
  If any selector cannot be moved or still resolves an older release, the
  activation fails closed and production remains fully on the previous envelope.
- **Rollback**: preserve a previous-envelope snapshot of all five selectors and
  provide a rollback action that restores them together within the rollback
  window; afterwards v0.9 and v0.18 live only in read-only history and rollback
  evidence, not in normal reads.
- **Post-activation verification**: `/knowledge` serves v0.22 domains with the
  full reviewed membership recorded in the qualified envelope, Chinese display
  coverage stays intact, and no internal identifiers are exposed. Membership
  counts come from the qualification evidence, not hard-coded numbers.

## Capabilities

### New Capabilities

- `actkg-v022-runtime-release`: publish a composite-envelope-configurable ACT
  runtime that can serve the qualified v0.22 envelope while production data
  selectors remain on the previous envelope.
- `actkg-v022-production-cutover`: atomically activate, verify, and if needed
  roll back the qualified v0.22 composite release envelope across all five
  production selectors.

### Modified Capabilities

- None.

## Impact

- Affects runtime envelope-selector configuration (replacing hard-coded v0.18
  pins such as `src/lib/authority-domain-shards/labels.ts`), the release build
  and deployment path, the five production knowledge selectors, activation
  journal/receipts, rollback evidence, and `/knowledge` presentation checks.
- Depends on `validate-v022-composite-cutover-candidate` (activation requires
  its qualification evidence) and `restore-legacy-domain-graph-presentation`;
  part of series issue #1441.
- Candidate import and production activation remain separate release actions;
  this change performs no candidate import or rebuild.
- Does not delete v0.9 or v0.18 artifacts; they are retained as read-only
  history and rollback evidence only.

# Proposal: Extract the teaching projection publishing CLI

## Why

The authoritative teaching-projection publishing path is currently embedded in
`src/lib/teaching-projection`. The `publish`, `qualify`, and `rebase` subtrees
contain 40 tool files, and 19 scripts or tests import those subtrees directly.
This makes a product build appear to own publishing, qualification, and rebase
execution even though the web application should only read an immutable,
already-published projection. It also leaves no independently runnable tool
entrypoint for the path required by the production/tool/test TypeScript graph.

The existing ACT teaching projection, rebase, canonical binding, and runtime
release specifications already define the semantics. The missing change is the
execution boundary and the retirement of the old authority, not a new data
model or a new selector.

## What Changes

- Create one independently runnable teaching-projection publishing CLI under
  the independent toolchain boundary.
- Move the complete publish, qualify, and rebase vertical path, including its
  capture-revision/hash checks, qualification gates, fail-closed behavior, and
  output formats, into that CLI.
- Keep shared projection contracts, immutable artifact readers, stores, and
  public runtime types in their existing product-facing owner when they are
  genuinely consumed at runtime; tool implementations must not be imported by
  the product graph.
- Migrate every current direct caller and its tool tests to the CLI contract,
  then delete the old `src/lib/teaching-projection/publish`, `qualify`, and
  `rebase` implementation authority. A forwarding facade is not an acceptable
  completion state.
- Make the web/runtime path consume only published projection artifacts,
  manifests, receipts, and database results through the existing consumer
  contract.

No production selector, active cutover, database mutation, or projection
semantic change is part of this proposal.

## Capabilities

### New capabilities

- `teaching-projection-publishing-cli`: an independently tested CLI that owns
  projection publication, qualification, and rebase execution.

### Modified capabilities

None. The canonical `act-teaching-projection` and
`act-teaching-projection-rebase` capabilities remain the semantic authority;
this change supplies their execution boundary.

## Impact

- **Code:** 40 files in the three tool subtrees, plus 19 direct script/test
  callers, are characterized and migrated. Shared runtime contracts remain
  only where a runtime consumer demonstrably needs them.
- **Commands:** package scripts and test entrypoints gain one explicit CLI
  surface; old direct module entrypoints are removed after migration.
- **Artifacts:** every output remains bound to capture revision, source/hash,
  projection scope, qualification, and release identity. Run-specific QA
  outputs are not introduced into the product bundle.
- **Dependencies:** this requires `establish-independent-toolchain-execution-boundary`,
  the production/tool/test graph split in
  `split-production-tooling-test-typescript-graphs`, and restoration of
  trustworthy repository verification commands.
- **Coordination:**
  `coordinate-latest-authority-and-active-oss-cutover` may consume the CLI's
  candidate artifacts and receipts, but continues to own coordinated selector
  decisions and activation. This proposal does not duplicate or perform that
  work. `stabilize-commercial-ui-qa-capture-contract` is unrelated except that
  both changes must keep run evidence outside product imports.


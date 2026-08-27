# Design: Teaching projection publishing CLI

## Baseline and denominator

The baseline is `edb98945e78ab0824f801806751fd57f97056347`. The denominator is
the 40 files below plus the 19 direct importers found outside the
`src/lib/teaching-projection` subtree:

- `publish`: 10 files;
- `qualify`: 14 files;
- `rebase`: 16 files;
- direct callers/tests: eight knowledge-cutover scripts, three remote/host
  scripts, and eight focused tests.

The remaining teaching-projection files are not assumed to be publishing tools:
contracts, stores, readers, source capture, resource bindings, and runtime
consumer types must be classified individually before moving or retaining them.

## Characterization

Before changing behavior, record for each command its current module entrypoint,
input files or database reads, capture revision and hash checks, qualification
rules, emitted manifest/receipt fields, failure exit code, and all callers. The
characterization must include byte/hash comparisons for representative publish,
qualify, and rebase outputs and the complete inactive/rebase denominator. A
failed or incomplete input must remain non-selectable and must not be replaced
with a best-effort output.

## Boundary decisions

1. **CLI ownership.** Place the implementation below the standard `tools/`
   boundary, with explicit command IDs for inventory/build, qualification,
   rebase, publication, and verification. The exact binary name may follow the
   repository's tool registry, but there must be one discoverable entrypoint and
   one owner for each operation.
2. **Contract ownership.** Reuse the canonical projection, resource-envelope,
   bundle, manifest, and consumer-read contracts. Extract only genuinely shared
   types or deterministic hashing helpers into an approved shared contract
   module; do not copy contracts into a second package.
3. **Runtime boundary.** The product graph reads a published projection and its
   receipt through the current runtime reader/store. It does not import CLI
   command modules, source-capture adapters, or publication writers.
4. **Failure semantics.** Capture drift, scope mismatch, missing Authority
   evidence, incomplete resource families, qualification failure, and hash
   mismatch fail closed with a receipt. The CLI never silently repairs or
   activates an invalid candidate.
5. **Migration and deletion.** Callers move to the CLI contract first. Only
   after the focused and graph checks pass are the three old tool subtrees and
   any forwarding entrypoints deleted. The old path is not retained as a
   compatibility facade.

## Verification and rollback

Run CLI unit/contract tests in the tool graph, existing consumer tests in the
web/test graph, and a characterization comparison against the baseline outputs.
Record command, commit, input capture revision, output hashes, and pass/fail in
an immutable receipt. If migration verification fails, keep the old files in
the uncommitted change until the specific failing caller is migrated; do not
switch a production selector or write a replacement projection.

## Dependencies and non-goals

This design depends on the independent boundary and split graph changes and
reuses `act-teaching-projection`, `act-teaching-projection-rebase`,
`canonical-knowledge-resource-binding`, and the runtime release contracts. The
active authority/cutover change remains the only owner of coordinated
activation. This proposal does not change projection meaning, selector values,
database schema, deployment, or production state.


## 1. Freeze the latest stable binding

- [ ] 1.1 Extend the latest-stable resolver and CLI output to bind the full ActKG main, packaging, source/tag, Release, Bundle, Manifest, Schema, dataset and predecessor identities without fixed version constants.
- [ ] 1.2 Add unique-selection, no-fallback, missing-object and pre/post-resolution drift tests.

## 2. Verify and stage the successor chain

- [ ] 2.1 Verify continuous successor/predecessor, Bundle/Schema compatibility, Release Diff semantics and Canonical identity preservation from the admitted endpoint to the candidate.
- [ ] 2.2 Stage the exact chain through temporary directories, post-copy byte/path validation and atomic rename; reject missing packages, path escapes and mixed revisions.

## 3. Import and accept the candidate in isolation

- [ ] 3.1 Import the staged candidate into an isolated database schema under a consistent snapshot and emit an immutable candidate receipt.
- [ ] 3.2 Independently recompute each Delta, compare it with the upstream Release Diff and emit accepted or rejected immutable receipts bound to the ACT capture revision.
- [ ] 3.3 Prove `PRODUCTION_SELECTOR_CHANGE=0`, `GRAPH_RAG_SELECTOR_CHANGE=0` and no Canonical writer-fence change on success and failure paths.

## 4. Verify the admission gate

- [ ] 4.1 Run targeted resolver, chain-intake, candidate-import, Delta, tamper and idempotency tests.
- [ ] 4.2 Run typecheck, strict OpenSpec validation and diff checks; publish the gate summary and exact receipt locations.

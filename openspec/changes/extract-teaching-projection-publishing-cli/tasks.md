# Tasks

## 1. Baseline and characterization

- [ ] 1.1 Freeze the baseline revision and enumerate the 40 files in `publish`, `qualify`, and `rebase`.
- [ ] 1.2 Enumerate and classify all 19 direct callers/tests, distinguishing tool execution from runtime contract consumption.
- [ ] 1.3 Capture representative publish, qualification, and rebase outputs, hashes, denominators, and fail-closed cases.
- [ ] 1.4 Record the retained shared contracts and the exact deletion set in a migration receipt.

## 2. CLI and contract boundary

- [ ] 2.1 Add the teaching-projection CLI to the independent tool registry and define its command/exit/receipt contract.
- [ ] 2.2 Move the complete publish, qualify, and rebase implementation into the CLI without changing canonical semantics.
- [ ] 2.3 Reuse or extract only the shared projection/read contracts required by runtime consumers; remove duplicate type ownership.
- [ ] 2.4 Add revision, capture-hash, scope, qualification, output-hash, and fail-closed receipt validation.

## 3. Vertical migration and deletion

- [ ] 3.1 Migrate every knowledge-cutover and preparation caller to the CLI entrypoint.
- [ ] 3.2 Migrate focused tests to the tool graph and retain product tests only for consumer behavior.
- [ ] 3.3 Update package scripts and documentation to use the CLI as the sole publishing path.
- [ ] 3.4 Delete the retired `src/lib/teaching-projection/publish`, `qualify`, and `rebase` authority and any forwarding modules.

## 4. Verification

- [ ] 4.1 Run independent tool typecheck and unit/contract tests.
- [ ] 4.2 Run the affected projection consumer tests and import-boundary check.
- [ ] 4.3 Compare representative outputs and rebase denominators with the characterization receipt.
- [ ] 4.4 Verify no production selector, database, or deployment state changed.

## 5. Documentation and handoff

- [ ] 5.1 Document the CLI owner, command IDs, inputs, outputs, and receipt schema.
- [ ] 5.2 Record deletion, migration, validation, and residual-risk evidence for the dependent coordination change.
- [ ] 5.3 Publish the final toolchain receipt without claiming production activation.


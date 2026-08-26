## 1. Baseline characterization and denominator

- [ ] 1.1 Verify clean worktree, source revision/tree, qualified charter, split TypeScript graph identity, and trustworthy command/receipt identity; stop on drift.
- [ ] 1.2 Recompute and freeze the command denominator from `git ls-files -- <path>` at the captured source revision across `tools`, `scripts/knowledge-cutover`, `scripts/knowledge`, `scripts/runtime-release`, `scripts/release`, `course-content/scripts`, `scripts/tests`, `scripts/migrations`, `scripts/db`, and any `evaluate`/artifact producer roots; exclude ignored, untracked, generated, runtime-created, `__pycache__/`, and `*.pyc` entries.
- [ ] 1.3 Store the characterization denominator fixture as the captured-tree SHA plus exact tracked-entry lists or digests and counts; record any future generated/untracked input separately as `generated-input` with producer/version, path class, digest, and source revision.
- [ ] 1.4 Classify every tracked denominator record as content export/review, knowledge release, runtime/OSS release, evidence/visual QA, migration/backfill, competition material, product runtime, adapter, fixture, or historical evidence; preserve unresolved ownership as blockers.
- [ ] 1.5 Characterize package scripts, tsconfig/vitest/playwright entrypoints, product imports, dynamic path reads, DB result consumers, generated runtime roots, and existing `tools/glb-model-optimizer` behavior.
- [ ] 1.6 Build fixtures for duplicate owner, unknown class, missing denominator, excluded `__pycache__/`/`*.pyc`, absolute path, undeclared external input, product-to-tool import, and public/private output confusion.

## 2. Boundary contracts and registry

- [ ] 2.1 Define the canonical tool registry schema, tool classes, owner IDs, command IDs, graph IDs, privacy classes, safety modes, source identities, output contracts, and retirement records.
- [ ] 2.2 Define canonical public bundle/manifest and database-result consumption contracts, including portable paths, content digests, schema versions, provenance, and fail-closed states.
- [ ] 2.3 Define private run-evidence references and retention/privacy rules; ensure receipts never serialize credentials, raw answers, user identifiers, absolute paths, or staging paths.
- [ ] 2.4 Create the `tools/` boundary entry and registry loader without migrating business implementations or changing runtime selectors.
- [ ] 2.5 Map each registry record to `split-production-tooling-test-typescript-graphs` and `restore-trustworthy-test-command-contracts`; do not create a second compiler or test-discovery authority.

## 3. Boundary enforcement and migration handoff

- [ ] 3.1 Add architecture checks for product-to-tool static/dynamic imports, run-directory reads, undeclared generated modules, and reverse edges from production to one-off scripts.
- [ ] 3.2 Add deterministic registry/manifest serialization and receipt validation, including source-tree, denominator, output, privacy, and retirement identity checks.
- [ ] 3.3 Add independent tool typecheck/test smoke commands and prove a tool-only error cannot be hidden by production typecheck, lint, or nightly results.
- [ ] 3.4 Record the full five-class migration map and caller inventory as the handoff input to the four downstream changes; include explicit non-overlap with active cutover and commercial UI capture changes.
- [ ] 3.5 Delete only any facade or temporary entry introduced by this change; do not delete existing business tools before their dedicated migration change.

## 4. Verification and receipts

- [ ] 4.1 Run boundary schema/fixture tests, product-to-tool dependency checks, registry denominator reconciliation, and public/private artifact contract tests.
- [ ] 4.2 Run the declared tools/test typecheck and focused command tests; preserve production graph verification as a separate receipt.
- [ ] 4.3 Run the affected architecture/command validation and record pre-existing failures separately from boundary failures.
- [ ] 4.4 Run `rtk openspec validate establish-independent-toolchain-execution-boundary --type change --strict` and `git diff --check`.

## 5. Documentation and handoff

- [ ] 5.1 Document tool classes, owner/command registry, product-consumption rules, public/private artifact classes, and deletion conditions.
- [ ] 5.2 Publish revision-bound denominator, registry, graph mapping, fixture, and validation receipts for downstream changes.
- [ ] 5.3 Document that this change creates no Issue, claim, deployment, data apply, selector mutation, production activation, or new business authority.

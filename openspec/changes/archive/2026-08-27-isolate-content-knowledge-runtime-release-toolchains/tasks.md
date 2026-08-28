# Tasks

## 1. Denominator and characterization

- [x] 1.1 Freeze the baseline and enumerate the 41 content, 7 knowledge, 75 knowledge-cutover, 33 runtime-release, and 5 release tracked entries with `git ls-files -- <path>`.
- [x] 1.2 Exclude ignored, untracked, generated, runtime-created, `__pycache__/`, and `*.pyc` entries from every source denominator; record future generated/untracked inputs separately as `generated-input` with producer/version, path class, digest, and source revision.
- [x] 1.3 Classify every tracked denominator entry by compiler, validator, publication writer, reader, candidate adapter, or operator activation/deployment role.
- [x] 1.4 Record all package scripts, callers, source/capture inputs, ReleaseSet/Bundle identities, manifest fields, writes, hashes, and failure behavior.
- [x] 1.5 Produce characterization fixtures/receipts for one content export, one locked knowledge publication, and one runtime materialization, each bound to the captured-tree entry list or digest.

## 2. Standard toolchain entries

- [x] 2.1 Register the content compiler, knowledge release, and runtime release entries with explicit owners and command contracts.
- [x] 2.2 Define one shared source/release identity and portable receipt contract without duplicating canonical specs.
- [x] 2.3 Move content export/review and provenance validation to the content tool.
- [x] 2.4 Move locked knowledge bundle publication, qualification, and projection handoff to the knowledge tool.
- [x] 2.5 Move immutable runtime publication, materialization, inspection, and verification to the runtime tool.
- [x] 2.6 Keep deployment, rollback, host activation, and coordinated selector transactions as explicit adapters.

## 3. Vertical migration and deletion

- [x] 3.1 Migrate package scripts and all classified callers in content, knowledge, and runtime order.
- [x] 3.2 Migrate focused tests to the independent tool graph and retain product tests only for runtime readers.
- [x] 3.3 Delete retired publication entrypoints and forwarding facades after each path passes its characterization comparison.
- [x] 3.4 Verify no product module imports a release writer or source-capture implementation.

## 4. Verification and safety

- [x] 4.1 Run independent typecheck and focused unit/contract tests for all three toolchains.
- [x] 4.2 Verify source/release identity, manifest hashes, output determinism, and fail-closed behavior.
- [x] 4.3 Verify candidate artifacts remain non-selectable and no deployment, selector, database, or production state changed.
- [x] 4.4 Record command, commit, inputs, outputs, and verification status in portable receipts.

## 5. Documentation and handoff

- [x] 5.1 Document the three toolchain owners, entrypoints, inputs, outputs, and receipts.
- [x] 5.2 Document collaboration with the active authority/OSS cutover change and the exact non-overlap with commercial UI capture.
- [x] 5.3 Hand off deletion and verification evidence without claiming production activation.

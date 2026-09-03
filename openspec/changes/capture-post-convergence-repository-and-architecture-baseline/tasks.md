## 1. Hard coordination gate

- [x] 1.1 **Before any claim, apply, implementation, test, or capture:** the parent coordination layer verifies from live GitHub Issue state that #1805–#1810 are all closed, carry `status:archived`, and have their native `blockedBy` dependencies resolved. If any condition is false or cannot be verified, stop and leave every later task blocked. This change's artifacts must not register or fabricate the native relationships.

All tasks 2.1–7.6 depend on 1.1. The change must not be claimed or applied and no implementation or capture may start until this gate is satisfied.

## 2. Freeze the successor contract and inputs

- [x] 2.1 Re-read the canonical modular-monolith baseline, current-head delta, architecture charter/fitness readers, census schemas, receipt writers, OpenSpec status, and package command contract; record their exact predecessor identities and the explicit non-goals for A.
- [x] 2.2 Define the versioned A2 successor envelope and status model (`captured`, `digest-verified`, `qualified-for-investigation`, never `active-baseline`) with successor identity, predecessor baseline/current-head identity and digest, one source commit/tree, tool/schema versions, command scope, frozen receipt IDs, and handoff fields.
- [x] 2.3 Define the compact output contract under `docs/architecture/modular-monolith/post-convergence/`: `summary.md`, `baseline.json`, `owner-residue.md`, `hotspots.md`, `payload-classes.md`, and `test-baseline.md`; define logical local/CI artifact locators, byte counts, SHA-256 digests, and the non-self-referential package digest scope.
- [x] 2.4 Define the source precondition and write gate: checked-out HEAD must equal the declared clean `origin/integration` HEAD, Git identity must resolve, and all predecessor inputs must exist and hash-match; no proposal or implementation-checkpoint revision may be treated as the final capture implicitly.

## 3. Extend the existing deterministic census projection

- [x] 3.1 Extend `src/lib/architecture-census/types.ts` and the existing serializers with successor, layer-total, denominator-slice, artifact-locator, and handoff types while preserving the existing census core and measurement-receipt schemas.
- [x] 3.2 Add one deterministic material-layer classifier for hand-authored production, tests, tools/scripts, authored course content, generated runtime/release, active/archive OpenSpec, QA/browser evidence, build assets, and binary/media/model; emit only repository-relative identity, tracked bytes/blob digest, and bounded relationship counts.
- [x] 3.3 Derive the successor architecture denominator from the existing census core/graph and the complete `INVENTORY_KINDS` set plus the predecessor manifest's complete stable kind set (currently 18 kinds), adding feature-to-App Router, deep-import, core-infrastructure, SCC, `src/lib` business, compatibility, duplicate-owner, public-entrypoint, single-implementation-interface, delegate-only-wrapper, and zero-caller aggregate slices with explicit include/exclude rules and reconciliation totals. The successor/predecessor kind sets must match exactly unless an explicit schema-versioned addition is declared and validated; layer/code/payload categories must remain projections, not a new inventory kind.
- [x] 3.4 Reuse the current-head delta adapter to project owner residue, consumer classes, active-vs-archived OpenSpec overlap, and historical predecessor references; reject missing or drifted predecessor identity instead of creating a parallel delta or ledger.
- [x] 3.5 Add payload-class observation over tracked bytes/blob identities, duplicate blobs, current runtime references, and archive-only references; keep authority, materialization, retention, and deletion decisions unresolved for C/data-governance owners.

## 4. Add deterministic observations and immutable receipts

- [x] 4.1 Implement deterministic Top 50 hotspot vectors from source bytes, function count, branch count, import breadth, fan-in/fan-out, declared Git change frequency, test density, and trust density; preserve metric scope/evidence, stable tie-breaks, and unresolved missing inputs without creating a budget.
- [x] 4.2 Route bounded typecheck/test/build observations through the existing immutable measurement-receipt writers; record command/scope, source identity, platform/tool versions, cache mode, exit status, aggregates, and bounded fingerprints in `test-baseline.md` without changing test-command qualification.
- [x] 4.3 Ensure deterministic source-core and projection serialization is stable-sorted and excludes wall-clock values except declared receipt metadata; reruns with the same source and frozen receipt IDs must be byte-identical, while a new measurement receives a new receipt ID.
- [x] 4.4 Add privacy/path checks over every successor projection and detail artifact; fail closed on secrets, learner identifiers, raw answers/events, private content, media/screenshots/model bodies, absolute paths, complete logs, or unsafe blob payloads.

## 5. Implement the single capture mode and compact artifact boundary

- [x] 5.1 Add a post-convergence successor mode to `scripts/architecture-census.ts` that reuses `loadGitSourceSnapshot`, `generateCensusCore`, current-head projection, existing receipt readers/writers, deterministic serialization, and privacy validation; do not add a second census entrypoint or registry.
- [x] 5.2 Validate the pre-capture identity, predecessor baseline/current-head hashes, source cleanliness, origin/integration equality, and post-generation identity before writing any qualified successor; report only safe failure codes and never overwrite historical baseline/current-head files.
- [x] 5.3 Write the six compact Git projections and `baseline.json` artifact index, including layer/denominator aggregates, unresolved/ambiguous counts, frozen receipts, logical full-inventory/detail locators, byte counts, digests, and B/C/D/N5 read-only handoff requirements.
- [x] 5.4 Emit the complete per-file and bounded AST/graph detail as reproducible local/CI artifacts (for example `architecture-census/<successorCaptureId>/full-inventory.ndjson`), verify their recorded digests, and refuse absolute filesystem locators or best-effort fallback when an artifact is missing.
- [x] 5.5 Keep `captured`, `digest-verified`, and `qualified-for-investigation` observational; do not update `REQUIRED_BASELINE`, `REQUIRED_FITNESS_BUDGET`, test qualification, CI/runtime gates, charter selectors, or active baseline state.

## 6. Prove the implementation checkpoint and contract behavior

- [x] 6.1 Add fixtures for all material layers, complete `INVENTORY_KINDS` and predecessor manifest kind sets, derived denominator slices, production/test/tooling/dynamic/re-export consumers, active/archive OpenSpec references, duplicate owners/blobs, public entrypoints, wrappers, zero callers, SCCs, and Top 50 metric ties/missing inputs.
- [x] 6.2 Add contract tests for clean origin/integration acceptance, implementation-checkpoint-versus-final-capture separation, predecessor continuity, immutable successor identity, and historical overwrite rejection.
- [x] 6.3 Add rejection tests for dirty/mixed/unresolved/mismatched source identity, origin drift, predecessor hash drift, duplicate IDs, denominator gaps, unsafe privacy/path content, missing detail locators, and artifact digest mismatch.
- [x] 6.4 Add determinism tests proving the census core, compact projections, and artifact index are byte-identical for identical source/frozen receipts; prove rerun timing/memory/test measurements create new receipts without mutating old inputs.
- [x] 6.5 Add scope tests proving owner residue, payload classes, and test redness remain observation/ambiguous/unresolved and that no code path changes product, DB, runtime/OSS, CI, GitHub, fitness budget, or test qualification state.
- [x] 6.6 Commit a clean implementation checkpoint containing the schema, generator, projections, tests, and command contract but no generated post-convergence successor; run the focused census/receipt/privacy/determinism/denominator suite, `rtk npm run typecheck`, and strict OpenSpec validation.
- [x] 6.7 Prove that the successor and predecessor manifest kind sets are byte-for-byte equal and that any intentional kind addition is rejected unless accompanied by an explicit schema-versioned migration; prove layer/code/payload categories are aggregates only and do not inflate the inventory kind set.

## 7. Capture the clean post-convergence successor and hand off

- [ ] 7.1 After the gate in 1.1 has passed and live #1805–#1810 are all complete and archived, verify the checked-out clean `origin/integration` HEAD and revalidate the immutable predecessor baseline/current-head identities before running capture.
- [ ] 7.2 Run the single successor mode from that exact source, generate the six compact projections and local/CI detail artifacts, inspect every `ambiguous`/`unresolved`/excluded record, and verify denominator closure, privacy, source identity, artifact digests, and deterministic re-projection from the frozen receipt set.
- [ ] 7.3 Commit only the reviewed compact package and locator/digest metadata; confirm the successor remains independent of and does not overwrite the historical baseline/current-head package.
- [ ] 7.4 Record the exact successor identity and digest-bound locators for B (owner residue), C (payload classes), and D (test baseline); state that each reader must fail closed on missing/stale/mixed inputs and that A performs no adjudication.
- [ ] 7.5 Hand the completed successor to N5 as an investigation input only; document that N5 alone may later recapture/prove equivalence and atomically activate baseline+charter+fitness+test qualification, and that HEAD drift requires N5 recapture or equivalence proof.
- [ ] 7.6 Run `rtk openspec validate capture-post-convergence-repository-and-architecture-baseline --type change --strict` and record the exact successful result with the final artifact paths, verification scope, and remaining non-blocking risks.

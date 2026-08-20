## 1. Composite envelope binding

- [x] 1.1 Read the admitted v0.22 composite candidate receipt from
  `import-actkg-v022-composite-candidate` and pin the envelope identity
  (Aggregate release, Component Manifest, Integration v0.20, Chinese
  terminology component v0.5, schema evidence) for all rebuild tooling.
- [x] 1.2 Add a fail-closed consistency check that the catalog, zh-CN, and
  teaching-projection builders all reference the identical envelope and never
  resolve a "latest" release at runtime.

## 2. Domain display catalog rebuild

- [x] 2.1 Load the v0.22 domain catalog data and derive the top-level domain
  entries, reviewed order, and aggregate entry without any hard-coded count.
- [x] 2.2 Rebuild many-to-many membership for every published v0.22 concept
  with one deterministic preferred navigation domain per object; validate that
  no published concept has zero domain memberships and that no member
  references an absent object.
- [x] 2.3 Replace the v0.9-bound manual membership source in candidate space
  while leaving the currently served production catalog untouched.
- [x] 2.4 Verify presentation safety: reviewed Chinese names and summaries
  only; no catalog keys, object IDs, release identifiers, hashes, or raw
  enums in product-visible text.

## 3. zh-CN display projection rebuild

- [x] 3.1 Bind the localized resolver context to the v0.22 snapshot and
  terminology component v0.5; record the sealed index count from admission
  evidence as the release-bound invariant.
- [x] 3.2 Refresh fixtures and tests for `canonical_preferred`, `alternative`,
  `display_name` fallback, missing, duplicate, unsafe, and profile-drift
  cases against v0.22 data.
- [x] 3.3 Scan the v0.22 Formula display set; author any record-bound fallback
  pins under the existing pin rules and keep hard path/identity failures
  fail-closed.
- [x] 3.4 Prove the no-internal-ID boundary end to end: unsafe or empty labels
  yield a bounded human message and never raw IDs, hashes, release strings,
  paths, or slugs.

## 4. Teaching projection and prerequisite rebase

- [x] 4.1 Capture the complete active teaching-reference denominator (courses,
  packages, resources, cards, infographs, textbook locators, prerequisites,
  learning paths, Konling, RAG) with source revisions and digests.
- [x] 4.2 Resolve every captured reference by unchanged stable ID or explicit
  reviewed mapping to the v0.22 successor set; emit `REVIEW_REQUIRED` for
  splits, merges, deletions, and ambiguities and close the worklist.
- [x] 4.3 Build the complete inactive Teaching Projection and prerequisite
  candidates twice with the candidate-import database observation; verify
  byte-identical outputs and `nonActivation` receipts.
- [x] 4.4 Verify that new v0.22 nodes without teaching relations do not block
  rebase completion and that later published relations can be added through a
  new complete Projection release.

## 5. Verification

- [x] 5.1 Run the catalog, resolver, and rebase unit/integration suites plus
  lint and typecheck.
- [x] 5.2 Snapshot all current production pointer bytes before and after each
  candidate build and assert zero drift.
- [x] 5.3 Run
  `openspec validate rebuild-v022-domain-catalog-and-projections --type change --strict`
  and keep it passing.

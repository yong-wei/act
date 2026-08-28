# Proposal: Isolate content, knowledge, and runtime release toolchains

## Why

Content export, knowledge release, and OSS runtime release currently span
`course-content/scripts`, `scripts/knowledge`, `scripts/knowledge-cutover`,
`scripts/runtime-release`, and `scripts/release`. The captured-tree inventory
is 41, 7, 52, 32, and 5 tracked entries respectively. Their publication writers, validators,
candidate preparation, and operator activation adapters are therefore easy to
reach through product-oriented scripts and difficult to typecheck or test as
independent release tools.

Every source denominator in this proposal means tracked entries returned by
`git ls-files -- <path>` for the declared captured Git tree and source revision.
Ignored, untracked, generated, and runtime-created files are excluded,
including `__pycache__/` and `*.pyc`. A future generated/untracked input may be
used only as a separate `generated-input` category bound to producer/version,
path class, content digest, and source revision; it must not be mixed into the
tracked source denominator.

The repository already has canonical specifications for authoring-to-runtime
content, authoritative knowledge ingestion, ACT teaching projection, and
content-addressed OSS runtime storage. This proposal makes those contracts
executable at a standard toolchain boundary. It does not invent a second
release model or move production activation into the application.

## What Changes

- Establish standard content-compiler, knowledge-release, and runtime-release
  tool entries under the independent toolchain registry.
- Move content export/review, locked knowledge bundle publication, and
  immutable runtime release construction/inspection into those entries.
- Keep operator-only deployment, activation, rollback, and coordinated selector
  transactions behind explicit adapters owned by their existing release or
  coordination contracts.
- Preserve authoring/runtime separation, Authority and Teaching Projection
  identity, ReleaseSet/Bundle locks, immutable runtime manifests, lifecycle
  receipts, and source/hash proof.
- Migrate package scripts and callers, then remove retired entrypoints and
  facades after independent verification. A renamed wrapper over the old graph
  is not completion.

No production selector, active cutover, deployment, database mutation, or
release semantic change is included.

## Capabilities

### New capabilities

- `content-knowledge-runtime-release-toolchains`: standard, independently
  runnable toolchain entries for content, knowledge, and runtime publication.

### Modified capabilities

None. The change reuses and operationalizes the canonical content, knowledge,
teaching-projection, and OSS runtime release capabilities.

## Impact

- **Code:** the five enumerated captured-tree script families (41, 7, 52, 32,
  and 5 tracked entries) are characterized and split by owner; shared read
  contracts remain where the web/runtime graph needs them. The counts are
  derived with `git ls-files -- <path>`, not filesystem traversal.
- **Release outputs:** content, knowledge, projection, and runtime outputs keep
  immutable identity and source-capture binding. Candidate outputs remain
  non-selectable until the existing coordinated contract authorizes activation.
- **Verification:** each toolchain has an independent typecheck/test command
  and a portable receipt; product typecheck does not stand in for release
  verification.
- **Dependencies:** requires `establish-independent-toolchain-execution-boundary`
  and the graph split in `split-production-tooling-test-typescript-graphs`; the
  teaching projection CLI is a hard dependency for projection publication.
- **Coordination:**
  `coordinate-latest-authority-and-active-oss-cutover` remains the sole owner of
  coordinated candidate transactions and selectors. This change supplies
  artifacts and receipts only. `stabilize-commercial-ui-qa-capture-contract`
  is preserved as the owner of its commercial capture runner and is not
  reimplemented here.

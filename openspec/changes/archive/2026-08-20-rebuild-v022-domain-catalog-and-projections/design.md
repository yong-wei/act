## Context

The latest stable ActKG Aggregate is `control-theory-engineering-v0.22`. Its
Component Manifest locks Integration v0.20, Chinese terminology component v0.5,
and the remaining declared components; it continues to use
`actkg-public-bundle/2` and Schema `0.3.0` with the same schema hash ACT already
admitted for v0.18, so no new schema major-version adapter is needed. v0.22 has
no local mirror yet: the real domain count is verified from the domain catalog
data during candidate import, and the "eight domain entries" seen in scenario
material is illustrative only.

ACT's current domain display catalog still binds `control-theory-engineering-v0.9`
and contains only a few manually classified members, which explains the one-or-
two "reviewed objects" per domain on /knowledge. The Teaching Projection and
prerequisite publication were last rebased to v0.18. The settled domain model is
many-to-many membership, every published concept in at least one domain, and a
flat controlled top-level domain vocabulary with no sub-domain hierarchy
(ADR 0017, ADR 0041, docs/contexts/course-knowledge-base/CONTEXT.md).

This change rebuilds all three display projections in candidate space against
the v0.22 composite candidate produced by
`import-actkg-v022-composite-candidate`. Candidate import and production
activation remain two phases; nothing here moves a production selector.

## Goals / Non-Goals

**Goals:**

- Bind the rebuilt domain catalog, zh-CN display projection, and Teaching
  Projection/prerequisite candidates to one pinned v0.22 composite release
  envelope.
- Derive domain entries, order, and count from the v0.22 domain catalog data;
  never hard-code the count in code or spec.
- Guarantee every published v0.22 concept belongs to at least one registered
  domain, replacing the sparse manually classified v0.9 membership.
- Preserve the fail-closed no-internal-ID display boundary for all rebuilt
  human-facing text.
- Keep missing teaching coverage from blocking the later Authority cutover;
  allow newly published teaching relations to load incrementally afterwards.

**Non-Goals:**

- Activating the v0.22 candidate or changing any production selector.
- Editing ActKG engineering objects, relations, or authority identity.
- Designing the homepage circular domain entries or the second-level domain
  relation graph (separate presentation changes consume these projections).
- Guaranteeing complete Chinese terminology coverage or complete teaching
  coverage for new v0.22 nodes.
- Re-reviewing historical CourseCoverage audit outcomes.

## Decisions

### 1. One composite envelope, no runtime latest-following

Every rebuilt artifact records and validates the same pinned composite release
envelope identity: the v0.22 Aggregate release plus its Component Manifest as
admitted by `import-actkg-v022-composite-candidate`. A rebuild whose inputs
reference any other release, or that resolves "latest" at runtime, fails
closed. This prevents the mixed state the current v0.9-bound catalog
represents from recurring at v0.22.

### 2. Domain entries are data, not constants

The catalog rebuild reads the domain catalog data of the bound envelope and
emits exactly those top-level domains in reviewed order. No expected count is
asserted in code, configuration defaults, or spec text (do not assume 8 or 9).
The control-theory integration component remains a separately typed aggregate
navigation entry, never a peer domain. The vocabulary stays flat: no
sub-domain hierarchy per ADR 0041.

### 3. Full published-concept coverage with many-to-many membership

Membership follows the settled model: an object may belong to several domains,
keeps one deterministic preferred navigation domain, and every published
concept in the bound selection must appear in at least one domain. Coverage
validation fails the candidate catalog when an orphan concept or an absent
member reference is found; the prior catalog keeps serving until a valid
candidate exists. Membership remains a display projection and is never written
back to ActKG Engineering Authority.

### 4. zh-CN projection rebuilds on the existing resolver contract

The localized label resolver keeps its existing contract — keyed by the
selected snapshot, stable entity ID, exact `zh-CN`, and admitted runtime
Projection Profile, with `canonical_preferred` primary labels, `alternative`
aliases, and Projection `display_name` fallback — and is bound to the v0.22
Chinese terminology component v0.5. The sealed index-count admission invariant
becomes release-bound: 1909 remains the invariant for the sealed v0.18 index,
and the v0.22 invariant is the count recorded in the v0.22 candidate admission
evidence. The v0.22 Formula display set receives its own scan; any record-bound
fallback pins follow the already-specified pin rules for the v0.22 release.
Unsafe or empty labels keep failing closed with a bounded human message and
never fall back to IDs, hashes, release strings, paths, or slugs.

### 5. Teaching rebase repins to v0.22 with identity evidence only

The rebase reuses the proven v0.18 pipeline: freeze the complete active
reference denominator at one capture, resolve each captured reference by
unchanged stable ID or an explicit reviewed mapping to the v0.22 successor
set, and emit `REVIEW_REQUIRED` for anything unresolved. Predecessor objects
come from the captured active selection (the currently active release plus the
residual v0.9-bound catalog memberships being retired); names, labels,
aliases, similarity, embeddings, and graph distance never select a successor.
Output is a complete, deterministic, content-addressed inactive candidate; the
database observation uses the candidate-import helper against the pinned
v0.22 Bundle with the same fail-closed evidence rules.

### 6. Coverage gaps do not block the cutover

New v0.22 engineering nodes without teaching relations stay outside the rebase
denominator. Their absence from the Teaching Projection never blocks rebase
completion or the later Authority cutover; newly published teaching relations
arrive through later complete Projection releases and load incrementally.

### 7. Candidate/production separation is checked in bytes

The builders write only scoped content-addressed candidate roots, snapshot all
current production pointer bytes before and after generation, reject any
difference, and stamp every receipt `nonActivation: true`. A later activation
change owns the composite switch; this change only makes it possible.

## Risks / Trade-offs

- The v0.22 domain catalog data is not yet mirrored locally; if the candidate
  import surfaces unexpected catalog structure, coverage validation may
  require reviewed classification work before a valid candidate exists. That
  is accepted: fail-closed beats shipping another sparse catalog.
- Requiring every published concept in at least one domain can delay the
  candidate until classification closes, but prevents the current
  1–2-objects-per-domain regression from recurring.
- Some v0.22 nodes will keep reviewed English or mathematical display names;
  complete Chinese coverage is explicitly not claimed.

## Migration Plan

1. Verify the admitted v0.22 composite candidate and record its envelope
   identity for all builders.
2. Rebuild the domain display catalog candidate from the v0.22 domain catalog
   data; run coverage, membership, and presentation-safety validation.
3. Rebind the zh-CN resolver context to terminology component v0.5; refresh
   fixtures, Formula scan, and fail-closed tests.
4. Capture the teaching-reference denominator, close the mapping worklist, and
   build the inactive Teaching Projection and prerequisite candidates twice to
   prove determinism.
5. Run pointer byte-stability checks, strict OpenSpec validation, and the
   focused test suites; leave activation to the later composite cutover change.

## Open Questions

- None. The concrete domain entry list and terminology index count are read
  from the v0.22 candidate admission evidence, not decided here.

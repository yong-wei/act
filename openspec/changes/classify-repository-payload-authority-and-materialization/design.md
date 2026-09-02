## Context

The repository has separate authorities for authored content, generated
runtime/release material, QA evidence, knowledge publication, and OSS-backed
runtime selection. Existing contracts already require Git-bound manifests,
portable evidence, explicit lifecycle state, candidate/production separation,
and fail-closed validation. This change must add an observation-only
classification boundary without creating a second authority for any of those
systems.

The only classification subject is the immutable successor capture produced by
change A. Before claim, apply, implementation, or a classification run, the
parent coordination layer must verify from live Issue state that Issue #1876 is
closed, has `status:archived`, and has its native `blockedBy` dependency
resolved. It must also provide A's exact successor subject identity and digest.
Local OpenSpec names, directory presence, a closed Issue without the label, or a
missing/stale capture cannot satisfy this gate. C is independent of B and D.

The existing `qa-evidence-artifact-lifecycle`,
`content-addressed-runtime-release-storage`,
`content-knowledge-runtime-release-toolchains`, OSS runtime, architecture
fitness, and release-selector contracts remain read-only inputs and are not
modified. The existing QA lifecycle and content/knowledge/runtime toolchain
entries remain the owners of their own manifests, privacy gates, lifecycle
receipts, and activation state.

## Goals / Non-Goals

**Goals:**

- Define one compact `repository-payload-classification` capability with a
  revision-bound, content-addressed evidence record for every qualified path or
  homogeneous family.
- Consume A's subject identity and full-inventory locator/digest without
  copying or rewriting A's capture. Preserve the distinction between subject
  identity and this classifier's tool identity.
- Close the declared scope denominator for runtime/release, QA, architecture,
  archived evidence, generated/binary, and large fixture surfaces, including
  concrete infograph, PPTX, PPM, EMF, GLB, and JSON families discovered by A.
- Require exactly one primary class for a `qualified` record and preserve
  evidence-insufficient records as `unresolved` rather than inventing a seventh
  class or forcing A-F.
- Capture production, test, tool, documentation, and dynamic consumers;
  authority, provenance, retention, privacy, materialization, rollback, and
  recovery conditions; and safe locators without serializing payload bodies.
- Emit compact summary/index/policy/unresolved/future-eligibility projections
  plus a complete inventory locator and digest that downstream work can verify.
- Prove no-mutation behavior and deterministic output only for the same subject,
  classifier tool, schema, and frozen inputs.

**Non-Goals:**

- Do not delete, move, rename, upload, download, externalize, or materialize
  any payload. Exact or near duplicates, generated status, and ephemeral status
  are observations, never deletion authority.
- Do not modify or duplicate runtime blob/manifest/materializer/GC behavior,
  knowledge release tooling, QA evidence registry/privacy/publication,
  architecture fitness, release selectors, current/active authority, schemas,
  CI, product code, database, Git history, or OpenSpec archive content.
- Do not infer production authority from a directory name, version string,
  matching hash, candidate/staged publication, or current application HEAD.
- Do not query or change remote production/OSS state. Missing remote facts stay
  `unresolved`; this change does not invoke `server-ops`.
- Do not put a giant per-file ledger, binary, raw private evidence, secrets, or
  machine-local absolute paths in Git, and do not create a downstream Issue.

## Decisions

### 1. Make A's successor capture a hard, immutable input

The classifier accepts one schema-validated A handoff containing the exact
successor capture ID, subject identity, capture digest, source revision/tree,
scope denominator digest, and full-inventory locator/digest. The concrete field
names and locator supplied by A are authoritative; an implementation must not
guess a path or fall back to the working tree. It records the A identity and
digest verbatim in every compact projection and in the complete inventory
header.

The preflight checks the live coordination evidence and then verifies that the
capture locator, digest, source identity, and declared scope are readable and
internally consistent. Any missing, stale, mixed-worktree, or drifted input
blocks the run before a qualified result is written. The proposal-time size
and duplicate observations are descriptive only and cannot become thresholds,
denominator values, or acceptance assumptions.

### 2. Define one denominator from A, with explicit scope slices

The denominator is the exact A-captured entry set, not a fresh local glob. It
must include, at minimum, these slices and their include/exclude rules:

- `course-content/**/releases/**` and `course-content/runtime/**`;
- `artifacts/**`;
- `docs/architecture/*.json` and any nested architecture family explicitly
  enumerated by A;
- `openspec/changes/archive/**/evidence/**`;
- WASM, package, generated-asset, and generated-output families;
- large fixtures and snapshots;
- A's discovered large `infograph`, `.pptx`, `.ppm`, `.emf`, `.glb`, and JSON
  families, with their actual repository-relative members and locators.

Each slice records discovered, `qualified`, `justified-excluded`, and
`unresolved` member counts plus a separate duplicate-group/member-reference
observation and a digest of stable member identities. A denominator member has
exactly one disposition from `qualified | unresolved | justified-excluded`;
duplicate membership is never a fourth disposition and never reduces the
member count. The counts must reconcile; ignored, untracked, runtime-created,
or generated entries may only appear as separate generated-input observations
when A explicitly declares their producer/version, class, digest, and source
identity. A missing slice or an item with no classification, unresolved reason,
or justified exclusion evidence fails closed.

Families are an output compression, not a new authority. A family may be
aggregated only when every `qualified` member has homogeneous primary class
and every policy-relevant facet: authorship/reproducibility, release/rollback
role, QA role, cache/materialized role, authority, consumer, privacy,
retention, materialization, recovery, rollback, and qualification evidence.
Every member still retains its own disposition and identity. A single
conflicting, missing, or privacy-unknown member causes the family to split into
smaller homogeneous families or leaves the affected members `unresolved`; it
is never silently averaged.

### 3. Checkpoint the classifier and keep identities dual

If implementation adds a classifier or validator, it first creates one clean
tool checkpoint and records `toolCommit`, `toolTree`, `schemaVersion`, and an
entry-bundle digest (including the declared lock/config inputs). This tool
identity is never substituted for A's `subjectIdentity`.

The classifier then reads the independent A subject checkout/artifact and
freezes the complete input set: A capture digest, denominator digest,
consumer/provenance evidence digests, and policy/schema inputs. Determinism is
required only when subject identity, tool identity, schema, and frozen inputs
all match. A subject drift, tool/tree drift, schema drift, or frozen-input
drift fails closed and cannot be repaired by rewriting the report.

### 4. Use one mutually exclusive primary class plus orthogonal facets

Every record has a stable `recordId`, `path` or `familyId`, `hash`, safe
non-negative `sizeBytes`, A subject identity, a denominator `memberDisposition`,
and a `classificationStatus`. The member disposition is exactly one of
`qualified | unresolved | justified-excluded`. Only a `qualified` member has a
primary class; `unresolved` and `justified-excluded` members keep
`primaryClass: null` and their bounded evidence/reason.

For a qualified record, `primaryClass` is exactly one of:

- **A** — hand-authored source of truth;
- **B** — reproducible generated output;
- **C** — immutable release/rollback artifact;
- **D** — ephemeral QA evidence;
- **E** — cache/materialized view;
- **F** — regulated/privacy-sensitive evidence.

The primary class is selected from a deterministic evidence priority, evaluated
only after privacy and critical evidence are known:

`F > C > D > E > A > B`.

Confirmed regulated/privacy-sensitive evidence selects F even when the same
bytes are authored, generated, released, or used as QA. A proven immutable
release/rollback role selects C over generated/authored/QA/cache signals;
ephemeral QA selects D over cache/source/generation; cache/materialized selects
E over source/generation; hand-authored authority selects A over reproducible
generation; and reproducible generated output selects B when no higher signal
exists. Existing QA and runtime contracts define separate lifecycle dimensions
but do not define a cross-class primary precedence, so this change fixes the
order above without changing those contracts.

The record also retains orthogonal facets rather than collapsing them into the
primary class:

- `authorship`: `hand-authored | generated | mixed | none | unknown`;
- `reproducibility`: `reproducible | non-reproducible | not-applicable |
  unknown`;
- `releaseRoles`: sorted set of `immutable-release | candidate | active |
  rollback | historical`;
- `qaRoles`: sorted set of `representative-fixture | run-specific-output |
  audit-closure`;
- `cacheMaterializedRoles`: sorted set of `cache | materialized-view |
  hot-cache`;
- `privacy`: `public | internal | private | regulated | unknown`;
- `retention`: `retain-in-git | existing-external-lifecycle | local-only |
  delete-after-proof | unknown`.

Empty role sets are explicit. Authority, consumer, manifest, materialization,
recovery, and rollback evidence remain separate fields even when a facet drives
the primary class. Unknown privacy or missing/conflicting critical evidence
always produces `unresolved` before precedence is applied; no seventh class is
introduced and no A-F label is forced.

The required precedence examples are tested and serialized with all facets:

| Evidence combination | Primary class | Facets preserved |
| --- | --- | --- |
| D + F | F | QA role and confirmed sensitive privacy |
| B + C | C | generated/reproducible and immutable release/rollback |
| B + E | E | generated/reproducible and cache/materialized |
| A + F | F | hand-authored authority and confirmed sensitive privacy |

The evidence envelope contains, as applicable:

- repository-relative path or homogeneous family members and content hash/size;
- A subject identity and the classifier tool/schema identity;
- producer, version, source identity, reproducibility method and validator
  result, or an explicit non-reproducible reason;
- all discovered production, test, tool/script, documentation, and dynamic
  consumers, with required/optional status and evidence locators;
- canonical source, manifest/receipt, selector or lifecycle authority and
  candidate/production/rollback state, never inferred from naming;
- retention/deletion condition, privacy class and approval, and the exact
  materialization, recovery, and rollback preconditions;
- duplicate/near-duplicate observations and their comparison evidence, marked
  as non-authorizing.

An absent field that is required for the proposed class produces
`unresolved`; an unknown remote production or OSS fact is never represented as
`false` or `not a consumer`.

### 5. Separate authority, consumers, and provenance

The inventory uses existing read-only registries, manifests, receipts, source
graphs, package scripts, service definitions, path references, tests, and
documentation to enumerate consumers. Dynamic imports, shell/path reads,
manifest references, worker readers, and runtime-discovered readers are
separate evidence kinds. An unbounded dynamic or remote consumer is an
unresolved consumer-closure condition.

Authority is recorded as distinct fields for canonical source, production
authority, candidate/staged state, rollback identity, and historical evidence.
Candidate publication or a staged release never becomes active authority by
itself. Existing runtime/knowledge/QA selectors and manifests may be read and
hash-checked, but the classifier does not write them. This preserves the
existing candidate-production separation and the read/release tool boundary.

### 6. Keep member disposition and duplicate observations orthogonal

Every denominator member is independently assigned exactly one disposition:
`qualified`, `unresolved`, or `justified-excluded`. A qualified member still
receives one primary class and all facets; an unresolved member retains only
safe identity, bounded reason, and available facets/evidence; a justified
exclusion retains the exclusion basis. A duplicate group contains only sorted
references to those member IDs plus the comparison evidence. It is not a
disposition, does not replace a member record, and does not reduce any
denominator count.

Exact duplicate groups require the same hash and size; near-duplicate groups
retain A's declared comparison algorithm, parameters, and evidence. Both are
reported as candidate savings or review links only. A duplicate cannot justify
deletion, externalization, source replacement, selector change, or loss of
consumer/authority/retention/privacy/recovery evidence.

`futureEligibility` is true only when all of the following are independently
proved: canonical source; complete consumer list; explicit retention/deletion
condition; zero-required-consumer proof; immutable locator and hash;
materialization/recovery/rollback proof; and privacy approval. Any missing,
unknown, or drifted input keeps the record or family `unresolved` for this
decision. This output is a readiness observation, not authorization to act.

The policy matrix describes Git retention, approved external storage,
local-materialization, CI generation, and rollback/recovery separately for
A-F. F and unknown privacy records cannot be publicly externalized. D follows
the existing QA privacy/retention lifecycle. Runtime and knowledge records
follow their existing manifest/lifecycle roots and candidate-production/GC
separation. The classifier does not execute any matrix action.

### 7. Keep Git projections compact, non-self-referential, and private

The committed projection set lives under
`docs/architecture/repository-payload-classification/` and contains:

- `summary.md` — counts, status, subject/tool identities, and bounded findings;
- `index.json` — canonical envelope, scope slices, projection identities, and
  complete-inventory locator/digest;
- `policy-matrix.md` — class-by-class storage/materialization/rollback policy;
- `unresolved.md` — safe record IDs, reasons, and evidence locators;
- `future-eligibility.md` — gate-by-gate status and missing-proof reasons.

`index.json` lists only its four sibling compact projections (or the declared
actual sibling count if the set is explicitly versioned) and the full-inventory
artifact identity/digest. It SHALL not list an `index.json` member or its own
hash. `packageDigest` is computed over a canonical, sorted package-input
envelope containing the A subject identity/capture digest, classifier tool
identity, schema, frozen-input/directory digests, and denominator member
identity+digest+disposition tuples. It excludes the bytes of `index.json`, an
`index.json` digest field, and any self-reference. The index's own bytes are
bound outside the envelope by its immutable Git blob identity or an outer
locator/receipt; no field inside the index requires its own hash.

The full per-record inventory is a separately addressable, content-hashed
NDJSON/JSON artifact referenced by `index.json`; the classifier may generate it
in an approved local/CI output location, but this change neither uploads nor
downloads it. All serialization uses stable ordering and repository-relative or
logical locators. A package-wide privacy scan runs over the full-inventory
header, every member, every evidence locator, and every compact projection
before the package can be qualified. It rejects credentials, cookies,
learner/user identifiers, raw answers/events, private audit evidence, local
absolute paths, private locators, and unknown privacy classes; failures report
only safe record IDs and reason codes, and do not reproduce the offending
source text.

### 8. Enforce read-only integration boundaries

The classifier may read Git metadata and existing manifests/receipts and may
write only its own compact projections and complete inventory artifact. It must
not mutate source payloads, existing architecture/QA/runtime/knowledge files,
selectors, database state, Git history, CI, OSS objects, or production. It must
not invoke runtime materialization, release publication, GC, activation,
rollback, or server operations as a side effect. A pre/post source-tree and
payload hash check is part of validation.

## Risks / Trade-offs

- [Risk] A's successor capture is absent or its concrete handoff schema is not
  available. → Keep the change unclaimable/apply-blocked and require the parent
  gate plus exact A locator/digest; never infer a substitute capture.
- [Risk] A large denominator makes a compact projection hide a member. → Keep
  the complete inventory addressable by digest, reconcile every slice, and
  fail closed on missing/duplicate/unresolved members.
- [Risk] A family is aggregated despite one member having different authority
  or privacy. → Require homogeneity across all evidence dimensions and split
  or mark the family unresolved on any conflict.
- [Risk] A directory name, same hash, or candidate release is mistaken for
  authority. → Record authority and lifecycle evidence separately and require
  an existing manifest/selector/receipt; unknown remote state remains
  unresolved.
- [Risk] A classifier tool update changes output while the subject is unchanged.
  → Bind clean tool commit/tree, schema, entry bundle, and frozen inputs; drift
  fails closed and receives a new tool checkpoint.
- [Risk] A payload has several valid roles and the primary class loses a
  release, QA, cache, authorship, or privacy fact. → Apply the fixed
  `F > C > D > E > A > B` priority only after critical evidence is complete,
  and retain every role in orthogonal facets and authority fields. Test D+F,
  B+C, B+E, and A+F explicitly.
- [Risk] Duplicate grouping is mistaken for member disposition or shrinks the
  denominator. → Permit only `qualified | unresolved | justified-excluded` as
  member disposition, keep duplicate groups as member-ID references, and
  reconcile duplicate references separately.
- [Risk] A self-referential index digest prevents reproducibility or lets a
  projection rewrite its own identity. → Hash only the normalized member and
  subject/tool/schema envelope, list only sibling projection/full-inventory
  identities, and bind the index bytes externally.
- [Risk] Private QA, learner, or regulated evidence enters a public projection.
  → Scan the complete package, including the full-inventory header/members,
  evidence locators, and every compact projection; suppress raw text and
  disallow F/unknown public externalization.
- [Trade-off] Full consumer discovery and recovery proof are more expensive
  than hash-based duplicate scans. → Keep duplicate scans observational and
  require the stronger evidence only for explicit future-eligibility output.

## Migration Plan

1. Parent coordination verifies live #1876 closure, `status:archived`, native
   `blockedBy` resolution, and A's immutable successor subject identity/digest.
   Until then, no C claim/apply/implementation/classification run is allowed.
2. After the gate, create a clean classifier/tool checkpoint and record its
   tool commit, tree, schema, and entry-bundle digest. Add only the new
   capability's bounded read-only tool and focused tests; do not alter existing
   release, QA, architecture, or runtime tools.
3. Load A's exact denominator and scope manifest, freeze consumer/provenance
   evidence, and run denominator, member-disposition, primary-class/facet
   precedence, family-homogeneity, dual-identity, package-digest,
   package-wide privacy, and no-mutation fixtures. Any failure remains an
   unresolved or blocked run.
4. Classify the independent A subject artifact, generate the four sibling
   compact projections plus `index.json` and the full-inventory
   locator/digest, and re-open every referenced input before marking the
   package `qualified` or a record `futureEligible`. Reject an index that lists
   or hashes itself.
5. Run existing contract validators in read-only mode, including the QA
   evidence lifecycle check, content/knowledge/runtime release-toolchain check,
   relevant runtime/OSS manifest validators, and architecture denominator or
   fitness readers. These checks validate compatibility; they do not become
   modified requirements of those capabilities.
6. Hand downstream consumers only the exact A subject identity/digest and C
   projection locators. No payload movement, external storage action, runtime
   materialization, selector mutation, deployment, or Issue creation occurs.
   If a later authorized change acts on a record, it must revalidate this
   package and its own authority/retention contract first.

## Open Questions

- A must publish the concrete handoff field names and full-inventory locator
  schema for its immutable successor before implementation can bind the input
  adapter. This is intentionally a hard dependency, not a reason to invent a
  local fallback or to hardcode the proposal-time size observations.

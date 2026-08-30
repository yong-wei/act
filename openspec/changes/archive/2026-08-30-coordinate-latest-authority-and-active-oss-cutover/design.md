## Context

ACT has separate immutable control planes for Engineering Authority selectors and content-addressed Runtime Release v2 lifecycle state. The archived formal-resource capability builds an atomic Canonical binding envelope for one non-selectable Runtime Release candidate, but it deliberately preserves production selectors and allows an invalid resource to remain development-only while unrelated candidates continue. The archived teaching-relation governance likewise permits a formal `PARTIAL` projection after containment closes while prerequisite or association decisions remain pending.

The product outcome now requires a stronger coordinated boundary. At execution time ACT must take the latest complete formal ActKG composite available from the local ActKG checkout, bind the complete logical-resource inventory of the production-active OSS release plus an explicit release delta, close all three teaching-relation families, and expose none of those successors until every selector can move as one user-visible combination.

ActKG remains the Canonical Engineering authority. ACT owns course scope, teaching relations, resource roles, runtime publication, and production activation. The currently known ActKG and Runtime Release identities are observations, not constants in this design.

`gate-formal-runtime-resources-on-canonical-bindings` is archived in the integration baseline. This change starts from its main specs and formal-resource implementation, including its existing two-phase envelope seal, rather than duplicating its proposal or introducing another resource-specific selector.

## Goals / Non-Goals

**Goals:**

- Freeze one execution-time latest, coherent, formally published ActKG composite and prove whether the existing ACT adapter can consume it without a Schema adaptation.
- Preserve every production-active logical resource in the successor denominator while permitting an explicit new or changed resource delta.
- Reuse unchanged resource bindings and teaching decisions through content- and dependency-complete identities.
- Require complete containment, prerequisite, and pedagogical-association dispositions with zero pending decisions for coordinated production selection.
- Seal Authority, locale qualification, Teaching Projection, composed domain-fragment manifest and immutable fragments, formal resource envelope, Runtime Release, domain shards, consumer activation, selectors, predecessor, and rollback evidence into one coordinated candidate identity.
- Provide a stopped-service transaction that either exposes the complete successor combination or restores the complete predecessor combination.

**Non-Goals:**

- Editing or republishing ActKG data from ACT.
- Creating a new Schema adapter when the captured public contract is incompatible.
- Replacing the existing resource atomization, media processing, renderer, or Runtime Release v2 lifecycle authorities.
- Adding runtime review UI, reviewer roles, online decisions, or multi-course governance.
- Requiring a learning resource or a fabricated relation edge for every Canonical Object.
- Automatically activating every later same-Schema ActKG release.
- Executing production deployment or selector activation without a separate explicit authorization.

## Decisions

### 1. Capture the latest complete Authority once per execution

The capture operation refreshes formal remote tags in the configured local ActKG checkout, resolves the latest complete aggregate entrypoint and its declared Module, Terminology, Integration, Coverage, Overlay, and Registry identities, and verifies publication status, hashes, component closure, and source lineage. It materializes only bytes from the captured Git tree and emits an immutable capture receipt.

Compatibility is not inferred from a version string alone. The existing adapter must validate the captured public Schema, contract identity, required members, profiles, and a complete representative parse. A compatible data release continues through the existing adapter. Any incompatible Schema or consumer-contract drift produces `ADAPTATION_REQUIRED`, emits no selectable artifacts, and requires a separate OpenSpec change.

The capture is the execution boundary. A newer release published afterward does not mutate or invalidate the in-flight candidate; it becomes input to a later incremental upgrade. This avoids an unfinishable pipeline that continually chases upstream releases.

### 2. Freeze an active-baseline-plus-explicit-delta resource denominator

The coordinator reads production readiness to identify the exact active Runtime Release v2, then reopens its immutable manifest, active receipt, and logical resource classification. That complete logical-resource set is the continuity baseline. An ordered, declared set of new or changed resources intended for the successor is added as the release delta. Historical releases, rollback-only content, orphaned OSS blobs, arbitrary working-tree files, and already successful bindings cannot determine the denominator.

Every baseline item receives a final successor disposition. Existing teaching resources must remain included and atomically bound unless the course owner records an explicit retirement decision. A technical failure is not retirement and blocks coordinated qualification. A failing new resource remains development-only and is retained in the candidate ledger without entering the successor release.

### 3. Incrementality uses complete semantic cache identities

An unchanged result is reusable only when all governing inputs remain identical. Resource-binding cache identity includes resource and atom identity/content hash, Canonical ID and semantic revision, role, course scope, source identity, qualified pipeline identity, anchor contract, and launcher contract. Teaching-relation decision identity includes the Canonical member and revision, relation family, scope, evidence, candidate or decision hash, and pipeline identity.

The coordinator computes deltas from the captured predecessor and successor identities. It reprocesses only affected atoms, candidate pairs, decisions, domain fragments, and dependent summaries. A Schema-compatible Authority update does not imply that every prior binding is valid, while an Authority version change alone does not justify a full-library rebuild when the referenced Canonical semantics are unchanged.

The first activation of a legacy historical estate may establish a complete machine-verifiable baseline ledger. That one-time operation reopens the frozen source records, atom and binding evidence, and three-family teaching ledgers; it records exceptions as failed-closed technical states. It does not create a per-object human approval queue and it does not turn supporting runtime artifacts into fabricated Canonical bindings. Later releases reuse that baseline only through the sealed cache identity and recompute the semantic delta; no later release repeats a full-library review or rebinding merely because its package version changed.

### 4. Complete teaching governance is a coordinated-production gate

The existing `PARTIAL` state remains truthful for repository candidates and consumers that are not part of this coordinated production selection. It cannot qualify the coordinated product combination.

For every Canonical Object in the sealed target-course active-domain scope, containment closes through one admitted parent or `COURSE_ROOT`; prerequisite and pedagogical association close through admitted relations or evidence-bearing `NO_RELATION`. Every exceptional candidate is approved, rejected, modified, or closed as no relation during repository development. The qualifying receipt requires zero unresolved candidates across all three families. Relation counts are evidence-derived; completeness never imposes an edge quota.

### 5. A one-way identity graph closes every successor and predecessor identity

Before generating dependent artifacts, the coordinator seals an immutable allocation record containing an opaque unique coordination run ID plus the Authority capture, compatibility result, course scope, active resource baseline, explicit delta, policy versions, and implementation identities. The allocation-record hash is the common namespace for inner artifacts. An inner artifact may bind that record and any earlier dependency, but it must never bind the hash of a candidate or active receipt that will be computed from the inner artifact itself.

Generation then follows one direction: Authority capture and allocation record; formal resource envelope; complete Teaching Projection and governed relations; composed domain-fragment manifest and immutable fragments; shards, prerequisite publication, consumer activation, and successor Runtime manifest; coordinated candidate receipt. The allocation and formal resource envelope are sealed before Runtime publication so the immutable Runtime manifest can bind their exact hashes. A non-selectable Runtime stage may increment lifecycle generation, but it does not alter the frozen resource baseline: the candidate separately captures the current lifecycle predecessor for activation fencing. The outer candidate receipt binds at least:

- Authority capture and compatibility receipt;
- exact locale qualification for the captured Authority;
- course active-domain scope and complete Teaching Projection;
- composed domain-fragment manifest, immutable fragment-set identity, and semantic hash;
- formal resource candidate, included, retired, development-only, atom, binding, and qualification hashes;
- successor Runtime Release manifest, materialization, and active-receipt expectations;
- Authority domain-shard catalog and shard set;
- prerequisite and shared-consumer activation identities;
- the complete current predecessor selectors and Runtime lifecycle generation;
- ordered successor selector expectations, transaction implementation identity, rollback plan, and verification policy.

Every component is reopened and hash-verified before the operation can become a qualified non-selectable candidate. A mixed Authority, allocation, scope, resource, locale, Teaching fragment, Runtime Release, shard, or consumer identity invalidates the complete envelope. The candidate receipt is the only content-addressed outer closure over those inner hashes; inner receipts are immutable and are never rewritten to refer back to it.

The selector plane is intentionally split by its real authority boundary. `authority/current.json` is a mutable host-side selector and is journaled directly. Teaching Projection, its composed domain-fragment manifest and immutable fragments, prerequisites, display catalog, domain shards, and consumer activation are static members of an immutable Runtime blob view; they move together when the Runtime lifecycle makes that view active. The candidate captures the complete predecessor matrix, but the pre-Runtime mutation receipt covers only selectors that can truthfully mutate before Runtime activation. The final active receipt separately binds the exact active Runtime identity and its immutable static-selector closure.

### 6. An outer stopped-service journal provides user-visible atomicity

The Authority selectors and Runtime lifecycle cannot be committed through one filesystem write. The design therefore uses one outer exclusive lock and durable write-ahead journal over the existing inner selector and Runtime lifecycle operations.

Before the first mutation, the coordinator stops every graph and runtime consumer, re-reads the complete predecessor, verifies the sealed successor, allocates an opaque unique transaction ID, and seals it with the candidate-receipt hash and exact compensation plan in the journal. The Authority mutation receipt binds that transaction ID and candidate receipt. After that selector re-reads, a `coordinated-runtime-authorization/v1` binds the journal, the Authority receipt, and the future Runtime binding. This is an authorization, not an active receipt: it breaks the otherwise circular requirement that a Runtime become active only after a receipt which itself can only be sealed once that Runtime is active.

The Runtime lifecycle accepts only that exact pre-activation authorization and returns with consumers stopped. The coordinator then re-reads the Runtime active identity, seals the final coordinated active receipt over the journal, Authority mutation receipt, Runtime binding, and Runtime active identity, and writes it before restarting app or workers. It is the commit marker; readiness must reject a coordinated deployment without the matching final receipt.

Any failure before public readiness restores every pointer and lifecycle identity that still matches the journal's expected intermediate state. The coordinator then verifies the predecessor combination before restoring service. It never compensates an unknown or externally changed identity. Candidate generation, deployment, and production activation remain distinct authorizations.

### 7. Same-Schema upgrades generate candidates, not automatic production

Once implemented, future compatible ActKG data releases can reuse the capture, incremental derivation, and selector-generation path without a version-specific adaptation proposal. This is operational reuse, not automatic production promotion. Each candidate still has a frozen identity, complete qualification, explicit activation authorization, and its own transaction receipt.

## Risks / Trade-offs

- [A same-version Schema label hides structural drift] → Compare pinned contract identities and perform a complete adapter validation; fail as `ADAPTATION_REQUIRED` on any unsupported structure.
- [Incremental reuse preserves stale semantics] → Include all semantic, scope, pipeline, source, anchor, and launcher dependencies in cache identity and test targeted invalidation for each component.
- [The active OSS manifest contains files that are not logical resources] → Reuse the formal-resource classifier and require complete resource/non-resource disposition rather than treating every Blob as a resource.
- [A current teaching resource cannot be bound] → Block coordinated qualification until the technical defect is repaired or the course owner explicitly retires it; never convert failure into exclusion.
- [Three-family closure encourages invented relations] → Accept evidence-bearing `NO_RELATION`, retain rejected decisions, and prohibit relation-count quotas.
- [Multiple selector stores cannot be literally atomic] → Keep consumers stopped, use one outer journal and lock, expose a final coordinated receipt as the commit marker, and compensate only identity-matched intermediate state.
- [Immutable receipts form a circular hash dependency] → Allocate stable coordination and transaction IDs before dependent work, prohibit inner-to-outer receipt-hash references, authorize Runtime activation with a pre-active authorization, and seal the final active receipt only after the Runtime identity re-reads.
- [A newer ActKG release appears during execution] → Finish against the captured release and process the newer release as a later incremental candidate.
- [The formal-resource baseline evolves after this proposal] → At implementation capture, pin and revalidate the archived main-spec and implementation identities; reconcile any later compatible evolution before source edits and fail on contract drift.

## Migration Plan

1. Confirm the implementation capture still contains the archived formal-resource and Runtime Release v2 contracts used by this proposal, including the existing two-phase envelope seal, and reconcile any later contract drift before source edits.
2. Implement and test Authority capture, compatibility classification, active Runtime identity capture, denominator freezing, and incremental invalidation without producing selectors.
3. Generate the successor formal-resource envelope and complete Teaching Projection offline; finish all repository review decisions and require zero pending items.
4. Build the allocation record and one-way coordinated candidate identity graph, materialize it in an isolated environment, reopen every identity, and prove deterministic construction without receipt rewriting.
5. Exercise each injected selector failure and full predecessor recovery through a journaled transaction whose inner receipts bind the preallocated transaction ID and whose final active receipt closes over them.
6. Publish a non-selectable candidate and verification receipt. Stop if Schema adaptation is required, an existing production teaching resource remains technically unresolved, teaching governance is incomplete, or any identity drifts.
7. Only after separate explicit deployment authorization and later explicit activation authorization, deploy the already verified application revision, enter the stopped-service transaction, commit the successor combination, verify public readiness and resource continuity, and preserve the predecessor plus transaction evidence. Deployment authorization alone writes no production selector.

## Open Questions

None. Execution-time release identities and exact implementation paths are captured facts, not proposal-time decisions.

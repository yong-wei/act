## 1. Dependency and implementation-surface baseline

- [x] 1.1 Verify that the implementation capture contains the archived formal-resource and Runtime Release v2 main-spec contracts, existing two-phase envelope seal, and no later incompatible drift.
- [x] 1.2 Reconcile any compatible post-proposal contract evolution against these delta specs before source edits and stop for a new spec decision on incompatible drift.
- [x] 1.3 Map the current Authority selectors, Teaching Projection selectors, Runtime Release lifecycle, resource-binding envelope, domain-shard selectors, prerequisite publication, shared-consumer activation, readiness, and rollback code paths before assigning implementation files.
- [x] 1.4 Record the implementation modules, ownership boundaries, existing inner locks, selector write order, and targeted test surfaces in the change handoff without introducing a second plan.

## 2. Execution-time Authority capture and compatibility

- [x] 2.1 Add configuration and validation for the local ActKG checkout and its formal remote without embedding proposal-time release versions or commits.
- [x] 2.2 Resolve the latest complete formally published aggregate and its declared Module, Terminology, Integration, Coverage, Overlay, and Registry closure from refreshed tags.
- [x] 2.3 Materialize Authority inputs from the sealed ActKG Git tree and reject dirty-worktree, missing-tag, hash, publication, lineage, or component-closure drift.
- [x] 2.4 Emit an immutable Authority capture receipt binding the commit, tags, component identities, hashes, publication states, lineage, and public-contract identity.
- [x] 2.5 Validate the captured Schema, consumer contract, required members, profiles, and representative payloads through the existing adapter.
- [x] 2.6 Return `ADAPTATION_REQUIRED` and emit no selector or coordinated candidate when any public-contract input is incompatible.
- [x] 2.7 Add focused tests for compatible capture, dirty-tree rejection, incomplete composite rejection, post-capture upstream release stability, and incompatible-contract fail-closed behavior.

## 3. Active OSS resource continuity denominator

- [x] 3.1 Read production readiness once to resolve the exact active Runtime Release v2 and reopen its immutable manifest and active receipt.
- [ ] 3.2 Reconstruct and hash the complete active logical-resource inventory together with every explicit non-resource disposition.
- [ ] 3.3 Accept an ordered, explicit successor delta of new or changed release inputs and reject undeclared workspace or OSS discovery.
- [ ] 3.4 Emit immutable active-baseline, explicit-delta, and combined-denominator identities with a final disposition for every baseline entry.
- [ ] 3.5 Exclude historical, rollback-only, retained, orphaned, abandoned, and output-discovered objects from denominator construction.
- [ ] 3.6 Add denominator tests covering omission detection, non-resource preservation, declared deltas, historical OSS objects, and active-receipt drift.

## 4. Dependency-complete incremental derivation

- [ ] 4.1 Define and persist the resource-binding cache identity over resource and atom hashes, Canonical identity and revision, role, course scope, source, qualified pipeline, anchor contract, and launcher contract.
- [ ] 4.2 Define and persist the teaching-decision cache identity over Canonical member and revision, relation family, scope, evidence, candidate or decision hash, and qualified pipeline identity.
- [ ] 4.3 Compute predecessor-to-successor deltas and reuse only exact cache-identity matches with their original evidence lineage.
- [ ] 4.4 Recompute affected atoms, binding pairs, teaching candidates, domain fragments, and dependent summaries without an unconditional full-library rebuild.
- [ ] 4.5 Emit reuse, invalidation, recomputation, and summary identities in the coordinated derivation receipt.
- [ ] 4.6 Add targeted invalidation tests for every cache component and prove that unrelated records remain reusable.

## 5. Production resource continuity gate

- [ ] 5.1 Require every retained active-baseline teaching resource to have complete atomic dispositions, at least one valid Canonical binding, and a qualified launch contract.
- [ ] 5.2 Preserve technical failures in the denominator and block coordinated qualification for missing scripts, failed recognition, invalid atomization or alignment, unsafe anchors, weak mappings, or unsupported launchers.
- [ ] 5.3 Add an immutable course-owner retirement decision binding the resource, active Release, reason, evidence, decision identity, and invalidation rules.
- [ ] 5.4 Keep failed new or changed resources development-only and exclude them from the successor formal manifest and product projection without weakening the active baseline.
- [ ] 5.5 Emit included, retired, development-only, failed, atom, binding, launcher, and qualification ledgers whose hashes close over the denominator.
- [ ] 5.6 Add continuity tests proving that technical exclusion cannot remove an active teaching resource and that explicit retirement and failed-new-resource paths remain distinguishable.

## 6. Complete Teaching Projection governance

- [ ] 6.1 Seal the target course active-domain scope against the captured Authority and enumerate every in-scope Canonical member and semantic revision.
- [ ] 6.2 Produce final containment dispositions through one admitted parent or `COURSE_ROOT` for every in-scope member.
- [ ] 6.3 Produce final prerequisite dispositions through admitted relations or evidence-bearing governed `NO_RELATION` decisions for every in-scope member.
- [ ] 6.4 Produce final pedagogical-association dispositions through admitted relations or evidence-bearing governed `NO_RELATION` decisions for every in-scope member.
- [ ] 6.5 Complete all approvals, rejections, modifications, conflicts, and no-relation decisions in repository development with no runtime review role or service.
- [ ] 6.6 Emit a governance receipt with zero unresolved candidates across all three families and evidence-derived admitted, rejected, modified, and no-relation counts.
- [ ] 6.7 Reject `PARTIAL`, empty, stale, fabricated-edge, wrong-scope, wrong-Authority, and wrong-resource-envelope projections at the coordinated production gate.
- [ ] 6.8 Add completeness and mismatch tests while preserving truthful `PARTIAL` projections for independently permitted non-coordinated consumers.

## 7. Coordinated candidate envelope

- [ ] 7.1 Seal an immutable allocation record with an opaque unique coordination run ID, Authority capture, compatibility, course scope, resource denominator, policy versions, and implementation identities before generating dependent artifacts.
- [ ] 7.2 Make each inner artifact bind only the allocation-record hash and earlier immutable dependencies, never an outer candidate or active receipt hash.
- [ ] 7.3 Define the outer coordinated candidate receipt over locale qualification, complete Teaching Projection, formal resource envelope, successor Runtime Release, domain shards, prerequisite publication, shared-consumer activation, predecessor state, selector expectations, transaction implementation, rollback plan, and verification policy.
- [ ] 7.4 Reopen and hash-verify every referenced artifact before coordinated qualification and reject any cross-envelope identity mismatch.
- [ ] 7.5 Bind the complete predecessor graph selectors and Runtime lifecycle generation together with the ordered successor expectations.
- [ ] 7.6 Emit one immutable non-selectable coordinated candidate and receipt without writing any production selector.
- [ ] 7.7 Add deterministic construction tests proving one-way identity closure without receipt rewriting, plus mixed-identity, missing-predecessor, tampering, and absent-activation-authority cases.

## 8. Stopped-service coordinated transaction and rollback

- [ ] 8.1 Implement one outer exclusive lock and durable write-ahead journal over the existing Authority selector and Runtime lifecycle operations.
- [ ] 8.2 Stop and verify every graph, application, worker, and Runtime consumer before re-reading the predecessor and performing the first mutation.
- [ ] 8.3 Allocate an opaque unique transaction ID and record it with the candidate-receipt hash, exact predecessor identities, expected intermediate identities, ordered mutations, and compensation actions before mutation.
- [ ] 8.4 Apply each selector and Runtime lifecycle mutation only when the current identity matches the journal's expected state.
- [ ] 8.5 Make every inner selector and Runtime mutation receipt bind the transaction ID and candidate receipt without referring to the later final active receipt.
- [ ] 8.6 Write the outer coordinated active receipt over the journal, candidate receipt, committed selector hashes, and inner mutation-receipt hashes only after every successor identity reopens exactly.
- [ ] 8.7 Expose readiness only from the valid outer active receipt and keep consumers stopped until it closes over the complete successor.
- [ ] 8.8 Restore the complete identity-matched predecessor combination on any pre-readiness failure and verify it before consumers restart.
- [ ] 8.9 Fail closed without overwriting unknown external state when compensation encounters an identity outside the journaled predecessor or intermediate states.
- [ ] 8.10 Protect every predecessor, successor, rollback, and journal-reachable Runtime Release from garbage collection until transaction evidence permits release.
- [ ] 8.11 Add failure-injection tests at every selector, Runtime lifecycle, receipt, readiness, restart, and compensation boundary.

## 9. Runtime, readiness, and consumer integration

- [ ] 9.1 Extend the successor Runtime Release v2 manifest and materialization receipt to bind the resource denominator, formal binding envelope, Authority, complete Teaching Projection, shards, prerequisite publication, shared-consumer activation, coordination allocation record, and predecessor combination.
- [ ] 9.2 Make the Runtime active receipt bind the preallocated transaction ID and candidate receipt, and make the later outer active receipt bind that immutable Runtime receipt hash.
- [ ] 9.3 Make ordinary Runtime lifecycle activation reject a successor that lacks the matching committed coordinated graph receipt.
- [ ] 9.4 Project readiness, media signing, node resource indicators, and teaching consumers only from the committed coherent combination.
- [ ] 9.5 Verify that same-Schema later releases create distinct non-selectable captures and candidates without mutating an in-flight or active combination.
- [ ] 9.6 Add integration tests for acyclic receipt construction, coherent successor readiness, mismatched graph and Runtime identities, rollback after Runtime mutation, and newer non-active candidates.

## 10. Qualification, publication, and delivery

- [ ] 10.1 Run focused Authority capture, denominator, incremental cache, resource continuity, Teaching Projection, envelope, transaction, rollback, and Runtime integration tests.
- [ ] 10.2 Run the affected Runtime Release v2, teaching-governance, selector, shard, data-governance, readiness, and resource-launch domain suites.
- [ ] 10.3 Run repository type checking, linting, production build, and the final intended-revision verification gates.
- [ ] 10.4 Validate this OpenSpec change and the resulting main specs in strict mode after implementation.
- [ ] 10.5 Publish only the immutable non-selectable coordinated candidate, receipts, review evidence, and rollback evidence under implementation authority.
- [ ] 10.6 Require two independent explicit authorities for production deployment and later production activation; prove that deployment authorization without activation authorization stops before service shutdown or any production selector mutation.
- [ ] 10.7 Record the separately authorized activation transaction result without treating candidate completion or deployment completion as activation authority.

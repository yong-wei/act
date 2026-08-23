## Context

The active Authority domain shards currently consume no Teaching Projection and therefore expose zero containment, prerequisite, or pedagogical-association relations. A separate runtime projection contains four prerequisites, but its identity does not match the active Authority envelope and it cannot be merged into the active shards. Resource bindings in that projection are not object-to-object teaching relations.

The 2026-07-27 decision that an ActKG Teaching Projection would ultimately own these relations is superseded by `docs/grill/20260822-am/adr/20260822-make-act-authoritative-for-canonical-teaching-relations.md`. ACT permanently owns course teaching semantics; ActKG remains authoritative for Canonical identities and engineering facts.

## Goals / Non-Goals

**Goals:**

- Govern ACT-owned containment, prerequisite, and pedagogical-association relations over the exact course active-domain scope.
- Admit individually valid automatic results from qualified pipeline versions while routing exceptional items to repository review artifacts.
- Publish an honest immutable `PARTIAL` projection once the complete containment parent/root skeleton is closed.
- Deliver only exact-identity published relations through bounded active domain shards.
- Preserve deterministic lineage, replay, rollback, and independent Engineering Authority availability.

**Non-Goals:**

- Rewriting, copying, or relabeling ActKG engineering relations.
- Requiring a resource binding before a Canonical Object enters relation governance.
- Adding an online review page, API, database workflow, system role, entitlement, or multi-teacher collaboration.
- Governing formal resource atoms or Runtime Release v2 resource admission.
- Implementing the Force Graph canvas or a new label authority.

## Decisions

### 1. The denominator is a sealed active-domain scope

For one course and exact Authority envelope, the relation builder derives `D`: every real Canonical Object selected into the course's formal active-domain shards. The domain catalog's circular navigation projections are excluded. Resource presence, current browser loading, labels, and engineering relation degree do not affect membership.

The sorted Canonical ID set, course identity, Authority identity, active-domain catalog/selection digest, and contract version form an immutable scope hash. A change to any member or identity creates a new governance scope; counts or labels are not used to carry decisions across scopes.

### 2. Every member has one disposition per teaching family

Each `(scopeHash, canonicalId, family)` is represented in machine-readable governance state.

- Containment closes only through one valid published parent relation or explicit `COURSE_ROOT` disposition.
- Prerequisite and association close through admitted published relations or an explicit governed no-relation disposition.
- Low-confidence, weak-evidence, identity-drifted, direction-conflicted, cyclic, or otherwise invalid candidates remain `PENDING_REVIEW`; they are never converted automatically to no-relation.

An already valid disposition may remain published while an additional suspicious candidate for the same member/family stays pending. Pending candidates do not erase valid facts.

### 3. Pipeline qualification and item admission are separate gates

Each generator version/configuration is qualified on versioned representative gold/holdout data covering all relation families, course domains, Chinese terminology, directions, and structural cases. The qualification artifact records the frozen balanced precision/recall policy and measured results. Thresholds are chosen after the representative gold data exists, not invented in this design.

Even a qualified pipeline may publish only an item that passes its family-specific identity, evidence, confidence, direction, and structure checks. Containment and prerequisite reject self-loops and illegal cycles; association uses its own symmetry/direction contract and is not forced into a directed-acyclic model.

### 4. Repository JSON/JSONL is the only human decision authority

Versioned candidate, decision, and review-pack manifest artifacts retain the original automatic result, exact Authority/course/scope inputs, pipeline version/configuration, evidence hashes, confidence, direction, strength, conflicts, decision, reviewer identity, and decision time. A decision may approve, reject, modify, or defer. Generated Markdown is for reading only and cannot be parsed as authority.

No candidate, decision, pending count, confidence, reviewer, pack path, or mutation descriptor is served to the ordinary application.

### 5. `PARTIAL` is a formal truthful publication state

The immutable governance/projection receipt records the real denominator, disposition counts, published edge counts, pending counts per family, and review-pack hash. For a non-empty scope, the first relation-bearing formal projection may publish only when containment is 100% closed by a valid parent relation or `COURSE_ROOT` for every member. Prerequisite and association work may remain pending, so the projection is explicitly `PARTIAL` and never represented as complete.

An empty projection remains legal for an actually empty or Engineering-only consumer scope. It cannot satisfy publication for a non-empty active-domain scope or replace the containment gate.

### 6. Active shards require one exact composite identity

Every teaching-bearing shard binds the same Authority envelope, course active-domain scope hash, relation projection ID/hash, and published relation vocabulary. A projection mismatch omits the entire teaching layer; the shard service never merges the unmatched four-relation projection or manufactures an empty-complete state.

Runtime responses contain only published containment, prerequisite, and association edges. Engineering nodes and requested Engineering relation families remain available when no matching teaching projection exists.

### 7. Locale qualification is consumed, not recreated

The coordinated release requires the existing locale change's immutable qualification receipt for the exact Authority envelope. This change uses stable Canonical identity for relation governance and does not write Chinese labels, fall back to English, or create a parallel localization gate.

### 8. Scoped KAQ fallback retires only against admitted ACT relations

Existing reviewed KAQ knowledge-to-knowledge relations may remain a scoped fallback while no matching ACT Teaching Projection relation is formal. If an ACT candidate conflicts with that fallback, the conflict is an item-level exception and cannot auto-publish; a governed repository decision must resolve it. The corresponding KAQ fallback retires before the admitted ACT relation becomes active for planning. ActKG Engineering relations are never a party to this retirement decision.

## Risks / Trade-offs

- [A broad Authority release could create unnecessary teaching work] → Derive the denominator only from the sealed course active-domain selection, not all ActKG members.
- [Automatic admission could publish plausible but wrong relations] → Require both pipeline qualification and item-level gates; exclude every exceptional item to the review pack.
- [A few pending candidates could block all useful edges] → Permit `PARTIAL` publication after the full containment skeleton closes, while keeping prerequisite and association counts honest.
- [Partial status could leak internal governance detail] → Keep coverage and pending data in repository/release governance receipts; runtime returns only published edges and does not claim completeness.
- [Old and new projection identities could be combined accidentally] → Verify the complete composite envelope before materialization and invalidate teaching-bearing caches on projection or scope drift.

## Migration Plan

1. Add scope, family-disposition, pipeline-qualification, candidate, decision, review-pack, and relation-receipt contracts with drift and invalid-structure fixtures.
2. Derive the real target scope from the frozen Authority and active-domain selection and create representative gold/holdout artifacts.
3. Run automatic generation for all three families, admit individually valid results, and write exceptional items to repository review packs.
4. Resolve any ACT-versus-KAQ fallback conflicts in the repository decision artifacts and prepare deterministic KAQ retirement records.
5. Complete containment parent/root dispositions for every scope member and produce a truthful immutable `PARTIAL` projection with exact counts and hashes.
6. Materialize exact-matching bounded domain shards and verify the unmatched legacy four-edge projection cannot enter them.
7. Preserve the prior selected teaching combination until a separate authorized activation; Engineering Authority remains usable throughout.

Rollback selects a prior immutable Teaching Projection only when its Authority and scope identities still match. Otherwise the teaching layer is omitted while Engineering exploration remains available.

## Open Questions

None. Numeric qualification and item thresholds are produced and frozen only after representative gold/holdout measurement, as required by the governance contract.

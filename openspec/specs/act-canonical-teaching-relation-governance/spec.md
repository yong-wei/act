# act-canonical-teaching-relation-governance Specification

## Purpose
TBD - created by archiving change establish-act-owned-canonical-teaching-relations. Update Purpose after archive.
## Requirements
### Requirement: ACT owns Canonical teaching relations without rewriting Engineering Authority
ACT SHALL author, qualify, decide, version, and publish Canonical Object-to-Object containment, prerequisite, and pedagogical-association relations for the course. ActKG SHALL remain authoritative for Canonical identities, Engineering objects, Engineering relations, and source evidence. An Engineering predicate or edge MAY be cited as candidate evidence but MUST NOT be relabeled, copied, or activated as an ACT teaching relation without ACT admission.

#### Scenario: Engineering relation resembles a prerequisite
- **WHEN** an Engineering Authority relation has compatible endpoints or wording
- **THEN** it SHALL remain an Engineering relation and MAY only contribute bounded candidate evidence
- **AND** no teaching relation SHALL publish without the ACT relation pipeline and item gates

#### Scenario: Relation input belongs to another Authority envelope
- **WHEN** authoring, evidence, or a decision is bound to a different Authority identity or scope
- **THEN** the candidate and every derived projection SHALL fail before publication or activation
- **AND** the current ACT relation authority SHALL remain unchanged

### Requirement: Teaching relation scope and family dispositions are active-domain complete
The governance scope SHALL deterministically enumerate every real Canonical Object in the target course's sealed active-domain selection under one exact Authority envelope. It SHALL bind the ordered member set, course, active-domain selection, Authority identity, and contract version in an immutable scope hash. Every member SHALL have a disposition for containment, prerequisite, and pedagogical association. Root navigation projections and resource presence MUST NOT alter membership.

#### Scenario: Active-domain member has no resource
- **WHEN** a Canonical Object belongs to the sealed active-domain scope but has no bound learning resource
- **THEN** it SHALL remain in all three relation-family denominators
- **AND** the missing resource SHALL neither remove the node nor close a relation disposition

#### Scenario: Domain circle is rendered
- **WHEN** the root catalog emits a circular domain navigation entry
- **THEN** that projection SHALL NOT enter the Canonical member set or require any relation-family disposition

#### Scenario: Authority or active-domain selection changes
- **WHEN** the exact Authority envelope, course, active-domain selection, or member set changes
- **THEN** the system SHALL derive a new scope hash and a new immutable relation assessment
- **AND** it SHALL NOT reuse the prior denominator or decisions by count, label, or position

### Requirement: Every relation family uses explicit closure semantics
Containment for each scope member SHALL close only through one admitted parent relation or an explicit `COURSE_ROOT` disposition. Prerequisite and pedagogical association SHALL close through admitted relations or an explicit governed no-relation disposition. An exceptional or unresolved candidate MUST remain pending and MUST NOT be converted automatically into no-relation.

#### Scenario: Containment member has no parent
- **WHEN** an in-scope member is not the explicit course root and has no admitted containment parent
- **THEN** its containment disposition SHALL remain incomplete
- **AND** a non-empty relation projection SHALL fail the containment skeleton gate

#### Scenario: Prerequisite is governed as unnecessary
- **WHEN** evidence supports an explicit no-prerequisite disposition for one member and scope
- **THEN** that member's prerequisite family MAY close without creating an edge
- **AND** the no-relation decision SHALL retain its evidence and scope identity

#### Scenario: Additional suspicious candidate exists
- **WHEN** a member already has a valid published disposition and another candidate is low-confidence or conflicted
- **THEN** the valid disposition MAY remain published while the additional candidate stays pending
- **AND** the pending item SHALL neither create an edge nor erase the valid disposition

### Requirement: Automatic admission requires qualified pipeline and valid item
An automatic relation pipeline version SHALL qualify only against frozen representative gold/holdout artifacts and a recorded balanced precision/recall policy. A candidate MAY publish automatically only when the exact pipeline version/configuration has a successful qualification receipt and the item independently passes identity, evidence, confidence, direction, and family-specific structural gates.

#### Scenario: Qualified pipeline emits an invalid item
- **WHEN** a qualified pipeline emits a low-confidence, weak-evidence, direction-conflicted, self-looping, cyclic, or otherwise structurally invalid candidate
- **THEN** that item SHALL be excluded from the projection and written to the review pack
- **AND** other individually valid results MAY continue to publication

#### Scenario: Pipeline version is not qualified
- **WHEN** a model, prompt, configuration, mapping, or algorithm version lacks a matching successful qualification receipt
- **THEN** none of its generated candidates SHALL auto-publish
- **AND** a prior qualified version's receipt SHALL NOT qualify the changed version

#### Scenario: Association is evaluated
- **WHEN** a pedagogical-association candidate is checked
- **THEN** it SHALL use the registered association direction or symmetry rules
- **AND** it SHALL NOT be rejected merely for violating a directed-acyclic constraint that applies only to containment or prerequisite

### Requirement: Review packs are immutable machine-readable governance artifacts
Exceptional candidates and human decisions SHALL be stored in versioned JSON/JSONL under a hash-bound manifest. Each item SHALL retain the Authority, course, scope, pipeline version/configuration, input and evidence hashes, original candidate, confidence, direction, strength, conflicts, decision, reviewer identity, and decision time. Markdown reports SHALL be derived from the machine-readable artifacts and MUST NOT be an authority source.

#### Scenario: Reviewer decides a candidate in the repository
- **WHEN** the course owner approves, rejects, modifies, or defers an exceptional candidate
- **THEN** a versioned decision SHALL preserve the original candidate and evidence lineage
- **AND** rebuilding from the same machine-readable inputs SHALL produce the same admitted result and review-pack hash

#### Scenario: Deferred candidates coexist with valid edges
- **WHEN** valid published relations coexist with deferred candidates
- **THEN** the pack SHALL retain those candidates and its immutable manifest hash
- **AND** no pending candidate SHALL become a runtime edge or automatic no-relation disposition

#### Scenario: Normal runtime requests a domain
- **WHEN** a product shard or node detail is returned
- **THEN** it SHALL contain no review-pack path, candidate payload, confidence, reviewer, decision, pending count, or mutation descriptor
- **AND** no runtime review route, role, entitlement, or write API SHALL be introduced

### Requirement: Partial relation publication is truthful and containment-complete
A non-empty formal relation projection SHALL publish only after every member's containment family has one admitted parent relation or explicit `COURSE_ROOT` disposition. Prerequisite and association work MAY remain pending, but the immutable governance receipt SHALL label the projection `PARTIAL` and bind the real member denominator, per-family dispositions, published edge counts, pending counts, and review-pack hash. It MUST NOT claim complete coverage.

#### Scenario: Containment is complete and other families are partial
- **WHEN** every in-scope member has a valid parent or course-root disposition while prerequisite or association items remain pending
- **THEN** the relation projection MAY publish as `PARTIAL` if all other gates pass
- **AND** runtime consumers SHALL receive only admitted edges while governance receipts retain the true incomplete counts

#### Scenario: Containment is incomplete
- **WHEN** any member of a non-empty scope lacks both an admitted parent and course-root disposition
- **THEN** the new relation projection SHALL fail closed without replacing the prior selection
- **AND** zero or near-zero relations SHALL NOT satisfy the formal product gate

#### Scenario: Scope is actually empty
- **WHEN** a sealed course or Engineering-only consumer scope contains no Canonical members requiring teaching relations
- **THEN** an empty deterministic projection MAY be recorded for that scope
- **AND** it SHALL NOT be reused as success evidence for a non-empty active-domain scope

### Requirement: Coordinated production selection requires three-family closure
A Teaching Projection used by the coordinated Authority and active OSS resource cutover SHALL have a final disposition for containment, prerequisite, and pedagogical association for every Canonical Object in the exact sealed course active-domain scope. Containment SHALL close through an admitted parent or `COURSE_ROOT`; prerequisite and pedagogical association SHALL close through admitted relations or evidence-bearing governed no-relation decisions. The qualifying governance receipt MUST report zero unresolved candidates in every family. A truthful `PARTIAL` projection MAY remain as a repository or independently consumed artifact, but MUST NOT satisfy the coordinated production gate.

#### Scenario: Every family has final dispositions
- **WHEN** every in-scope member has final containment, prerequisite, and pedagogical-association dispositions and the review pack contains no unresolved candidate
- **THEN** governance MAY qualify the Teaching Projection as complete for coordinated production selection
- **AND** the receipt SHALL preserve admitted relation, no-relation, rejected, and modified decision counts without imposing an edge quota

#### Scenario: No relation is supported by evidence
- **WHEN** evidence and review conclude that one member requires no relation in a family
- **THEN** an immutable governed no-relation decision SHALL close that member and family without creating an edge
- **AND** the system MUST NOT fabricate a relation to satisfy completeness

#### Scenario: Any candidate remains unresolved
- **WHEN** any containment, prerequisite, or pedagogical-association candidate remains pending, deferred, conflicted, or otherwise undecided
- **THEN** the projection SHALL NOT qualify for coordinated production selection
- **AND** an existing `PARTIAL` label or complete containment skeleton SHALL NOT bypass the gate

### Requirement: Relation decisions are applied into immutable final ledgers
For the captured active-domain scope, the governance workflow SHALL persist the candidate set, evidence registry, course-owner decision, and applied final disposition for every `canonicalId × relation-family` row. A decision applier SHALL validate candidate and evidence references and SHALL materialize accepted relations, rejected candidates, replacements, or evidence-backed `NO_RELATION` dispositions. Caller-provided completion flags, arbitrary evidence strings, or candidate counts SHALL NOT create final closure.

#### Scenario: Course owner accepts or replaces a candidate
- **WHEN** a repository decision accepts a qualified candidate or replaces it with an evidence-supported teaching relation
- **THEN** the applier SHALL materialize the exact final relation and retain the original candidate, evidence, decision, and semantic revisions
- **AND** the relation SHALL be active only inside the non-selectable remediation candidate

#### Scenario: Course owner records no relation
- **WHEN** a repository decision records `NO_RELATION` for a scoped member and family
- **THEN** the disposition SHALL cite frozen course evidence explaining why that teaching relation is absent
- **AND** the applier SHALL reject missing, drifting, or unbound evidence references

### Requirement: Qualified relations and problematic relations receive distinct final outcomes
Evidence-qualified automatic relations SHALL receive valid candidate dispositions, while low-confidence, conflicting, unsupported, or otherwise problematic relations SHALL be excluded from candidate activation and preserved in immutable repository review packs for course-owner adjudication. Review and adjudication SHALL finish during development and SHALL NOT require a runtime role, service, or student/teacher application surface.

#### Scenario: Relation passes automatic qualification
- **WHEN** the exact qualified pipeline and item-level gates pass against the captured Authority and course evidence
- **THEN** the relation MAY receive a final included disposition without per-item manual review
- **AND** its pipeline, input, evidence, confidence, and output identities SHALL remain auditable

#### Scenario: Relation is low-confidence or problematic
- **WHEN** a relation fails automatic admission or has conflicting, incomplete, or exceptional evidence
- **THEN** it SHALL be absent from candidate-active relations and present in an immutable review pack
- **AND** a course-owner decision SHALL resolve it before the remediation projection can become complete

### Requirement: Remediation teaching closure is computed over all three families
The remediation workflow SHALL derive the exact active-domain membership from the sealed Authority capture and SHALL compute teaching closure only from reopened containment, prerequisite, and pedagogical-association final ledgers. `COMPLETE` SHALL be derived when every scoped member has exactly one valid final disposition in every family and unresolved count is zero; it SHALL NOT be accepted as caller input.

#### Scenario: Three-family ledgers are disposition-complete
- **WHEN** membership, candidates, decisions, evidence, and final dispositions reopen under the same capture and every family conserves the full scope with zero unresolved rows
- **THEN** the validator SHALL derive `COMPLETE` and seal a closure receipt over the exact ledgers
- **AND** only included relations SHALL enter the remediation Teaching Projection

#### Scenario: One scoped row is missing or pending
- **WHEN** any member-family row is missing, duplicated, pending, drifting, or bound to another capture
- **THEN** the validator SHALL refuse `COMPLETE`
- **AND** no complete Teaching Projection or downstream handoff SHALL be sealed

#### Scenario: Engineering relation is relabeled as teaching evidence
- **WHEN** a workflow attempts to obtain closure by copying or renaming an Engineering Authority relation without ACT teaching evidence and disposition
- **THEN** the candidate SHALL fail governance validation
- **AND** the upstream Engineering Authority SHALL remain unchanged


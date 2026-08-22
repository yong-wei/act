## ADDED Requirements

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

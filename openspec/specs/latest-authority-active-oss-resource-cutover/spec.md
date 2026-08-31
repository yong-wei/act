# latest-authority-active-oss-resource-cutover Specification

## Purpose
TBD - created by archiving change coordinate-latest-authority-and-active-oss-cutover. Update Purpose after archive.
## Requirements
### Requirement: Execution captures one latest compatible formal Authority
The system SHALL refresh the configured local ActKG checkout's formal remote tags at execution start, resolve the latest complete published aggregate and its declared Module, Terminology, Integration, Coverage, Overlay, and Registry identities, and seal their Git commit, tags, hashes, publication states, component closure, and public-contract identity in one immutable Authority capture receipt. The system MUST materialize captured inputs from the sealed Git tree and MUST NOT use dirty working-tree bytes. It SHALL classify the capture as compatible only when the existing ACT adapter validates the exact public Schema, contract, required members, profiles, and representative payloads.

#### Scenario: Latest formal composite is compatible
- **WHEN** the refreshed latest complete aggregate and all declared components pass publication, hash, closure, Schema, contract, and adapter validation
- **THEN** the system SHALL seal one immutable Authority capture and MAY generate same-Schema successor candidates without a version-specific adaptation change

#### Scenario: Public contract is incompatible
- **WHEN** the captured Schema, contract identity, required member, profile, or representative payload is unsupported by the existing adapter
- **THEN** the system SHALL classify the capture `ADAPTATION_REQUIRED`
- **AND** it SHALL generate no selector or activatable coordinated candidate until a separate adaptation change is completed

#### Scenario: A newer release appears after capture
- **WHEN** ActKG publishes a later formal release after the Authority capture receipt is sealed
- **THEN** the in-flight candidate SHALL remain bound to the sealed capture
- **AND** the later release SHALL require a new incremental capture rather than mutating the existing candidate

### Requirement: Successor resources use an active baseline plus explicit delta
The system SHALL derive the successor resource denominator from every logical resource and explicit non-resource disposition in the production-active Runtime Release v2, plus an ordered set of explicitly declared new or changed release inputs. It MUST bind the active Release ID, manifest identity, active receipt, logical inventory hash, explicit delta hash, and combined denominator hash. Historical or rollback-only releases, orphaned OSS objects, working-directory scans, successful output scans, and bindings already found MUST NOT change that denominator.

#### Scenario: Active OSS baseline is captured
- **WHEN** production readiness identifies one active Runtime Release whose manifest and active receipt revalidate exactly
- **THEN** every logical inventory entry and non-resource disposition from that release SHALL enter the immutable continuity baseline
- **AND** omission of any baseline entry SHALL fail coordinated candidate qualification

#### Scenario: New resources are declared
- **WHEN** the successor includes explicitly declared new or changed resources beyond the active baseline
- **THEN** those inputs SHALL enter the ordered release delta and combined denominator
- **AND** no undeclared workspace or OSS object SHALL enter by discovery

#### Scenario: Historical objects remain in OSS
- **WHEN** blobs or immutable manifests remain reachable only from historical, rollback, retained, or abandoned releases
- **THEN** their presence SHALL NOT add logical resources to the successor denominator

### Requirement: Resource and teaching derivation is dependency-complete and incremental
The system SHALL reuse a prior resource binding or teaching decision only when its complete semantic cache identity remains unchanged. A resource-binding identity MUST include resource and atom identities and content hashes, Canonical ID and semantic revision, role, course scope, source, qualified pipeline, anchor contract, and launcher contract. A teaching-decision identity MUST include Canonical member and revision, relation family, scope, evidence, candidate or decision hash, and qualified pipeline identity. The system SHALL recompute only the affected records and their dependent summaries and MUST NOT trigger an unconditional full-library rebind solely because an Authority or Runtime Release version changed. A one-time historical baseline closure MAY reopen and bind all frozen source evidence automatically, but it MUST produce machine-verifiable exception artifacts instead of a mass human approval queue; later releases SHALL reuse that sealed baseline and process only identity-invalidated deltas.

#### Scenario: All dependency identities are unchanged
- **WHEN** a prior binding or decision has exactly the same complete semantic cache identity under the successor capture
- **THEN** the system SHALL reuse that result with its original evidence lineage
- **AND** the coordinated receipt SHALL record the reused identity

#### Scenario: One resource atom changes
- **WHEN** a resource atom content hash, source, anchor, role, scope, pipeline, or launcher contract changes
- **THEN** the system SHALL invalidate that atom's affected bindings and dependent summaries
- **AND** it SHALL leave unrelated bindings reusable

#### Scenario: Canonical semantics change under the same Schema
- **WHEN** a referenced Canonical Object retains a supported Schema but its identity or semantic revision changes
- **THEN** the system SHALL invalidate only the affected resource pairs and teaching decisions
- **AND** same-Schema compatibility SHALL NOT preserve stale semantic results

### Requirement: Production teaching resources have a continuity gate
Every teaching resource in the active OSS continuity baseline SHALL remain included with complete atomic dispositions and at least one valid Canonical binding unless the course owner records an explicit, evidence-bound retirement decision. A missing script, failed recognition, invalid segmentation or time alignment, unsafe anchor, weak mapping, unsupported launcher, or other technical failure MUST block coordinated qualification and MUST NOT be converted into exclusion or retirement. A failed new resource MAY remain development-only, but MUST NOT enter the successor formal manifest or product projection.

#### Scenario: Existing teaching resource has a technical failure
- **WHEN** any active-baseline teaching resource cannot complete its required atomic binding or safe launch contract
- **THEN** the coordinated candidate SHALL fail qualification
- **AND** the resource SHALL remain in the denominator with its unresolved reason rather than disappearing from the successor

#### Scenario: Course owner retires an existing resource
- **WHEN** the course owner explicitly approves retirement with exact resource, active Release, reason, evidence, decision identity, and invalidation rules
- **THEN** the successor MAY omit that resource while preserving it in the immutable retirement ledger
- **AND** the omission SHALL NOT be represented as a technical binding success

#### Scenario: New resource fails qualification
- **WHEN** a resource in the explicit delta fails source, atom, binding, or launcher qualification
- **THEN** it SHALL remain development-only and SHALL not enter the successor formal manifest
- **AND** the failure SHALL NOT remove or weaken any active-baseline resource

### Requirement: One coordinated envelope closes every product identity
Before generating dependent artifacts, the system SHALL seal an immutable coordination allocation record containing an opaque unique coordination run ID and the Authority capture, compatibility result, sealed course scope, formal resource denominator, policy versions, and implementation identities. Inner artifacts MAY bind the allocation-record hash and earlier dependency hashes, but MUST NOT bind a candidate or active receipt hash that depends on that inner artifact. The allocation and formal binding envelope SHALL be sealed before Runtime publication so the immutable Runtime manifest can bind their exact hashes. A non-selectable Runtime stage MAY advance lifecycle generation without changing the frozen resource denominator; the final candidate SHALL separately bind the re-read current lifecycle predecessor used for Runtime activation. After the formal binding envelope, complete Teaching Projection, composed domain-fragment manifest and immutable fragment set, successor Runtime Release, Authority domain shards, prerequisite publication, and shared consumer activation are immutable, the system SHALL seal one outer coordinated candidate receipt over their exact hashes, matching locale qualification, complete predecessor state, ordered successor selector expectations, transaction implementation, rollback plan, and verification policy. Every referenced artifact MUST be reopened and hash-verified. Any cross-component identity mismatch MUST invalidate the complete coordinated candidate.

#### Scenario: Candidate identity graph is constructed in one direction
- **WHEN** a coordinated candidate is generated from a sealed allocation record
- **THEN** each inner artifact SHALL bind only the allocation record and earlier immutable dependencies
- **AND** the later outer candidate receipt SHALL bind every exact inner artifact hash without rewriting an inner artifact

#### Scenario: All successor identities close
- **WHEN** every referenced artifact reopens with the exact captured Authority, course scope, resource, Runtime Release, shard, locale, teaching, and consumer identities
- **THEN** the system SHALL emit one immutable non-selectable coordinated candidate receipt
- **AND** the receipt SHALL bind the complete predecessor and successor combinations

#### Scenario: One component belongs to another envelope
- **WHEN** a Teaching Projection, composed domain-fragment manifest or fragment set, locale receipt, binding set, Runtime Release, shard, prerequisite publication, consumer activation, or selector expectation references a different Authority, scope, resource denominator, or manifest identity
- **THEN** the complete coordinated candidate SHALL fail before any selector mutation

#### Scenario: Candidate is qualified without activation authority
- **WHEN** a coordinated candidate passes all offline gates but no production activation authorization exists
- **THEN** the system SHALL preserve it as non-selectable
- **AND** it SHALL not write desired, active, Authority, Teaching, shard, prerequisite, consumer, or Runtime selectors

### Requirement: Production selection is one stopped-service recoverable transaction
The system SHALL coordinate all successor Authority and Runtime lifecycle mutations under one outer exclusive lock and durable write-ahead journal while every graph and runtime consumer is stopped. Before mutation, the journal SHALL allocate an opaque unique transaction ID and bind it to the coordinated candidate receipt, exact predecessor, expected intermediate states, and compensation plan. The mutable Authority selector SHALL be journaled directly; Projection, prerequisites, catalog, shards, and consumer activation SHALL move as static members of the activated immutable Runtime view. After the Authority mutation re-reads, the system SHALL seal a `coordinated-runtime-authorization/v1` over the journal, Authority mutation receipt, candidate, and Runtime binding. The Runtime lifecycle MUST require that authorization and return while consumers remain stopped. Only after the exact Runtime active identity re-reads may the system write the final coordinated active receipt over the journal, candidate, committed mutable selectors, Runtime binding, and Runtime active identity. Consumers MUST NOT start until that receipt is valid. A failure before public readiness SHALL restore every identity-matched predecessor component and verify the complete predecessor combination before service resumes; unknown external state MUST remain stopped for explicit recovery.

#### Scenario: Activation identity graph is constructed in one direction
- **WHEN** a stopped-service transaction begins for a qualified candidate
- **THEN** every inner mutation receipt SHALL bind the preallocated transaction ID and candidate receipt without referring to the final active receipt
- **AND** the final active receipt SHALL be created afterward over the exact committed inner receipt and selector hashes

#### Scenario: Complete successor commits
- **WHEN** the predecessor still matches, every mutation succeeds, all successor identities re-read exactly, and the coordinated active receipt is durable
- **THEN** the system MAY start app and workers against the complete successor combination
- **AND** public readiness SHALL report only that coherent combination

#### Scenario: A selector write fails
- **WHEN** any Authority, Teaching, prerequisite, shard, consumer, desired Runtime, active Runtime, or coordinated-receipt mutation fails
- **THEN** consumers SHALL remain stopped while the coordinator restores every identity-matched predecessor component
- **AND** service SHALL resume only after the complete predecessor combination revalidates

#### Scenario: State changes outside the transaction
- **WHEN** any current identity differs from both the journal's expected predecessor and its exact intermediate state
- **THEN** compensation SHALL fail closed without overwriting the unknown state
- **AND** consumers SHALL remain stopped for explicit recovery

### Requirement: Same-Schema candidate generation never grants automatic production authority
The system MAY reuse this candidate-generation path for later Schema-compatible ActKG releases without a version-specific adaptation spec. Each run MUST create a new capture, incremental derivation, coordinated envelope, and qualification receipt. Production deployment and activation SHALL remain separately authorized actions and MUST NOT be triggered by release discovery, candidate completion, or recency alone.

#### Scenario: Later compatible release is discovered
- **WHEN** a later complete formal ActKG release passes the existing compatibility gate
- **THEN** the system MAY generate a new non-selectable coordinated candidate through incremental derivation
- **AND** it SHALL leave production unchanged without explicit activation authorization

#### Scenario: Candidate is newer than production
- **WHEN** a qualified candidate has a later upstream version than the active Authority
- **THEN** version recency alone SHALL NOT authorize deployment or selector mutation


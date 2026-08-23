## Why

The active Authority workspace currently has no consumable teaching relation: its active domain shards carry no Teaching Projection identity, while the separate runtime projection exposes only four prerequisites under a different identity. Teaching order is an ACT course-authoring responsibility, so ACT needs a durable, evidence-backed relation authority that can publish valid results incrementally without treating Engineering Authority relations as teaching facts or waiting for an external graph project.

## What Changes

- Establish ACT as the permanent authority for Canonical Object-to-Object teaching relations, including containment, prerequisite, and pedagogical association. ActKG remains authoritative for Canonical identities, engineering objects, engineering relations, and source evidence.
- Derive the governance denominator dynamically from all real Canonical Objects in the target course's active-domain shards. Root domain navigation projections are excluded; resource presence does not determine whether a node is in scope.
- Require a disposition for each in-scope node and each teaching family. Containment must reach 100% disposition as a reviewed parent relation or explicit course-root decision before the first formal `PARTIAL` projection; prerequisite and association may remain incomplete with honest counts.
- **BREAKING** Replace the current “every published candidate requires an author decision and candidates never auto-publish” rule with automatic-first generation: a qualified pipeline may directly publish an individually valid result, while low-confidence, weak-evidence, direction-conflicted, cyclic, or otherwise invalid results remain excluded in a repository review pack.
- Store candidates and human decisions in versioned JSON/JSONL bound to Authority/course inputs, evidence hashes, pipeline version/configuration, confidence, direction, strength, conflict state, reviewer, and decision time. Markdown is generated for reading and is never an authority source.
- Allow valid relations to activate in a truthful `PARTIAL` Teaching Projection while unresolved candidates remain in the repository. Runtime receives only published relations and does not expose review state, pending counts, or review controls.
- Qualify every automatic pipeline version against representative, versioned gold/holdout data with a balanced precision/recall criterion; individual failures remain fail-closed even when the pipeline qualifies overall.
- Bind the composed Teaching Projection and active domain shards to the exact target Authority envelope and expose real coverage/edge/pending/review-pack hashes only in repository governance artifacts and release receipts.

## Capabilities

### New Capabilities

- `act-canonical-teaching-relation-governance`: Defines ACT-owned containment, prerequisite, and association authoring; automatic qualification; machine-readable review packs; per-node family dispositions; partial publication; and immutable evidence lineage.

### Modified Capabilities

- `act-teaching-projection`: Replaces the resource-selected denominator and mandatory per-edge author decision with the target active-domain denominator, automatic-first admission, truthful `PARTIAL` status, and a 100% containment disposition gate.
- `course-knowledge-coverage-overlay`: Makes the course active-domain selection and every included Canonical Object's three-family disposition the governed denominator instead of limiting teaching decisions to resource/core-node references.
- `authority-domain-shard-delivery`: Requires active shards to consume the exact matching ACT relation projection, deliver published containment/prerequisite/association edges, and keep repository review state out of runtime responses.
- `autocontrol-kaq-graph-catalog`: Replaces the obsolete ActKG-teaching takeover path with one-time retirement of a conflicting scoped KAQ fallback only after the ACT Teaching Projection relation is admitted.
- `canonical-knowledge-kaq-binding`: Defines conflicts as ACT Teaching Projection versus scoped KAQ fallback, never ActKG engineering relations versus KAQ, and forbids joint activation.
- `adaptive-learning-path-planning`: Makes a matching formal ACT Teaching Projection, rather than an obsolete ActKG Teaching Projection, the only Canonical teaching-relation input that can unlock replanning.

## Impact

- Affects Teaching Projection contracts/builders/gates/domain fragments/prerequisite publication, course coverage authoring, candidate and decision artifacts, active domain-shard materialization, activation manifests, release receipts, tests, and governance reports.
- Does not mutate ActKG data, reinterpret engineering predicates, add an online review API, add a system role or entitlement, or require every Canonical Object to have a learning resource.
- Final coordinated product acceptance also consumes the immutable complete-Chinese locale qualification from `admit-complete-authority-locales-and-add-language-switching`; this change does not create a parallel label authority.
- The accepted authority decision is recorded in `docs/grill/20260822-am/adr/20260822-make-act-authoritative-for-canonical-teaching-relations.md`.

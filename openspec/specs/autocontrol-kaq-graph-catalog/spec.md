# autocontrol-kaq-graph-catalog Specification

## Purpose
Define the initial automatic-control K/A/Q objective and graph-node catalog used by later graph center, learner overlay, class overlay, and resource coverage features. The catalog anchors core control knowledge, capability, and quality nodes to existing runtime knowledge ids where possible, while recording partial coverage when the runtime graph lacks a precise canonical node.
## Requirements
### Requirement: Automatic-control K/A/Q seed catalog is validated
The system SHALL provide an initial automatic-control seed catalog for K/A/Q objectives and graph nodes.

#### Scenario: Seed catalog is loaded
- **WHEN** the automatic-control seed catalog is loaded
- **THEN** it SHALL include knowledge, capability, and quality graph nodes
- **AND** active nodes SHALL pass the K/A/Q objective and graph schema validation contracts.

### Requirement: Seed knowledge bindings reuse existing runtime nodes
The seed catalog SHALL reuse existing runtime knowledge-node ids where an appropriate node exists.

#### Scenario: Knowledge seed node is bound
- **WHEN** a seed knowledge node represents a concept already present in the runtime knowledge graph
- **THEN** the seed SHALL reference the existing runtime knowledge-node id
- **AND** it SHALL not create a parallel id for the same canonical teaching concept.

### Requirement: Capability and quality seed nodes are evidence-aware
The seed catalog SHALL make capability and quality nodes usable by later diagnosis, path planning, and graph overlays.

#### Scenario: Capability seed node is active
- **WHEN** a capability seed node is active
- **THEN** it SHALL bind to at least one knowledge node and declare observable evidence types.

#### Scenario: Quality seed node is active
- **WHEN** a quality seed node is active
- **THEN** it SHALL declare scenario, observable behaviors, rubric levels, and evidence sources.

### Requirement: KAQ catalog validates Canonical binding readiness
The KAQ catalog MUST validate that each knowledge role intended for post-cutover formal consumption has a reviewed binding within the current aggregate CourseCoverage and pinned aggregate ReleaseSet.

#### Scenario: Binding is stale
- **WHEN** a Canonical revision or Release no longer matches the catalog binding
- **THEN** the catalog SHALL mark the role not ready and block dependent cutover gates

#### Scenario: Catalog is ready before cutover
- **WHEN** all intended roles pass Canonical readiness while Legacy remains active
- **THEN** the catalog SHALL expose readiness to migration review without changing the formal consumer selector

### Requirement: Teaching relation conflicts are auditable
The catalog SHALL record one-time governed conflict decisions and retirement status when a formally admissible ACT Teaching Projection relation conflicts with an existing scoped KAQ knowledge-to-knowledge fallback. An ActKG Engineering relation SHALL NOT participate in this retirement contract and SHALL remain unchanged. A conflicting ACT candidate MUST remain excluded until the repository decision resolves the conflict.

#### Scenario: ActKG relation is accepted
- **WHEN** review accepts a released ActKG teaching relation as historical evidence
- **THEN** that ActKG teaching relation SHALL NOT become the planning authority
- **AND** only an admitted ACT Teaching Projection relation MAY retire the corresponding KAQ fallback

#### Scenario: ACT relation is admitted after conflict resolution
- **WHEN** the governed repository decision accepts the ACT Teaching Projection relation that conflicts with a scoped KAQ fallback
- **THEN** the corresponding KAQ knowledge relation SHALL be retired before the ACT relation becomes active for planning
- **AND** no ActKG Engineering relation SHALL be retired, relabeled, or copied by that decision

#### Scenario: ACT and KAQ conflict is unresolved
- **WHEN** the conflict decision is rejected, deferred, missing, or identity-drifted
- **THEN** the ACT candidate and conflicting KAQ fallback SHALL NOT become jointly active for formal planning
- **AND** the unresolved ACT candidate SHALL remain in the repository review pack


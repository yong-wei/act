# incremental-domain-teaching-projection Specification

## Purpose
定义 ACT 教学投影的不可变领域片段、确定性组合、覆盖模型与独立激活合同；运行时领域分片服务、响应和缓存消费由后续变更实现。
## Requirements
### Requirement: Teaching semantics publish as immutable domain fragments
The system SHALL publish Teaching Projection content as immutable, versioned domain fragments containing reviewed core-node memberships and direct ACT_TEACHING relations. A composed manifest SHALL order accepted fragments and bind their digests, Authority identity and deterministic projection identity.

#### Scenario: New domain fragment is accepted
- **WHEN** a fragment passes identity, endpoint, evidence and graph validation
- **THEN** a new composed Teaching Projection version SHALL include that fragment without modifying prior fragment bytes or evidence

#### Scenario: Fragment identity drifts
- **WHEN** a fragment does not match its declared Authority selection, source revision or digest
- **THEN** the candidate projection SHALL fail closed and the prior published projection SHALL remain unchanged

### Requirement: Teaching coverage is independent from Authority readiness
The system SHALL represent domain teaching coverage as `available`, `partial`, `empty` or `unavailable` independently from Engineering Authority readiness. Authority objects outside the course-content-related DomainConcept subset MAY remain uncovered without failing Authority activation. The teaching-prerequisite graph of course-content-related overview members SHALL NOT be published as `empty` or `partial` when any related overview concept is isolated; that gate is defined by `domain-teaching-order-coverage` and SHALL fail closed. Unrelated overview members MAY leave a domain `empty`. An unresolved teaching service SHALL still be distinguished from empty published coverage and SHALL NOT fabricate a teaching relation or alter the Authority binding.

#### Scenario: Domain has partial teaching coverage
- **WHEN** reviewed teaching relations exist but Authority objects outside the course-content-related overview subset remain uncovered
- **THEN** the composed artifact SHALL retain the related-subset teaching-order graph and MAY record partial coverage for non-overview or unrelated objects
- **AND** the Authority binding SHALL remain valid for the independent activation contract

#### Scenario: Overview teaching order is incomplete
- **WHEN** a registered domain's course-content-related DomainConcept overview subset is not weakly connected under published teaching prerequisites
- **THEN** the candidate Teaching Projection SHALL fail closed
- **AND** the prior published projection SHALL remain unchanged

#### Scenario: Teaching service is unavailable
- **WHEN** the optional teaching layer cannot be resolved
- **THEN** the artifact contract SHALL distinguish unavailability from empty published coverage
- **AND** it SHALL not fabricate a teaching relation or alter the Authority binding

### Requirement: Future reviewed relations enter the composed projection without release-specific relation lists
A future direct teaching relation SHALL enter its matching composed Teaching Projection when its immutable fragment is accepted and its registered presentation contract is supported. The composition contract SHALL NOT require a hard-coded per-release relation allowlist.

#### Scenario: New reviewed prerequisite is published
- **WHEN** a later projection version adds a valid registered direct prerequisite
- **THEN** the next composed projection SHALL include the relation according to its declared domain membership
- **AND** unchanged engineering facts and prior teaching evidence SHALL not require re-review


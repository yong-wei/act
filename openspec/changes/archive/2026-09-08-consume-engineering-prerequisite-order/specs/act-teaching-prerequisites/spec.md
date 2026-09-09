## MODIFIED Requirements

### Requirement: Published prerequisites are ACT_TEACHING direct edges
Every published teaching prerequisite MUST use `layer: ACT_TEACHING`, `relationType: PREREQUISITE`, strength `REQUIRED` or `RECOMMENDED`, a declared scope, and provenance. Direct edges are stored; closure/order are deterministic derived views. Published course-scope prerequisites MUST be ingested into the single domain Teaching Projection. An Engineering relation whose presentation family is `post-requisite` MAY be adopted as a REQUIRED teaching prerequisite with engineering provenance when present. An upstream-minted Engineering `prerequisite` predicate edge connecting two current Authority objects SHALL be treated as belonging to that adoption channel and MAY be adopted as a REQUIRED teaching prerequisite with engineering provenance. Other engineering families (`association`, `derived_from`, `has_component`, and similar) MUST NOT publish as teaching prerequisites without separate ACT teaching evidence or curator rationale. Engineering-source candidates MUST actually be generated for the adoption channel to review; an always-empty candidate set SHALL be treated as a builder defect.

#### Scenario: Required edge has evidence
- **WHEN** two current core nodes have an authored evidence-backed dependency
- **THEN** the builder SHALL publish one direct `REQUIRED` edge with curator/source provenance

#### Scenario: Engineering post-requisite is the candidate
- **WHEN** an ActKG relation in the `post-requisite` presentation family connects two current Authority objects
- **THEN** the builder SHALL publish a matching `ACT_TEACHING` `PREREQUISITE` edge with that engineering relation as provenance
- **AND** it SHALL NOT wait for a separate textbook sentence before adopting that knowledge-order edge

#### Scenario: Minted engineering prerequisite is the candidate
- **WHEN** an upstream-minted Engineering `prerequisite` predicate edge connects two current Authority objects
- **THEN** the builder SHALL consider it through the same adoption channel as the `post-requisite` family
- **AND** adoption SHALL record the engineering edge identity and snapshot provenance

#### Scenario: Engineering relation is the only candidate
- **WHEN** an ActKG `association`, `derived_from`, `has_component`, or other non-post-requisite engineering relation has no ACT teaching evidence
- **THEN** it SHALL remain a candidate and MUST NOT publish as a teaching prerequisite

#### Scenario: Course prerequisite publication is the candidate
- **WHEN** a published course-scope `PREREQUISITE` connects two current Authority objects
- **THEN** the single domain Teaching Projection SHALL include that edge
- **AND** it SHALL preserve the published strength and evidence references

## ADDED Requirements

### Requirement: Engineering learning-order adoption is reconciled with teaching design
采用工程学习顺序边时，与既有教学设计证据冲突的条目 SHALL 以教学证据优先并逐条记录为例外；采用与拒绝均 SHALL 留存不可变收据并绑定权威快照身份。

#### Scenario: Teaching evidence conflicts with engineering order
- **WHEN** 一条工程 `prerequisite` 边与现行教学设计证据冲突
- **THEN** 发布 SHALL 以教学证据为准
- **AND** 该工程边 SHALL 记录为例外并附冲突双方身份

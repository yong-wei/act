# teaching-projection-path-binding-adapter Specification

## Purpose
教学投影绑定到路径候选的适配器契约：确定性身份映射、合并语义、canonical 信号用途边界与失败降级。适配器只向既有 ResourceNode 注册表提供第五候选源，不得成为第二装配权威。

## Requirements

### Requirement: Binding adapter uses deterministic identity mapping
The teaching-projection path binding adapter SHALL map projection resource ids to existing ResourceNode ids using only deterministic rules aligned with `identity.ts`: `act:handout:<lessonKey>` to `runtime-handout:<lessonKey>`, `act:card:<stableCardId>` to `knowledge-card:<stableCardId>`, single-token `act:video:<lessonKey>` to `runtime-media:<lessonKey>:<lessonKey>-intro-video`, single-token `act:audio:<lessonKey>` to `runtime-media:<lessonKey>:<lessonKey>-audio`, `act:simulation:arena-task-<taskId>` to `arena-task:task-<taskId>` after stripping a redundant `task-` prefix, `act:textbook-section:<token>` to `textbook-section:` plus the decoded locator, and `act:exercise:<id>` to `exercise:<id>`. Two-segment `act:video|audio:<lessonKey>:<mediaId>` ids SHALL be skipped as unmapped. Classroom simulations whose ids encode a lesson unit SHALL resolve only through an explicit mapping table of registry `lessonNN` exact ids; unmatched lesson simulations SHALL be skipped. Non-lesson registered simulation ids MAY map to `registry:<id>`. Fuzzy matching, label similarity, and vector similarity MUST NOT create a mapping. `act:textbook` and `act:textbook-chapter` containers MUST NOT produce path nodes.

#### Scenario: Projection handout maps to a runtime handout node
- **WHEN** the active projection contains `act:handout:3-2` with canonical bindings
- **THEN** the adapter SHALL emit a patch for ResourceNode `runtime-handout:3-2`
- **AND** the patch SHALL carry the canonical binding ids as matching, ranking, and explanation signals

#### Scenario: Classroom simulation has no mapping-table entry
- **WHEN** a projection simulation id has no entry in the explicit classroom-simulation mapping table
- **THEN** the adapter SHALL skip it
- **AND** the skip SHALL be counted by resource family in candidate-pool diagnostics

#### Scenario: Textbook container appears in the projection
- **WHEN** the projection contains an `act:textbook:*` or `act:textbook-chapter:*` resource
- **THEN** the adapter SHALL NOT emit a path candidate for the container
- **AND** only its bound sections MAY produce candidates

### Requirement: Adapter merge preserves ResourceNode admission authority
Adapter patches SHALL merge into the unified ResourceNode registry through the same governed loader and the same id-keyed overlap merge used by every other candidate family. A patch MUST NOT set `pathEligible`, override audit fields, or replace review-batch state. Hard eligibility decisions SHALL remain owned by the existing audit and review pipeline.

#### Scenario: Patch targets an unreviewed node
- **WHEN** an adapter patch merges into a ResourceNode that has not passed path-readiness review
- **THEN** the node SHALL remain excluded-with-rationale blocking
- **AND** the canonical binding signal SHALL NOT reintroduce it as an executable path node

#### Scenario: Patch targets an already-governed node
- **WHEN** an adapter patch merges into a ResourceNode that already passes audit and review
- **THEN** the merge SHALL add canonical binding, title, and resource-family signals
- **AND** it SHALL preserve the node's existing role, scope, source/provenance, and admission state

### Requirement: Canonical targets enter goal matching through the governed id bridge
Goal matching SHALL admit canonical targets by resolving them through the governed cutover denominator bridge to legacy node ids before comparison. The bridge SHALL be consumed as read-only exact rows; canonical ids MUST NOT become ResourceNode primary keys. Canonical targets without a bridge row SHALL NOT match and SHALL be reported as a diagnostic limitation.

#### Scenario: Canonical goal target resolves through the bridge
- **WHEN** a LearningGoal carries a canonical target that the denominator bridge maps to a legacy node id
- **THEN** goal matching SHALL treat governed nodes covering that legacy id as matching the canonical target
- **AND** the explanation signal SHALL cite the canonical id

#### Scenario: Canonical goal target has no bridge row
- **WHEN** a LearningGoal carries a canonical target absent from the denominator bridge
- **THEN** that target SHALL NOT match any candidate
- **AND** diagnostics SHALL report the unresolvable target instead of falling back to fuzzy matching

### Requirement: Adapter failure degrades visibly
When projection resources, bindings, cards-index, or the id bridge are missing, stale, or fail version assertions, the adapter SHALL contribute an empty candidate family. Candidate-pool diagnostics SHALL report the family as missing or limited, and the generated path SHALL be marked limited rather than presented as a complete resource-aware recommendation. The adapter MUST NOT fabricate candidates to fill the gap.

#### Scenario: Projection input is missing
- **WHEN** the active projection resource or binding input cannot be loaded
- **THEN** the teaching-projection binding family SHALL be empty
- **AND** diagnostics SHALL name the missing family while the other four families proceed unchanged

#### Scenario: Bridge version assertion fails
- **WHEN** the denominator bridge lacks the expected capture revision or baseline hash fields
- **THEN** canonical target resolution SHALL degrade to legacy targets only
- **AND** the limitation SHALL be recorded in diagnostics

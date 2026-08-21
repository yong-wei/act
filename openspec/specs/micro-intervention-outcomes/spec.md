# micro-intervention-outcomes Specification

## Purpose
Define the server-authorized, append-only intervention outcome record and governed next-step recommendations for remediation tasks.
## Requirements
### Requirement: Server-created, append-only intervention identity
The system SHALL create a server-assigned intervention instance only for an authenticated learner's currently available remediation orchestration result. Each instance SHALL retain immutable attribution, task, resource, validation-version, and learner-session bindings; the learner session SHALL come from the owning wrong-answer attribution rather than a client value. A retry with the same event key SHALL return the original event result, while a later start request SHALL create an independent intervention history.

#### Scenario: Start and retry an intervention
- **WHEN** a learner starts the same available remediation task twice with the same start event key
- **THEN** the system returns one intervention instance and one recorded start event without rewriting it

#### Scenario: Start a new intervention
- **WHEN** the learner starts the same available remediation task with a new start event key
- **THEN** the system creates a separate intervention instance with its own event history

### Requirement: Version-bound, privacy-safe outcome evidence
The system SHALL record only server-validated resource-use, hint, completion, duration, and validation-answer facts for an intervention instance. At start, the system SHALL bind the intervention to a canonical hash of the server runtime validation question when that question is available; an unavailable runtime question SHALL preserve the started intervention but prevent validation. Before accepting a validation answer, the system SHALL revalidate the remediation task and SHALL bind the result to its selected validation item, content hash, version, learner session, and the unchanged runtime-question hash. A repeated event or validation submission SHALL return the original result only when its idempotency key and complete accepted semantics match the first persisted record; substituted event payloads, a second validation key, and races that resolve to a different first record SHALL return a conflict without rewriting evidence. Learner projections SHALL exclude learner-session identifiers, internal resource/node identifiers, answer keys, explanations, raw answer text, source-question identifiers, misconception tags, and teacher-private metadata.

#### Scenario: Submit the selected governed validation question
- **WHEN** a learner submits an option for the intervention's selected validation question after the task remains current and accessible
- **THEN** the system evaluates the option server-side, records the version-bound outcome idempotently, and returns only the learner-safe result

#### Scenario: Reject a substituted retry or second validation
- **WHEN** a learner reuses an event key with different accepted event data, changes a validation answer or timing for the same key, or submits a validation with a different key after an outcome exists
- **THEN** the system returns a conflict and preserves the first recorded event or validation outcome

#### Scenario: Submit a stale or substituted question
- **WHEN** the stored task has drifted, access has been revoked, or the submitted question does not match the intervention snapshot
- **THEN** the system rejects the submission without recording a validation outcome or exposing protected assessment content

#### Scenario: Runtime question changes without a new identifier
- **WHEN** the runtime validation question keeps its identifier but changes content or answer semantics after intervention start
- **THEN** the system rejects the validation without recording an outcome under stale content-hash or version metadata

### Requirement: Governed next-step recommendation
The system SHALL derive a next-step recommendation only from the intervention's validated outcome and current governed planning relationships. A passing validation SHALL retain the pass outcome and recommend an eligible higher-order transfer practice when one exists; otherwise it SHALL return a controlled transfer-practice-unavailable recommendation. A failed validation SHALL recommend deterministic governed prerequisite nodes before falling back to a controlled tutoring/manual-practice recommendation. Recommendations SHALL NOT update mastery or the formal learning path.

#### Scenario: Pass with an eligible transfer practice
- **WHEN** a validation passes and a current learner-visible governed higher-order transfer practice is available for the attributed node
- **THEN** the projection contains that practice as the next step with an evidence-basis summary

#### Scenario: Pass without transfer practice
- **WHEN** a validation passes and no eligible governed higher-order transfer practice exists
- **THEN** the projection preserves the pass outcome and reports a controlled transfer-practice-unavailable recommendation

#### Scenario: Fail with prerequisite nodes
- **WHEN** a validation fails and governed prerequisite nodes are available for the attributed node
- **THEN** the projection recommends the deterministic prerequisite-node set without changing the learner's formal path

#### Scenario: Fail without prerequisite nodes
- **WHEN** a validation fails and no governed prerequisite node is available
- **THEN** the projection recommends the controlled tutoring/manual-practice fallback without inventing a node

### Requirement: 微干预记录受治理资源动作身份

系统 SHALL 仅记录服务端已验证、属于干预快照的资源动作事件。事件 MUST 绑定干预实例、资源稳定身份、资源 revision/hash、动作 id/version 和事件幂等键；客户端不得替换资源或动作身份。参与事件 SHALL 与独立验证结果保持不同的 evidence kind。

#### Scenario: 记录合格资源动作完成

- **WHEN** 学生完成当前干预所选资源的受控动作
- **THEN** 系统 SHALL 幂等记录服务端绑定的资源和动作身份
- **AND** 该事件 SHALL 标记为参与上下文而非掌握证明

#### Scenario: 客户端替换动作身份

- **WHEN** 客户端提交的资源、动作或 revision 不属于干预快照
- **THEN** 系统 SHALL 拒绝事件
- **AND** 不得重写已有干预证据


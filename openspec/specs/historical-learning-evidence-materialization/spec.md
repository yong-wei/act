# historical-learning-evidence-materialization Specification

## Purpose
Define the governed backfill path that converts eligible historical and out-of-class learning evidence into traceable, idempotent `LearningFact` records without mutating raw source tables.
## Requirements
### Requirement: Historical evidence materialization is catalog-driven
The system SHALL materialize historical and out-of-class learning evidence only through adapters that consume the governed evidence source catalog.

#### Scenario: Adapter follows catalog eligibility
- **WHEN** a materialization adapter inspects a source family
- **THEN** it SHALL use the catalog's provenance, learning scope, value level, profile eligibility, and materialization readiness policy
- **AND** it SHALL NOT emit profile-grade candidates for sources marked context-only, unsupported, seed, showcase, demo, or test.

#### Scenario: Eligible high-value source emits candidate
- **WHEN** a source row belongs to a catalog-approved high-value or explicitly materialization-ready source family
- **THEN** the adapter SHALL emit an evidence candidate with user id, source family, stable source identity, source timestamp, evidence subtype, trace reference, and confidence metadata.

### Requirement: Materialization supports dry-run before apply
The system SHALL provide dry-run and apply modes for historical evidence materialization.

#### Scenario: Dry-run writes nothing
- **WHEN** the materialization command runs in dry-run mode
- **THEN** it SHALL report candidate counts, excluded counts, unsupported counts, affected users, source windows, and sample trace references
- **AND** it SHALL NOT create, update, or delete `LearningFact`, snapshot, summary, feature, or raw source rows.

#### Scenario: Apply writes derived facts only
- **WHEN** the materialization command runs in apply mode
- **THEN** it SHALL write only derived governance facts for eligible evidence candidates
- **AND** it SHALL preserve all raw source rows unchanged.

### Requirement: Materialization is idempotent and traceable
The system SHALL prevent duplicate facts when historical materialization is repeated and SHALL retain traceability to raw source records.

#### Scenario: Repeated apply is stable
- **WHEN** apply mode is run more than once against the same source data
- **THEN** the second and later runs SHALL NOT create duplicate facts for candidates with the same stable source identity
- **AND** the run summary SHALL report already-materialized candidates separately from newly-created facts.

#### Scenario: Fact points to source evidence
- **WHEN** a derived fact is created from historical evidence
- **THEN** it SHALL include enough source metadata to identify the source family, source record or deterministic source key, evidence subtype, and original timestamp
- **AND** downstream audits SHALL be able to connect the fact back to the raw evidence source without reading ambiguous free-text fields.

### Requirement: Canonical diagnostic student fixtures are gated by data completeness
The system SHALL provide deterministic diagnostic student fixture generation only after required graph and resource data completeness gates pass.

#### Scenario: Fixture precondition fails
- **WHEN** a diagnostic fixture command is requested for a canonical test student
- **AND** the data completeness helper reports blocking graph, resource, citation, or path-planning gaps for the targeted test scope
- **THEN** the fixture command SHALL refuse to apply mock learner-state data
- **AND** it SHALL report the blocking completeness dimensions.

#### Scenario: Fixture precondition passes
- **WHEN** the targeted graph and resource completeness gates pass
- **THEN** the fixture command MAY materialize governed learner-state records for the canonical test student
- **AND** every created record SHALL include deterministic fixture provenance and source references.

### Requirement: Yang Fan diagnostic fixture is canonical and idempotent
The system SHALL provide an explicit Yang Fan diagnostic fixture command for local/development testing.

#### Scenario: Canonical Yang Fan is resolved
- **WHEN** the Yang Fan fixture command runs
- **THEN** it SHALL resolve the canonical account by stable email or student number
- **AND** it SHALL report duplicate account candidates before any apply-mode mutation.

#### Scenario: Duplicate account requires human review
- **WHEN** a duplicate Yang Fan account is present
- **THEN** the command SHALL refuse apply and reset mutations
- **AND** it SHALL report privacy-minimized duplicate candidates for a separate human-reviewed account operation.

#### Scenario: Yang Fan learner evidence is materialized
- **WHEN** the fixture applies after preconditions pass
- **THEN** it SHALL create or update traceable LearningFacts, KnowledgeProgress, LearningPathExecution evidence references, adaptive assessment state, StudentCompetencySnapshot, StudentProfileSummary, and StudentEvidenceFeatureCache records for the canonical account
- **AND** the result SHALL support graph-grounded Konling, path planning/continuation, and adaptive answering tests without relying on hidden raw records.

#### Scenario: Fixture write is production-protected
- **WHEN** the Yang Fan fixture command is executed in production mode, against a production-denied database URL, against a database not allowlisted for fixture writes, or without an explicit apply confirmation
- **THEN** it SHALL refuse to mutate data
- **AND** it SHALL provide a dry-run summary or safety diagnostic instead.

#### Scenario: Fixture output is privacy minimized
- **WHEN** the Yang Fan fixture command prints dry-run, apply, reset, or audit output
- **THEN** it SHALL redact or hash direct student identifiers by default
- **AND** it SHALL NOT print raw answers, raw event payloads, raw resource content, private memory content, or hidden evaluation internals.

#### Scenario: Arena official result boundary is preserved
- **WHEN** Yang Fan fixture evidence includes Arena-related learning context
- **THEN** fixture-created LearningFacts, feature-cache entries, or path evidence SHALL be treated only as auxiliary learning evidence
- **AND** official score, validity, ranking, leaderboard state, and official submission result semantics SHALL remain sourced only from `ArenaSubmission` and governed official Arena evaluation records.

### Requirement: 历史仿真产物按任务目录生成候选
历史物化 SHALL 使用实时路径相同的当前仿真任务目录、稳定产物身份和来源白名单生成 dry-run 候选与跳过原因。候选必须同时具有学生、发生时间、可确认产品语义和可解析到当前目录的任务身份。

#### Scenario: 可恢复任务身份的历史产物进入候选
- **WHEN** 历史仿真、Arena、控制工作台或奥德赛记录可恢复学生、时间、来源语义和当前目录任务身份
- **THEN** dry-run 将其列为对应任务的候选
- **AND** 候选包含稳定产物身份、来源、层级和任务标识

#### Scenario: 缺失具名虚拟任务的历史产物使用通用任务
- **WHEN** 历史虚拟仿真记录满足来源白名单但不能恢复具名任务身份
- **THEN** dry-run 将其归入通用虚拟仿真任务
- **AND** 不将其表示为 Arena 官方验证或具名课程任务完成

#### Scenario: 上下文不足的历史记录被跳过
- **WHEN** 历史记录缺少学生、发生时间或可确认产品语义
- **THEN** dry-run 记录明确跳过原因
- **AND** 系统不得以旧参数调整或不完整上下文补造任务证据

#### Scenario: 已下线具名任务的历史记录被跳过
- **WHEN** 历史记录能识别具名任务但该任务已下线或不在当前目录
- **THEN** dry-run 以 `task-no-longer-published` 记录跳过原因
- **AND** 系统不得将其重新加入当前目录、改归通用任务或重放原始轨迹

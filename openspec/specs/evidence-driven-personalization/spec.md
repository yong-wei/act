# evidence-driven-personalization Specification

## Purpose
Define the governed evidence contract for visible profile and recommendation personalization so recommendations remain explainable, traceable, and honest about confidence without introducing a new recommendation engine.
## Requirements
### Requirement: Personalization reads governed evidence
The system SHALL use governed evidence, snapshots, summaries, or student evidence feature cache data, including simulation/Arena-derived features, for core profile and recommendation decisions.

#### Scenario: Recommendation consumer reads governed feature data
- **WHEN** a recommendation or profile consumer needs student learning evidence
- **THEN** it SHALL read governed facts, snapshots, summaries, or evidence feature cache data for core profile computation
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths

#### Scenario: Unmanaged LearningFact is excluded from personalization
- **WHEN** a LearningFact lacks complete evidence governance
- **THEN** recommendation activity, evidence coverage, feature-cache aggregation, and learner-state preference inputs SHALL exclude it
- **AND** it SHALL not become the basis of a personalized claim

#### 场景：context-only LearningFact 排除在个性化之外
- **当** LearningFact 的证据治理字段完整，但解析后画像权重为零或显式跳过画像贡献
- **那么** 推荐活动、证据覆盖、最近活动、连续学习、feature cache 聚合和学习者状态偏好输入均不得包含该事实
- **并且** 该事实仅可供审计或时间线下钻读取者使用

#### 场景：context-only LearningFact 不得截断合格事实
- **当** 个性化读取路径需要在合格 LearningFact 数量上施加上限，且最新原始记录中包含 context-only 事实
- **那么** 读取路径必须持续分页至获得所需合格事实或数据耗尽
- **并且** context-only 事实不得遮蔽最近活动、连续学习、证据覆盖或学习者状态偏好所需的合格事实

#### 场景：治理规则提升画像计算版本
- **当** 治理规则使已有累计画像计算版本失效
- **那么** 发布流程必须在恢复画像物化服务前，通过受围栏的累计画像迁移完成 dry-run、apply 和 verify
- **并且** cutover fence、学习者当前指针和班级当前指针必须统一推进到新的计算版本

#### Scenario: Existing scope is preserved
- **WHEN** personalization consumers are upgraded to governed evidence
- **THEN** the change SHALL preserve the existing recommendation scope and competency model
- **AND** it SHALL NOT introduce a new AI recommendation engine

#### Scenario: Simulation features contribute to weak-area rationale
- **WHEN** simulation or Arena-derived feature cache data identifies weak metrics, repeated constraint failures, low replay confidence, or incomplete evidence
- **THEN** personalization output SHALL be able to reference those governed features as rationale with source coverage and confidence metadata

### Requirement: Recommendations expose evidence rationale
The system SHALL expose reason metadata for evidence-driven profile and recommendation outputs, including whether simulation/Arena evidence came from official evaluation, course-launched simulation, standalone simulation, or preview-only activity. Any profile projection of those recommendations SHALL preserve the recommendation rationale needed to explain the resource and how strong or limited the evidence is.

#### Scenario: Recommendation includes reason metadata
- **WHEN** the system returns a recommendation or profile claim based on governed evidence
- **THEN** it SHALL include reason code, evidence window, evidence count, and source coverage metadata where relevant
- **AND** the rationale SHALL be derived from the same governed evidence used for the decision.

#### Scenario: Context-only evidence is not overstated
- **WHEN** passive views, navigation, leaderboard browsing, or other context-only activity appears in a recommendation rationale
- **THEN** the output SHALL identify it as context rather than direct competency improvement evidence
- **AND** it SHALL NOT present context-only events as the sole basis for a high-confidence competency claim.

#### Scenario: Preview-only simulation evidence is used
- **WHEN** a recommendation uses preview-only simulation or Arena evidence
- **THEN** the rationale SHALL identify it as preview-only and SHALL NOT present it as an official evaluation result

#### Scenario: Profile projects an evidence-backed recommendation
- **WHEN** a governed recommendation is mapped to a student's profile resource card
- **THEN** the card SHALL retain the recommendation reason, confidence state, evidence window, evidence count, source coverage, and owner scope
- **AND** the profile SHALL not replace the recommendation with an unscoped or hardcoded resource.

#### Scenario: Evidence is insufficient for a profile recommendation
- **WHEN** the recommendation is based on missing, stale, partial, low-confidence, or fallback evidence
- **THEN** the profile projection SHALL preserve the limiting state
- **AND** the UI SHALL describe the limitation in student-facing language and offer a bounded next action.

### Requirement: Low-confidence personalization is explicit
The system SHALL mark missing, stale, partial, or low-confidence evidence in profile and recommendation outputs.

#### Scenario: Missing or stale features produce fallback state
- **WHEN** governed evidence features are missing, stale, partial, or low confidence for a student
- **THEN** personalization output SHALL expose a low-confidence or fallback state
- **AND** it SHALL NOT present the output as a complete precise diagnosis.

#### Scenario: Teacher/admin explanation can inspect confidence
- **WHEN** teacher or admin-facing services expose recommendation or profile rationale
- **THEN** they SHALL include enough confidence and source coverage metadata to explain why the recommendation is strong, weak, stale, or incomplete.

### Requirement: Personalization preserves simulation-agent provenance
Profile and recommendation outputs SHALL preserve provenance, confidence, and source coverage when using simulation, Arena, or Konling agent evidence.

#### Scenario: Recommendation uses simulation evidence
- **WHEN** a recommendation references simulation-derived weakness, improvement, or constraint failures
- **THEN** it SHALL include source type, evidence window, evidence count, replay confidence, and whether the source was course-launched, standalone, Arena preview, official evaluation, or agent-assisted.

#### Scenario: Recommendation uses agent analysis
- **WHEN** a recommendation uses Konling analysis or intervention evidence
- **THEN** it SHALL identify the supporting AgentToolRun or materialized evidence summary
- **AND** it SHALL NOT present unreviewed model narrative as a high-confidence competency fact.

### Requirement: Personalization remains owner-user scoped
Profile and recommendation services SHALL use only evidence belonging to the requested user except for explicitly authorized aggregate benchmarks.

#### Scenario: Student profile is read
- **WHEN** a student profile or recommendation is generated
- **THEN** simulation records, Arena preview records, and Konling memory/evidence from other users SHALL NOT contribute to that student's personalized claims.

### Requirement: Personalization can cite governed path execution features
Profile, recommendation, and learner-state personalization SHALL be able to use governed control-correction path features as rationale without scanning raw execution payloads.

#### Scenario: Recommendation uses path evidence
- **WHEN** a recommendation references path completion, deviation, fallback, terminal validation, or intervention outcome
- **THEN** it SHALL identify the supporting governed feature group, evidence window, source count, confidence, and privacy-safe source references
- **AND** it SHALL NOT present unreviewed model-authored intervention text as a high-confidence competency fact.

#### Scenario: Path evidence is weak
- **WHEN** path evidence is missing, stale, partial, preview-only, or low-confidence
- **THEN** personalization output SHALL expose the limiting evidence state
- **AND** it SHALL NOT present the recommendation as a complete precise diagnosis.

### Requirement: Personalized explanations expose citation coverage
Personalized recommendations and profile explanations SHALL expose citation coverage when they are generated for the control-correction path.

#### Scenario: Recommendation is explained
- **WHEN** a control-correction recommendation or coaching rationale is shown to a student
- **THEN** it SHALL expose content, learner-state, path-execution, simulation, Arena, or intervention citations that support the claim
- **AND** it SHALL identify missing citation classes or low-confidence evidence as limitations.

#### Scenario: Citation support is insufficient
- **WHEN** required citations cannot be retrieved or normalized
- **THEN** personalization output SHALL return a fallback or low-confidence explanation
- **AND** it SHALL NOT present the claim as fully verified.

### Requirement: Personalization distinguishes targets from observed mastery
Profile, diagnosis, and recommendation outputs SHALL distinguish desired capability targets from observed learner evidence.

#### Scenario: Capability target is shown
- **WHEN** a personalized explanation references a target on a knowledge node
- **THEN** it SHALL identify the target capability level and the evidence state separately
- **AND** it SHALL NOT present a teacher-defined target as proof that the learner has mastered that target.

#### Scenario: Evidence is missing for target
- **WHEN** a learner has no governed evidence for a capability target
- **THEN** personalization SHALL expose missing or low-confidence evidence
- **AND** it SHALL prefer starter or evidence-gathering recommendations over high-confidence mastery claims.

### Requirement: Personalization consumes knowledge capability evidence writeback
Profile, diagnosis, path planning, and recommendation personalization SHALL consume knowledge, capability, and quality evidence only after it has been materialized from governed sources.

#### Scenario: Evidence updates graph overlay state
- **WHEN** path execution, exercise, teacher-approved grading, simulation, Arena, interactive lesson, or approved Konling tool outcome is materialized through K/A/Q evidence writeback
- **THEN** personalization MAY use it as rationale according to its target refs, confidence, authority, freshness, source coverage, privacy-safe references, and limitation metadata
- **AND** raw source payloads or unreviewed model narrative SHALL NOT bypass the writeback governance layer.

#### Scenario: Writeback is degraded
- **WHEN** evidence is missing required graph/resource/version/citation context or is preview-only
- **THEN** personalization SHALL expose the limiting evidence state
- **AND** it SHALL NOT present the recommendation, profile claim, or diagnosis as a complete precise mastery judgment.

### Requirement: Path personalization preserves governed evidence provenance
路径个性化 SHALL 沿用学习者状态和受治理证据的来源、证据窗口、置信度、新鲜度及限制信息，不得把个人中心的展示摘要或未经治理的模型叙述作为路径依据。

#### Scenario: Path rationale cites governed evidence
- **WHEN** a generated path contains a personalized rationale
- **THEN** the rationale SHALL reference the governed evidence category and snapshot used by the planner
- **AND** it SHALL preserve the evidence limitation or confidence state

#### Scenario: Evidence is insufficient
- **WHEN** the required evidence cannot be retrieved, is stale, or has low coverage
- **THEN** the path result SHALL return an explicit fallback or low-confidence explanation
- **AND** it SHALL NOT present the path as a fully verified personalized diagnosis

### Requirement: Personalization rationale uses plugin-declared governed sources

Evidence-driven profile and recommendation projections for a registered goal SHALL use the plugin-declared Learning Record/Assessment source mappings, confidence policy and privacy scope. Course IDs, lesson IDs and Arena task IDs alone MUST NOT be treated as evidence.

#### Scenario: Control-correction recommendation is generated

- **WHEN** a recommendation uses control-correction evidence
- **THEN** its rationale SHALL identify the plugin version, governed source category, evidence window, confidence and privacy-safe refs
- **AND** it SHALL preserve missing/stale/preview limitations.

#### Scenario: Raw course payload is supplied

- **WHEN** a client or route supplies raw course/lesson/task payload without a governed source ref
- **THEN** Personalization SHALL reject it as authoritative evidence
- **AND** it SHALL not create a high-confidence profile claim or recommendation.

### Requirement: Recommendation and intervention evidence uses one governed policy boundary

Evidence-driven personalization SHALL obtain recommendation and intervention inputs from Personalization policy over Learning Record facts and authorized Assessment/Arena/simulation read ports. It SHALL preserve the same rationale, provenance, confidence, privacy and owner-scope rules for every caller.

#### Scenario: Policy combines facts from multiple domains

- **WHEN** a decision combines LearningFact, assessment result and path/plugin context
- **THEN** the policy SHALL retain source provenance and privacy class for each governed input
- **AND** it SHALL not expose raw source payloads or turn a policy narrative into a high-confidence fact.

#### Scenario: A non-learning interaction is observed

- **WHEN** the input is ordinary browsing, a prompt, a hint request or an unverified recommendation click
- **THEN** the system MAY use it as limited context under the evidence policy
- **AND** it SHALL not treat it as independent mastery evidence.

### Requirement: Cross-process evidence has an auditable single materialization

Evidence-driven personalization SHALL use the existing `EvidenceOutbox → worker → LearningFact` contract for asynchronous intervention projection. The producer port SHALL atomically stage one deduplicated, privacy-safe outbox receipt with stable action/causation identity; only the worker MAY materialize the corresponding LearningFact, and missing or unapplied outbox state MUST remain explicit.

#### Scenario: A worker replays an applied receipt

- **WHEN** a crash, retry or duplicate delivery replays an outbox receipt already marked applied
- **THEN** the worker SHALL return the existing materialization using its persisted dedupe/causation constraint
- **AND** it SHALL not append another Fact or count the intervention twice.

#### Scenario: Producer and outbox both attempt a Fact write

- **WHEN** a path attempts a direct LearningFact write and an EvidenceOutbox write for the same asynchronous intervention
- **THEN** the contract SHALL reject the double-write or make one side a no-op before materialization
- **AND** the public evidence projection SHALL not expose a duplicate contribution.

### Requirement: Personalization evidence adapters use governed ports and one writer boundary
Evidence-driven recommendations and interventions SHALL receive normalized, revision-bound inputs through Personalization-owned adapters and declared Learning Record/Assessment ports. They MUST NOT query raw facts, route payloads or `data-governance` business internals, and MUST NOT write a parallel evidence store.

#### Scenario: Recommendation consumes domain-owned evidence
- **WHEN** a recommendation or intervention is evaluated
- **THEN** Personalization SHALL use the registered goal/plugin policy and governed source refs
- **AND** the result SHALL preserve confidence, coverage, freshness, provenance and idempotency metadata

#### Scenario: Recommendation input is client-authored
- **WHEN** a client supplies profile values, mastery, path or evidence hints
- **THEN** the adapter SHALL treat them as non-authoritative context
- **AND** it SHALL not use them to replace Assessment or Learning Record evidence

### Requirement: Adapter migration preserves recommendation and intervention authority
Moving the evidence adapter SHALL not change hard eligibility, Assessment mastery, Learning Record fact identity, official Arena authority, teacher scope or the advisory-only nature of recommendation/intervention output.

#### Scenario: Adapter returns a low-confidence result
- **WHEN** source coverage is partial, stale, provisional or unavailable
- **THEN** Personalization SHALL expose the limitation and bounded advisory result
- **AND** it SHALL not promote the result into high-confidence mastery or a hard path gate

#### Scenario: Adapter is retried
- **WHEN** the same subject, evidence revision and idempotency identity is processed again
- **THEN** the owner boundary SHALL return the existing decision/materialization result
- **AND** it SHALL not duplicate LearningFacts, mastery updates, path events or intervention records


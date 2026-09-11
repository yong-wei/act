# student-evidence-feature-cache Specification

## Purpose
Define the governed per-student evidence feature cache used by profile, recommendation, and teacher-insight consumers so derived evidence can be rebuilt deterministically from approved source facts and aggregates.
## Requirements
### Requirement: Student evidence feature cache is rebuildable
The system SHALL maintain a per-student evidence feature cache that is deterministically rebuildable from governed evidence, assessment records, learner-state source records, ResourceNode execution, path feedback, intervention outcomes, and prerequisite-provided simulation/Arena feature groups.

#### Scenario: Full rebuild produces stable payload
- **WHEN** a full feature-cache rebuild is run against unchanged governed evidence
- **THEN** the generated feature payload for a student SHALL remain stable across repeated rebuilds
- **AND** the cache SHALL record the feature payload version used for generation.
- **AND** diagnostic fixture accounts SHALL produce stable cache output across repeated reset/apply runs.

#### Scenario: Per-student refresh updates changed evidence
- **WHEN** governed evidence changes for a student
- **THEN** the system SHALL support refreshing that student's cache entry without requiring unrelated student entries to be rewritten
- **AND** the refreshed entry SHALL expose the refresh timestamp.

#### Scenario: Simulation summary evidence is rebuilt
- **WHEN** governed simulation or Arena learning facts contain trace references, summary metrics, source ids, protocol versions, and replay confidence
- **THEN** the rebuilt feature payload SHALL derive deterministic compact simulation/Arena features without scanning raw high-frequency trace payloads

#### Scenario: Simulation and Arena features are consumed
- **WHEN** the cache includes simulation or Arena feature groups
- **THEN** it SHALL consume the outputs of `materialize-simulation-features-for-personalization`
- **AND** it SHALL NOT redefine trace, replay, coverage, or Arena evaluation semantics.

### Requirement: Cache exposes freshness and evidence coverage
The system SHALL expose freshness, coverage, and confidence metadata with each student evidence feature cache entry.

#### Scenario: Feature entry includes source windows
- **WHEN** a student evidence feature cache entry is read
- **THEN** it SHALL include evidence windows, source counts, source coverage, and last refresh time for the features it contains.

#### Scenario: Partial evidence is marked
- **WHEN** a student's governed evidence is missing, stale, partial, or low confidence
- **THEN** the feature cache SHALL mark that state explicitly
- **AND** downstream consumers SHALL be able to distinguish low-confidence features from complete evidence.

### Requirement: Normal consumers use governed feature reads
The system SHALL provide a governed read boundary for student evidence features so profile, recommendation, and teacher-insight consumers do not rescan raw source tables or raw simulation traces for core profile computation.

#### Scenario: Consumer reads feature service
- **WHEN** a profile, recommendation, or teacher-insight consumer needs student evidence features
- **THEN** it SHALL read from the governed feature cache service or governed facts
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths.

#### Scenario: Missing cache is handled explicitly
- **WHEN** a consumer requests features for a student whose cache is missing
- **THEN** the read service SHALL return an explicit missing or stale state
- **AND** it SHALL NOT silently synthesize high-confidence personalization features from incomplete evidence.

#### Scenario: Raw trace is not a normal feature source
- **WHEN** a normal profile, recommendation, or teacher-insight consumer needs simulation-derived features
- **THEN** it SHALL use governed summaries, facts, or feature cache entries instead of directly scanning high-frequency trace samples

### Requirement: Feature cache refreshes after governed evidence changes
The system SHALL refresh or enqueue refresh of a student evidence feature cache entry after governed facts or snapshots change for that student.

#### Scenario: Snapshot job refreshes cache
- **WHEN** a student snapshot job completes successfully
- **THEN** the corresponding StudentEvidenceFeatureCache entry is refreshed with updated timestamp and source windows

### Requirement: Feature cache exposes recent and all-time windows
The cache SHALL distinguish recent learner-facing evidence windows from all-time audit windows.

#### Scenario: Thirty-day and all-time features are present
- **WHEN** a cache entry is rebuilt
- **THEN** it includes recent and all-time activity and competency contribution summaries

### Requirement: Cache exposes adaptive-learning freshness and coverage
The system SHALL expose freshness, source coverage, and confidence metadata for adaptive learner-state feature groups.

#### Scenario: Feature entry is read
- **WHEN** a student evidence feature cache entry is read for learner state
- **THEN** it SHALL include evidence windows, source counts, source coverage, last refresh time, and confidence markers for the features it contains.

### Requirement: Feature cache consumes materialized simulation and agent evidence
Student evidence feature cache SHALL consume materialized SimulationRun, Arena preview, and AgentToolRun evidence through governed facts, summaries, or drafts rather than raw traces or raw memory.

#### Scenario: Cache rebuild includes simulation-agent evidence
- **WHEN** the feature cache rebuilds for a student with materialized simulation or agent evidence
- **THEN** it SHALL derive deterministic feature groups from owner-scoped LearningFacts, evidence drafts, run summaries, replay confidence, and source provenance
- **AND** it SHALL NOT scan raw high-frequency trace samples for normal profile features.

#### Scenario: Cache rebuild is cross-user safe
- **WHEN** the cache rebuilds for one student
- **THEN** it SHALL use only evidence owned by that student unless a future shared-team evidence spec explicitly allows another scope.

### Requirement: Feature cache marks simulation-agent confidence
Student evidence feature cache SHALL expose confidence, freshness, source coverage, preview/official provenance, and low-evidence markers for simulation and agent-derived feature groups.

#### Scenario: Preview-only evidence contributes context
- **WHEN** preview-only Arena or simulation evidence is present
- **THEN** the feature cache SHALL mark it as preview-only context or low-confidence competency evidence according to materialization policy.

### Requirement: Feature cache consumes path-round evidence
Student evidence feature cache SHALL consume governed control-correction path execution, deviation, terminal validation, and intervention outcome records.

#### Scenario: Path execution changes
- **WHEN** a student's control-correction path execution, deviation, or intervention outcome changes
- **THEN** the system SHALL refresh or enqueue refresh for that student's feature cache
- **AND** unrelated student cache entries SHALL NOT be rewritten.

#### Scenario: Cache rebuild includes path features
- **WHEN** the feature cache rebuilds for a student with control-correction path evidence
- **THEN** it SHALL derive deterministic feature groups for path adoption, completion, deviation, fallback, terminal validation, and intervention outcomes
- **AND** it SHALL include source windows, evidence counts, freshness, confidence, and privacy markers.
- **AND** diagnostic fixture accounts SHALL include enough path evidence for downstream consumers to distinguish missing path context from limited but available path context.

#### Scenario: Retry is processed
- **WHEN** the same path evidence event is processed more than once
- **THEN** the cache rebuild or refresh SHALL reuse dedupe keys or stable source references
- **AND** it SHALL NOT double-count adoption, completion, intervention acceptance, or competency contribution.

#### Scenario: Cache rebuild includes fixture Arena context
- **WHEN** the feature cache rebuilds for a diagnostic fixture account with Arena-related auxiliary learning evidence
- **THEN** the cache MAY include privacy-safe learning-context features derived from fixture LearningFacts
- **AND** it SHALL NOT treat fixture LearningFacts as official Arena score, validity, ranking, leaderboard, or official submission result evidence.

### Requirement: Mixed knowledge identity is a readable diagnostic marker
合法 `mixed-knowledge-identity` 状态标记 SHALL 被视为可读的跨版本可比性诊断，SHALL NOT 单独导致缓存结构校验失败或 `readState=stale`；缓存读取 SHALL 完整保留该标记与 `knowledgeIdentityCoverage`/`mergedAggregateComparability` 风险标注。

#### Scenario: Mixed-identity cache round-trips as ready
- **WHEN** 学生合格证据跨越多个知识命名空间或 revision，特征缓存写入后再经治理读取边界读取
- **THEN** 读取结果 SHALL 为 `ready`（在未真实过期且结构完整时）
- **AND** `confidence.markers` SHALL 保留 `mixed-knowledge-identity`，且 `singleVersionComparable=false` 的可比性标注 SHALL 随载荷保留

#### Scenario: Unknown marker values stay fail-closed
- **WHEN** 缓存载荷的状态标记包含未定义语义的未知值
- **THEN** 读取 SHALL 判定结构失效并返回 `stale`
- **AND** SHALL NOT 静默丢弃未知标记后继续返回 `ready`

#### Scenario: Genuinely expired or corrupted caches stay stale
- **WHEN** 缓存超过新鲜度窗口、schema 版本不匹配或载荷结构损坏
- **THEN** 读取 SHALL 返回对应的 `stale` 受限状态
- **AND** 本变更 SHALL NOT 改变这些既有失败路径的判定

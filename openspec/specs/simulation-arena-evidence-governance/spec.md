# simulation-arena-evidence-governance Specification

## Purpose
Define how simulation and Arena runtime records are cataloged, audited, and materialized as governed learning evidence while preserving source context and keeping high-frequency trace samples out of `LearningFact`.
## Requirements

### Requirement: Simulation and Arena evidence sources are cataloged
The system SHALL catalog simulation sessions/logs and Arena public experiments, virtual previews, official submissions, and official evaluation runs as governed evidence sources.

#### Scenario: Governance status is generated
- **WHEN** the admin governance status report is generated
- **THEN** simulation and Arena evidence sources SHALL report coverage, readiness, provenance, and traceability fields

#### Scenario: Session and log roles are distinct
- **WHEN** simulation sources are classified
- **THEN** `SimulationSession` SHALL be treated as the run/session envelope and `SimulationLog` SHALL be treated as attempt or activity detail, with separate readiness and traceability metadata


### Requirement: LearningFact stores compact summaries
The system SHALL materialize simulation and Arena learning evidence into `LearningFact` using compact summaries and source references rather than high-frequency trace samples. Arena virtual training facts SHALL retain the Arena task id, scenario id, preview boundary, official ineligibility, protocol version, trace reference, summary metrics, replay confidence, and governance profile.

#### Scenario: Virtual simulation run becomes learning evidence
- **WHEN** an Arena virtual simulation run is materialized into a learning fact
- **THEN** the learning fact SHALL include source id, run id, Arena task id, scene or scenario id, protocol version, trace reference, summary metrics, preview/official boundary, and governance profile
- **AND** its module attribution SHALL use the Arena task id when available

#### Scenario: High-frequency trace exists
- **WHEN** high-frequency samples are available for a simulation or Arena preview
- **THEN** the learning fact SHALL reference or summarize those samples without copying the complete sample array


### Requirement: Course context is preserved
The system SHALL preserve course, class, session, publication, and standalone launch context when simulation or Arena evidence is generated.

#### Scenario: Simulation launches from a lesson
- **WHEN** a simulation is launched from a DB BOPPPS lesson item
- **THEN** materialized evidence SHALL include the available course/class/session context


### Requirement: Arena preview evidence uses SimulationRun envelope
Governed Arena preview evidence SHALL use the canonical SimulationRun envelope as the platform reference while preserving Arena detail lineage.

#### Scenario: Governance status inspects preview runs
- **WHEN** governance status reports Arena preview readiness
- **THEN** it SHALL report whether each new preview has a SimulationRun envelope, Arena detail reference, owner user, replay metadata, summary metrics, and preview/official boundary metadata.

#### Scenario: Preview evidence is consumed
- **WHEN** a downstream evidence, teacher, profile, or Konling consumer uses an Arena preview result
- **THEN** it SHALL consume the SimulationRun envelope and summary
- **AND** it MAY follow the Arena detail reference only for authorized preview-specific drilldown.


### Requirement: Preview and official claims remain unmixed
The system SHALL prevent preview-only Arena runs from being presented as official evaluation or leaderboard evidence. A completed preview MAY provide a bounded, low-confidence learning-profile contribution only when its governed provenance and replay summary are retained.

#### Scenario: Preview-only evidence reaches LearningFact draft
- **WHEN** an Arena preview SimulationRun is converted into an evidence draft
- **THEN** the draft SHALL identify preview-only provenance, task attribution, and official ineligibility
- **AND** it SHALL apply the preview contribution policy rather than an official submission contribution
- **AND** it SHALL NOT use preview metrics as official score, rank, hard-constraint authority, or formal capability attainment


### Requirement: Simulation and agent evidence is staged before LearningFact
The system SHALL stage SimulationRun, Arena preview, and AgentToolRun outputs as governed evidence drafts before creating LearningFact records.

#### Scenario: Simulation run completes
- **WHEN** a SimulationRun completes with summary metrics and replay metadata
- **THEN** the system SHALL create or enqueue a user-scoped evidence draft with run reference, trace reference, summary metrics, provenance, confidence, privacy scope, and dedupe key.

#### Scenario: Agent tool run completes
- **WHEN** an AgentToolRun produces analysis, comparison, patch rationale, or report draft evidence
- **THEN** the system SHALL create or enqueue an evidence draft that references the AgentToolRun and any related SimulationRun
- **AND** model-authored narrative SHALL NOT directly become a high-confidence LearningFact without deterministic metrics or review policy.


### Requirement: Evidence materialization is idempotent
The system SHALL prevent duplicate evidence drafts and LearningFacts when run, tool, replay, or review events are retried.

#### Scenario: Same run is processed twice
- **WHEN** the materializer receives the same run and dedupe key more than once
- **THEN** it SHALL reuse or report the existing draft or fact
- **AND** it SHALL NOT double-count competency contribution.


### Requirement: Evidence outbox preserves causation
The system SHALL emit materialization events with correlation id, causation id, source run/tool id, owner user, and provenance metadata.

#### Scenario: Draft is created from agent-assisted simulation
- **WHEN** a draft is created from a Konling tool-assisted run
- **THEN** the outbox or event payload SHALL retain AgentSession, AgentToolRun, SimulationRun, owner user, and source provenance references.


### Requirement: Materialized evidence remains user-isolated
The system SHALL carry owner-user scope from source records into evidence drafts, LearningFacts, and downstream summaries.

#### Scenario: Evidence is queried by a student
- **WHEN** a student reads materialized simulation or agent evidence
- **THEN** the system SHALL return only evidence owned by that user.

#### Scenario: Evidence is aggregated by a teacher
- **WHEN** a teacher reads class evidence summaries
- **THEN** the system SHALL aggregate only students within authorized class scope and SHALL NOT expose raw private memory or raw high-frequency traces.


### Requirement: Simulation and Arena evidence supports path terminal validation
Governed simulation and Arena evidence SHALL expose privacy-safe validation summaries for control-correction learning paths.

#### Scenario: Path validation reads simulation evidence
- **WHEN** a control-correction path evaluates a simulation validation node
- **THEN** it SHALL consume governed SimulationRun or evidence summary references with task id, owner user, summary metrics, replay confidence, provenance, and confidence state
- **AND** it SHALL NOT scan or expose raw high-frequency trace payloads for normal validation.

#### Scenario: Path validation reads Arena evidence
- **WHEN** a control-correction path evaluates an Arena validation node
- **THEN** it SHALL distinguish preview, official submission, official evaluation, score, validity, replay confidence, and hidden-internal boundaries
- **AND** it SHALL NOT expose hidden official evaluation internals through path, student, or Konling payloads.


### Requirement: Simulation and Arena outcomes are linkable from path execution
Simulation, control workbench, and Arena evidence governance SHALL expose privacy-safe outcome references that adaptive path execution can bind to path nodes.

#### Scenario: Simulation result is used by a path
- **WHEN** a simulation run satisfies a path node or readiness condition
- **THEN** governance SHALL expose a path-bindable reference containing run id, trace or replay reference, key metrics, validation result, source scope, and replay confidence where applicable.

#### Scenario: Arena result is used by a path
- **WHEN** an Arena submission satisfies a path node or terminal validation condition
- **THEN** governance SHALL expose a path-bindable reference containing submission id, official or preview status, score, validity, evaluation summary, and policy version.

#### Scenario: Outcome cannot be linked
- **WHEN** a simulation, workbench, or Arena outcome exists but cannot be safely linked to the owning path and student
- **THEN** the path SHALL treat the result as unbound
- **AND** the source system SHALL provide a governance-visible reason without exposing private raw payloads to the student UI.


### Requirement: 仿真与 Arena 证据携带任务级来源语义
受治理的 Simulation、Arena、控制工作台和奥德赛证据 SHALL 携带稳定任务标识、带学生归属命名空间的产物标识、来源层级和可复核摘要，并由同一规范化产物身份约束实时写入和历史物化。ArenaEvaluationRun 只能作为已接受 ArenaSubmission 的关联评测证据，不能独立形成学生任务完成。

#### Scenario: 同一 Arena 产物跨入口到达
- **WHEN** 一个 Arena 产物通过工作台事件、正式评测或历史物化被重复处理
- **THEN** 系统将它归入同一稳定任务和产物身份
- **AND** 只保留最高证据层级
- **AND** 不创建重复的任务级贡献

#### Scenario: 未绑定提交的 Arena 评测不形成完成证据
- **WHEN** ArenaEvaluationRun 没有唯一关联到学生归属已确认且被接受的 ArenaSubmission
- **THEN** 系统不得将该评测表示为学生任务完成
- **AND** 历史物化记录明确跳过原因

#### Scenario: 教师预览不产生学生任务证据
- **WHEN** 教师或管理员预览仿真、Arena 或控制工作台
- **THEN** 系统不得将该操作物化为学生任务证据
- **AND** 预览记录不得改变任何学生的仿真任务状态


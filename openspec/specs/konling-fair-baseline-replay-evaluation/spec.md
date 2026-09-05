# konling-fair-baseline-replay-evaluation Specification

## Purpose
TBD - created by archiving change add-konling-fair-baseline-and-replay-evaluation. Update Purpose after archive.
## Requirements
### Requirement: Fair three-arm experiment assembly
The system SHALL assemble knowledge-question experiments as exactly three arms — plain-baseline, enhanced-baseline, and full-feature — that share the same question bank, model, sampling parameters, evidence context, and output budget, differing only in prompt capabilities, and SHALL leave the product default answer path unchanged. Experiment entrypoints SHALL select the bank version explicitly with the stratified bank as the default, and the legacy single-difficulty bank SHALL remain available for reproduction of frozen runs.

#### Scenario: Enhanced baseline matches feature arm requirements
- **WHEN** the experiment assembles system prompts for the three arms from one shared context
- **THEN** the enhanced-baseline and full-feature prompts require the same section titles and impose the same output budget
- **THEN** both arms receive the same evidence snippets
- **THEN** only the full-feature prompt contains the dedicated runtime lines: typed output contract, per-section unit citation mapping, and normative fail-closed guidance

#### Scenario: Plain baseline carries no structure contract
- **WHEN** the plain-baseline prompt is assembled
- **THEN** it contains no study-question section requirements and no output-contract lines

#### Scenario: Product default path is untouched
- **WHEN** no experiment runs
- **THEN** the product's study-question prompt assembly and structure evaluation behave exactly as before this capability, with the alias caliber as the default

#### Scenario: Bank version is explicit and frozen into provenance
- **WHEN** a run starts with either bank version
- **THEN** the manifest records the bank version and hash, and switching bank versions requires a new run identity rather than silently mixing banks

### Requirement: Resume-safe frozen answer snapshots
The system SHALL persist every generated answer as a frozen snapshot keyed by bank version, arm, item, and replicate, written atomically with first-writer-wins semantics under an exclusive run lease, and a single command SHALL run generation, scoring, and aggregation with resume from the last completed task.

#### Scenario: Interrupted run resumes without regeneration
- **WHEN** a run is interrupted and re-executed with the same runId and unchanged manifest
- **THEN** already-completed answers are neither regenerated nor overwritten
- **THEN** generation resumes from the first missing task key

#### Scenario: Concurrent writers cannot double-write
- **WHEN** two processes attempt to write the same task key
- **THEN** exactly one snapshot is published and the loser does not overwrite it

#### Scenario: Failed generation is explicit
- **WHEN** an external generation call fails
- **THEN** the attempt is recorded with a classified error code and the task remains resumable
- **THEN** a completed snapshot is never replaced by a later failure record

### Requirement: Scorer-caliber replay on fixed answers
The system SHALL score frozen snapshots deterministically under named scorer calibers and SHALL support replaying any saved batch of answers under additional calibers without invoking the generation model. Replay defaults SHALL pair the frozen previous alias caliber with the current alias caliber so the replay report separately presents the scorer-caliber delta between them.

#### Scenario: Replay never regenerates
- **WHEN** replay-scoring runs against an existing snapshot directory
- **THEN** no generation provider is called and no answer file is modified

#### Scenario: Calibers disagree on semantic headings
- **WHEN** one answer uses a semantically equivalent alias heading
- **THEN** the alias caliber counts the section as present
- **THEN** the strict-title caliber counts the same section as missing

#### Scenario: Alias caliber versions disagree on decorated headings
- **WHEN** an answer uses decorative-prefix headings such as `### 🔍 故障定位` and the frozen batch is replayed under the frozen and current alias calibers
- **THEN** the current alias caliber passes the structure evaluation for that answer
- **AND** the replay report SHALL contain a caliber delta comparing the frozen caliber with the current caliber on the same answers

#### Scenario: Default caliber is unchanged
- **WHEN** product code evaluates an undecorated answer without an explicit caliber
- **THEN** evaluation is identical to the frozen `structure-alias.v1` behavior, because decorative-prefix stripping is idempotent for undecorated headings

#### Scenario: Default caliber is the current alias caliber
- **WHEN** product code evaluates structure without an explicit caliber
- **THEN** evaluation uses the current version of the alias caliber family
- **AND** explicitly requesting the frozen previous alias caliber reproduces the pre-upgrade behavior

### Requirement: Paired difference reporting with components
The system SHALL report, for each metric and arm pair, the absolute value per arm, the percentage-point difference, a paired 95% confidence interval computed deterministically from a recorded seed, and the applicable direction, and SHALL report composite metrics only together with their component results, and SHALL separate generation-behavior deltas from scorer-caliber deltas.

#### Scenario: Composite includes components
- **WHEN** a composite pass rate is reported
- **THEN** each component rate is reported alongside it in the same record

#### Scenario: Confidence interval is reproducible
- **WHEN** aggregation runs twice on the same frozen records with the same recorded seed
- **THEN** the reported intervals are identical

#### Scenario: Deltas are attributed separately
- **WHEN** both arm differences and caliber differences exist
- **THEN** the summary reports generation deltas (same caliber, across arms) and caliber deltas (same answers, across calibers) in separate sections

### Requirement: Fail-closed provenance manifest
The system SHALL bind every experiment run to a manifest that records generation revision, scorer calibers and revisions, bank hash, model and provider, sampling parameters including seed, arm prompt versions, and completion status, and SHALL refuse to produce official summaries when the run is incomplete, mixed-configuration, or resumed against a drifted manifest.

#### Scenario: Incomplete run yields no official metrics
- **WHEN** any expected task key is missing or unexpected keys exist
- **THEN** the official summary is not written and the failure states the offending keys

#### Scenario: Manifest drift aborts resume
- **WHEN** a run is resumed with a changed bank hash or configuration
- **THEN** the resume fails explicitly instead of mixing provenance

#### Scenario: Mixed configuration is rejected
- **WHEN** completed records disagree on model, sampling parameters, or revisions
- **THEN** aggregation refuses official metrics and names the inconsistent dimension

### Requirement: 分类一致率的逐意图混淆分解

公平实验官方摘要的完整功能组分类一致率 SHALL 在总体率之外输出逐意图混淆分解：按题库标注意意分组报告实际路由意图分布与该组一致率。类别级失败（某意图全部误路由）SHALL 在摘要中可见，不得被总体准确率掩盖。

#### Scenario: 单一类别失败在摘要中可见

- **WHEN** 某次运行的完整功能组中某一题库意图的全部重复样本都被路由为同一错误意图，而其余意图全部命中
- **THEN** 官方摘要 SHALL 为该意图报告 0 一致率与非零误路由计数
- **AND** 总体一致率数值本身 SHALL 不作为唯一分类质量结论

#### Scenario: 分解按题库意图完整枚举

- **WHEN** 官方摘要包含分类一致率
- **THEN** 逐意图分解 SHALL 覆盖本次题库中出现的全部标注意图，每组报告样本数、命中数、一致率与路由分布

### Requirement: Stratified bank with risk-typed adversarial items
The system SHALL provide a versioned fair-experiment bank covering every study intent at foundational, integrative, and adversarial difficulty with distinct knowledge points per intent, and adversarial items SHALL carry one of the risk types (false premise, evidence conflict, normative currency, hidden defect, boundary condition, insufficient information) with reference answers that demonstrate the correct disposition of the risk. The bank hash SHALL cover the stratification annotations so the bank is frozen.

#### Scenario: Coverage matrix is complete
- **WHEN** the stratified bank is validated
- **THEN** every intent has exactly one item at each difficulty level with mutually distinct topics
- **AND** the six risk types each occur on at least one adversarial item

#### Scenario: Adversarial reference answers dispose the risk
- **WHEN** an adversarial item carries a risk type such as a false premise
- **THEN** its reference answer identifies the premise error, the conflicting evidence, the currency caveat, the hidden defect, the boundary behavior, or the missing information respectively, instead of answering the prompt at face value

### Requirement: Graded blind-audit rubric with dimension subscores
The system SHALL support a graded audit rubric that distinguishes correct answers, minor flaws, and major errors, and SHALL record five dimension subscores between 0 and 1 — factual accuracy, evidence faithfulness, pedagogical effectiveness, structure compliance, and trace coverage. Unparseable or semantically invalid graded verdicts SHALL fail closed as parse failures and never enter frozen official metrics. The legacy binary rubric SHALL remain frozen for replay of legacy banks.

#### Scenario: Graded verdict parsing is strict
- **WHEN** a graded verdict uses an unknown verdict enum, an out-of-range subscore, or a non-finite subscore
- **THEN** the verdict is rejected as a parse failure and the task stays resumable

#### Scenario: Legacy rubric replay is unchanged
- **WHEN** a run replays a legacy bank with the legacy rubric versions
- **THEN** the binary verdict semantics and scores are identical to the frozen pre-upgrade behavior

### Requirement: Discriminative official summary
The official summary SHALL report, per arm, the five dimension subscore means, the graded verdict distribution, the ceiling proportion (overall score at or above 0.95) and floor proportion (at or below 0.05), and stratified results by difficulty and intent with stratified paired differences and confidence intervals. The summary SHALL carry a fixed synthetic-data disclaimer stating that synthetic-experiment results MUST NOT be presented as real-learner effects or teaching-causality conclusions.

#### Scenario: Ceiling effect is visible
- **WHEN** one arm saturates with near-perfect overall scores
- **THEN** the summary reports a ceiling proportion that makes the saturation explicit instead of only a mean score

#### Scenario: Stratified paired differences stay deterministic
- **WHEN** aggregation runs twice on the same frozen records with the same recorded seed
- **THEN** the stratified paired differences and intervals are identical

### Requirement: Teacher expert dual-review calibration subset
The system SHALL derive a deterministic expert-review subset by stratified sampling of the bank, SHALL accept dual independent expert review records per subset item in the run directory, and SHALL report inter-reviewer agreement on graded verdicts together with the disagreement list marked as pending teacher resolution. Missing expert-review records SHALL be reported as a pending status without blocking the official summary.

#### Scenario: Agreement and disagreements are reported
- **WHEN** both reviewers' graded verdicts exist for the subset
- **THEN** the summary reports the agreement proportion and lists each disagreeing item with both verdicts and a pending-teacher resolution marker

#### Scenario: Missing reviews do not block aggregation
- **WHEN** no expert-review records exist for a completed run
- **THEN** the official summary is still produced and reports the expert-review subset as pending

### Requirement: 公平实验汇总确定性产出引用精确率与追溯覆盖率

三臂公平实验的正式汇总 SHALL 对每条冻结回答执行确定性 citation 审计，输出引用精确率（已呈现且成功核验、直接支撑对应主张的引用数 ÷ 已呈现引用数）与答案单元追溯覆盖率（具有至少一个直接支撑且成功核验引用的答案单元数 ÷ 需要证据的答案单元数），并按回答、意图与实验组分别统计。答案单元划分与分母规则 SHALL 与各意图的 citation policy 对齐：`model-derived` 章节不入追溯分母；占位符、未知编号、无法访问的目标与仅相关但不直接支撑的来源不得计为覆盖。真实引用、占位符、未核验引用与模型推导章节 SHALL 分别统计，不得混为一类。

#### Scenario: 审计不完整即 fail closed

- **WHEN** 任一回答缺失 citation 快照，或审计无法对全部（臂 × 题项 × replicate）完成
- **THEN** 汇总进入 `citation-audit` 阶段 incomplete，不写 official 汇总
- **AND** 已冻结回答与快照不被覆盖

#### Scenario: 两指标按臂输出并带配对区间

- **WHEN** 三臂审计完整且通过既有完整性门禁
- **THEN** official 汇总包含各臂引用精确率与追溯覆盖率绝对值
- **AND** 固定臂对输出配对百分点差与确定性种子的 95% 置信区间
- **AND** 每条回答保留已核验引用数、已呈现引用数、应引用单元数、已覆盖单元数及失败原因分桶

#### Scenario: 导出载体同源于冻结真源

- **WHEN** 从 run 汇总导出 CSV、工作簿或幻灯片
- **THEN** 全部载体由 `summary/official.json` 单一冻结真源派生，写前校验真源 complete 且内容一致
- **AND** 不存在绕过真源的第二套指标计算


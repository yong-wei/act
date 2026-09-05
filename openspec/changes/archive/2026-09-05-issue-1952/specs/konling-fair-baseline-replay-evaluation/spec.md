# konling-fair-baseline-replay-evaluation Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

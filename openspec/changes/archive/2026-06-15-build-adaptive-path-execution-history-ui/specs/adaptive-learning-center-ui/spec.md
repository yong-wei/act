## ADDED Requirements

### Requirement: Adaptive path execution shows the complete route
The adaptive learning center SHALL render selected paths as complete executable learning routes.

#### Scenario: Active path is shown
- **WHEN** a student has selected or resumed a path
- **THEN** the UI SHALL show `当前学习路径`, the full path map, the current node marked as `当前节点`, elapsed time, estimated remaining time, estimated total time, completed nodes, checkpoint pass state, and weekly learning.

#### Scenario: Node detail is shown
- **WHEN** a student focuses a path node
- **THEN** the UI SHALL show node title, recommendation reason, launch action, estimated time, evidence to collect, and checkpoint criteria where applicable.

### Requirement: Completed and unfinished node actions are governed
The adaptive learning center SHALL distinguish completed-node review/continuation from unfinished-node start/skip.

#### Scenario: Completed node is opened
- **WHEN** a student opens a completed node
- **THEN** the UI SHALL offer `回顾`, `继续互动`, and `查看证据`
- **AND** continued interaction SHALL create new governed evidence without double-counting the original completion.

#### Scenario: Unfinished node is skipped
- **WHEN** a student attempts to skip an unfinished resource
- **THEN** the UI SHALL show `跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。`
- **AND** skip SHALL be recorded as path deviation while allowing later return.

### Requirement: Adaptive path history uses student-facing evidence language
The adaptive learning center SHALL render path history and evidence records in product language.

#### Scenario: Path history is shown
- **WHEN** a student opens path history or evidence record
- **THEN** the UI SHALL show completed nodes, elapsed time, time delta, checkpoint pass rate, review count, new evidence, and timeline events
- **AND** evidence states SHALL use `已记录`, `待复核`, `可用于推荐`, or `仅作参考`.

### Requirement: Execution and history UI follows approved visual sources
The adaptive path execution and history UI SHALL use the accepted handoff and concept images as visual QA inputs.

#### Scenario: Visual evidence is reviewed
- **WHEN** this UI change is accepted
- **THEN** evidence SHALL cite `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`
- **AND** it SHALL compare rendered browser screenshots against `03-active-path-execution.png` and `04-history-evidence-record.png`
- **AND** an independent browser-capable visual subagent SHALL return PASS before completion.

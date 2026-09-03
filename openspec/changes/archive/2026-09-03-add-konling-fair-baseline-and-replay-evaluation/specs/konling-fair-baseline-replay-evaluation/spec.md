## ADDED Requirements

### Requirement: Fair three-arm experiment assembly
The system SHALL assemble knowledge-question experiments as exactly three arms — plain-baseline, enhanced-baseline, and full-feature — that share the same question bank, model, sampling parameters, evidence context, and output budget, differing only in prompt capabilities, and SHALL leave the product default answer path unchanged.

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
The system SHALL score frozen snapshots deterministically under named scorer calibers and SHALL support replaying any saved batch of answers under additional calibers without invoking the generation model.

#### Scenario: Replay never regenerates
- **WHEN** replay-scoring runs against an existing snapshot directory
- **THEN** no generation provider is called and no answer file is modified

#### Scenario: Calibers disagree on semantic headings
- **WHEN** one answer uses a semantically equivalent alias heading
- **THEN** the alias caliber counts the section as present
- **THEN** the strict-title caliber counts the same section as missing

#### Scenario: Default caliber is unchanged
- **WHEN** product code evaluates structure without an explicit caliber
- **THEN** evaluation is identical to the pre-existing alias behavior

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

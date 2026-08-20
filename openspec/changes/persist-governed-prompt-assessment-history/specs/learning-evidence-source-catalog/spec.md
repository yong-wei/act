## ADDED Requirements

### Requirement: Prompt assessment records remain context-only until separately governed
The governed evidence source catalog SHALL classify `PromptAssessment` quality and consistency records as learner-owned learning-process context by default. The source SHALL remain traceable but SHALL NOT be profile eligible unless a later specification declares source-specific quality governance and materialization rules.

#### Scenario: Prompt assessment is inspected by evidence governance
- **WHEN** the evidence source catalog or coverage report inspects `PromptAssessment`
- **THEN** it SHALL identify the record as student-owned prompt-evaluation process evidence
- **AND** it SHALL report the source as not profile eligible by default

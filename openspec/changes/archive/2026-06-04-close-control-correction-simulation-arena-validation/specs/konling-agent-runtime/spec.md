## ADDED Requirements

### Requirement: Konling corrects failed validation from governed evidence
Konling SHALL use governed simulation and Arena validation summaries when coaching a student after failed control-correction terminal validation.

#### Scenario: Validation failure triggers coaching
- **WHEN** a control-correction path records failed or low-confidence terminal validation
- **THEN** Konling SHALL be able to analyze the failure from authorized validation summaries, learner-state slice, path context, and instructional citations
- **AND** it SHALL propose a fallback or correction step without exposing hidden Arena internals, raw traces, or private memory.

#### Scenario: Evidence is insufficient for diagnosis
- **WHEN** validation evidence is missing, stale, preview-only, or low-confidence
- **THEN** Konling SHALL present the diagnosis as tentative
- **AND** it SHALL recommend evidence-gathering or fallback actions instead of claiming verified causality.

## ADDED Requirements

### Requirement: Generated report natural-language content is Simplified Chinese

The diagnosis generation contract SHALL require every model-generated natural-language field of the report body (summary, finding titles, finding summaries, and limitation descriptions) to be written in Simplified Chinese. Technical values such as evidence reference identifiers, enums, version identifiers, and timestamps are exempt. After the provider returns, the system SHALL run a deterministic language validation on those fields and SHALL treat a failed validation as a retryable model-behavior defect rather than persisting the report: the generation attempt SHALL fail with an explicit Chinese failure reason, the existing attempt budget SHALL retry the generation, and an English-dominant report body SHALL never be persisted as a successful report.

#### Scenario: Provider returns English content

- **WHEN** a provider response parses successfully but a natural-language field is English-dominant or contains no Chinese characters
- **THEN** the system SHALL reject the output, fail the attempt with `diagnosis-provider-language-mismatch`, and retry within the existing attempt budget
- **AND** the report SHALL NOT be persisted as successful while any attempt is language-invalid.

#### Scenario: Provider returns Simplified Chinese content

- **WHEN** a provider response parses successfully and every natural-language field is Simplified-Chinese dominant, including inline English technical terms
- **THEN** the system SHALL accept the report body and persist it through the ordinary governed path.

#### Scenario: Attempt budget is exhausted with language-invalid output

- **WHEN** every retry attempt returns language-invalid content
- **THEN** the generation job SHALL reach the failed state with the explicit Chinese language-failure reason
- **AND** the teacher SHALL be able to retry the job explicitly through the existing generation retry control.

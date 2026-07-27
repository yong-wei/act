## ADDED Requirements

### Requirement: Smart preparation builds a governed preparation resource pack
The source-pack service SHALL provide a smart-preparation consumer profile that retrieves only from authorized enabled uploaded documents and teacher-confirmed platform textbook ranges.

#### Scenario: Initial source selection is prepared
- **WHEN** a teacher starts or edits a smart-preparation task
- **THEN** all enabled uploaded documents in `可编辑` or `已冻结` state in the selected course basis SHALL be selected by default
- **AND** uploading, extracting, rejected, failed, and disabled versions SHALL be excluded or shown with their non-selectable reason
- **AND** platform textbooks SHALL be recommended from the course and topic but SHALL require teacher confirmation.

#### Scenario: Teacher selects platform textbook scope
- **WHEN** the teacher confirms a platform textbook book, chapter, or section range
- **THEN** retrieval SHALL remain bounded to the confirmed structural range
- **AND** returned citations SHALL preserve the textbook and structural anchors required by the unified reader.

#### Scenario: Preparation evidence is retrieved
- **WHEN** the resource pack retrieves evidence
- **THEN** it SHALL use the active hybrid lexical and vector candidate contract and external reranking contract
- **AND** it SHALL inject only the selected retrieved evidence rather than complete textbook files.

### Requirement: Preparation resource packs have teacher-readable source projections
The system SHALL label the user-facing Source Pack as `备课资源包` and SHALL explain that it is the set of materials used to support the current preparation.

#### Scenario: Resource-pack summary renders
- **WHEN** the teacher views source coverage
- **THEN** the UI SHALL show compact Chinese source states
- **AND** the teacher SHALL be able to expand each source to its document, chapter, section, and cited snippet when those levels exist.

#### Scenario: Preparation content source state renders
- **WHEN** a knowledge point, teaching goal, or generated teaching-content unit has source coverage
- **THEN** the UI SHALL display exactly one applicable primary state from `已关联依据`, `需要确认来源`, and `无可靠来源`
- **AND** expansion SHALL show the supporting document, structural location, and cited snippet without exposing internal retrieval identifiers.

#### Scenario: Internal contract is inspected
- **WHEN** services exchange the retrieval object
- **THEN** they MAY retain the internal `Source Pack` name
- **AND** user-facing preparation UI SHALL use `备课资源包`.

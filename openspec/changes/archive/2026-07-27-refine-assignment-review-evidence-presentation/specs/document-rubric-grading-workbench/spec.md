## MODIFIED Requirements

### Requirement: Grading UI is part of the workflow
The grading workbench SHALL support professional teacher review states while keeping the student's original response separate from AI-understanding artifacts.

#### Scenario: Teacher opens grading workbench
- **WHEN** a teacher opens a grading draft
- **THEN** the UI SHALL show converted document precision, evaluator limitations, criterion-level AI draft, teacher-edit controls, evidence anchors, approval state, and writeback preview.

#### Scenario: Teacher opens assignment grading workbench
- **WHEN** a teacher opens a grading draft for a question response
- **THEN** the UI SHALL show the rendered unified sealed-answer text and the exact sealed attachment identities in frozen submission order, the criterion-level AI draft, teacher-edit controls, approval state, and writeback preview
- **AND** the original-response region SHALL NOT show conversion text, provider status, technical error codes, or background processing details.

#### Scenario: Teacher reviews non-assignment document grading
- **WHEN** another governed document-grading workflow requires conversion precision, evaluator limitations, or evidence anchors
- **THEN** the workbench MAY retain those workflow-specific review details
- **AND** it SHALL NOT use them to replace the original assignment-response presentation contract.

## ADDED Requirements

### Requirement: Assignment review presents original evidence by format
The assignment grading workbench SHALL consume the unified response projection and present its sealed response body, exact attachment identities, frozen submission order and provenance through authorized, integrity-verified reads.

#### Scenario: Response body contains Markdown, formulas, or images
- **WHEN** the teacher opens the original response
- **THEN** the workbench SHALL render the saved body without changing its content order
- **AND** embedded images SHALL appear at their saved Markdown positions.

#### Scenario: Original attachment is PNG or JPEG
- **WHEN** an authorized teacher reviews the attachment
- **THEN** the workbench SHALL display the original image directly through the protected asset-read contract.

#### Scenario: Original attachment is PDF
- **WHEN** an authorized teacher reviews the attachment
- **THEN** the workbench SHALL provide an isolated inline PDF reader and an authorized open or download fallback.

#### Scenario: Original attachment is DOC, DOCX, or PPTX
- **WHEN** an authorized teacher reviews the attachment
- **THEN** the workbench SHALL display a numbered file card with an authorized open or download action
- **AND** it SHALL NOT display converted Markdown or extracted text as the student's original.

#### Scenario: Original attachment is Markdown or plain text
- **WHEN** an authorized teacher reviews the attachment
- **THEN** the workbench SHALL use the existing protected original-file card or direct-preview capability
- **AND** it SHALL NOT introduce a new complex reader or substitute grading-conversion output for the original.

### Requirement: Incomplete AI suggestions use non-technical review guidance
The workbench SHALL place evidence-incomplete guidance beside the affected AI suggestion, collect teacher confirmation, and submit the govern-owned approval parameters without implementing a parallel approval gate.

#### Scenario: Some attachments were not included in the suggestion
- **WHEN** a grading draft declares one or more understanding-unavailable attachments
- **THEN** the AI suggestion region SHALL state `部分附件未纳入本次建议，请结合原件核对` or equivalent non-technical wording
- **AND** it SHALL list the corresponding safe attachment names without provider names, conversion states, or error codes.

#### Scenario: Original answer has attachment-understanding failure
- **WHEN** the teacher views the student's original response
- **THEN** the response body, attachment order, and original-file controls SHALL remain unchanged
- **AND** the original-response region SHALL NOT annotate the attachment with conversion failure details.

#### Scenario: Teacher approves an incomplete-evidence suggestion
- **WHEN** the teacher attempts approval for an incomplete-evidence suggestion
- **THEN** the workbench SHALL require explicit confirmation and submit the current draft revision plus omitted attachment identities to the governed approval contract
- **AND** it SHALL present missing-confirmation or stale-revision rejection returned by that contract without implementing another server-side gate or audit path.

## MODIFIED Requirements

### Requirement: AI tasks must produce scoped outputs
The system SHALL map audited AI and Prompt actions to explicit task outputs such as practice tasks, feedback writeback, prompt evaluation results, or portfolio drafts. For portfolio-reflection Copilot turns, the client SHALL provide a bounded task descriptor and the server SHALL validate it before execution, then derive the output target and writeback boundary from the server-owned task contract.

#### Scenario: Report feedback AI creates practice task candidates
- **WHEN** AI is invoked for report feedback remediation
- **THEN** the UI shows scoped practice task candidates and an adopt/discard/writeback path

#### Scenario: Portfolio reflection creates draft
- **WHEN** a student uses Copilot or portfolio reflection create intent
- **THEN** the system creates or displays a draft/candidate object rather than returning to a generic AI page

#### Scenario: Portfolio reflection context reaches the server contract
- **WHEN** a portfolio-reflection Copilot request is sent
- **THEN** the request contains a bounded `auditTaskContext` with the reflection task type, source, assignment when present, and intent
- **AND** the server resolves `outputTarget=portfolio-draft`, `writebackBehavior=draft`, and explicit-save promotion from the task type before model execution

#### Scenario: Client cannot widen the reflection writeback boundary
- **WHEN** a client changes or adds output/writeback fields to a portfolio-reflection request
- **THEN** the server ignores fields not in the accepted descriptor or rejects conflicting output fields
- **AND** it never changes the resolved task contract to official learning facts, a portrait update, or an official score

#### Scenario: Invalid task context fails closed
- **WHEN** `auditTaskContext` is present but has an unsupported task type, missing required fields, or values outside the bounded input shape
- **THEN** `/api/ai/chat` returns a safe 400 response without invoking the model

#### Scenario: General chat remains compatible
- **WHEN** a request does not contain `auditTaskContext`
- **THEN** the server preserves the existing general page-context and evidence-summary behavior
- **AND** it does not infer a portfolio-reflection task from arbitrary message text

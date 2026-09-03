## MODIFIED Requirements

### Requirement: Evidence Copilot uses server-authorized evidence

Evidence Copilot SHALL build factual context from governed learning evidence authorized for the authenticated student. Only the resulting student-safe projection and any server-owned allowlisted entry semantics MAY be available as factual model context. Raw client-provided navigation hints SHALL NOT be serialized into the model's private factual/system context.

#### Scenario: Evidence context is requested

- **WHEN** an authenticated student opens `/ai/copilot?context=evidence` and sends a message
- **THEN** the server SHALL resolve the student's governed evidence using the authenticated identity
- **AND** only the resulting student-safe projection SHALL be available as factual model context
- **AND** the response metadata SHALL preserve evidence status and limitations
- **AND** the model context SHALL not contain raw client navigation-hint values

#### Scenario: Client changes the source hint

- **WHEN** the request changes `source`, `assignment`, or `intent` to describe another task or unsupported evidence
- **THEN** the server SHALL treat those values only as bounded navigation hints
- **AND** they SHALL NOT create, substitute, or expand student evidence facts or authorization scope
- **AND** the raw values SHALL NOT be inserted into the model's private factual/system context

#### Scenario: Navigation hint contains an instruction-shaped value

- **WHEN** an authenticated student supplies an instruction-shaped or delimiter-shaped value in `source`, `assignment`, or `intent`
- **THEN** the server SHALL either retain it only for bounded page navigation or reject it according to the existing request boundary
- **AND** the model invocation SHALL receive no raw copy of that value
- **AND** the server-owned evidence status, limitations, and advisory-only rules SHALL remain in force

#### Scenario: Navigation hint contains a control character

- **WHEN** a present `source`, `assignment`, or `intent` contains a Unicode control character
- **THEN** the request SHALL fail closed before model execution
- **AND** no model request SHALL be made for the invalid Evidence Copilot context

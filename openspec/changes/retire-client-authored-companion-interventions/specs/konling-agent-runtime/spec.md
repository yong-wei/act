## ADDED Requirements

### Requirement: Arena intervention persistence requires official submission evidence
The Konling runtime SHALL create a governed Arena control-workbench intervention only when the request carries a server-verified official submission reference owned by the authenticated student and scoped to the current task. Client-authored `StudentState`, parameters, metrics, outcome, task id or method MUST NOT be sufficient to create intervention evidence, Memory, feedback identity or cooldown state.

#### Scenario: Runtime receives only client-authored state
- **WHEN** the Arena intervention path receives attempt history or current state without a verified official submission reference
- **THEN** the runtime SHALL fail before creating an intervention, evidence record, Memory or feedback identity.

#### Scenario: Official submission scope does not match
- **WHEN** the referenced official submission belongs to another student or task, or its method cannot be resolved from the registered task
- **THEN** the runtime SHALL reject the request
- **AND** it SHALL not fall back to client-supplied state.

#### Scenario: Legacy row lacks official evidence
- **WHEN** an existing intervention was created without a verifiable official submission reference
- **THEN** the runtime SHALL exclude it from official baseline, follow-up and cooldown resolution
- **AND** it SHALL preserve the row for authorized historical audit unless separate retention governance removes it.

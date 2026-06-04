## ADDED Requirements

### Requirement: Path evidence emits governed evaluation events
The system SHALL emit shared adaptive-learning evaluation events for control-correction path execution, deviation, terminal validation, and intervention outcomes.

#### Scenario: Path event is emitted
- **WHEN** a path node starts, completes, fails, is abandoned, deviates, triggers fallback, reaches terminal validation, or records an intervention outcome
- **THEN** the event SHALL declare event type, actor, subject, source capability, payload version, occurred time, privacy level, confidence, and related path/resource/session references
- **AND** it SHALL use stable references rather than embedding raw execution payloads, raw dialogue, raw traces, or hidden Arena internals.

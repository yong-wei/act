## ADDED Requirements

### Requirement: One command executes and reports all required marine routes
The local entry point SHALL execute all required complete routes and produce actual numerical, visual and cost results without manual collection.

#### Scenario: An incomplete route is encountered
- **WHEN** A required route is a stub or lacks a core parity feature
- **THEN** The run fails that route instead of converting missing implementation into a successful keep-current-path conclusion.

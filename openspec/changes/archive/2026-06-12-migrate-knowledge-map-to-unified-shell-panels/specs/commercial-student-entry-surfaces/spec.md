## ADDED Requirements

### Requirement: Knowledge graph learner surface uses the unified knowledge-data shell
Knowledge graph learner and public surfaces SHALL use the unified knowledge-data-map shell without redefining the broader learner surface requirement.

#### Scenario: Public or authenticated learner opens knowledge graph
- **WHEN** a public learner, student, teacher, or administrator opens `/knowledge`
- **THEN** knowledge graph SHALL render the same primary shell family for public and authenticated states
- **AND** role-only actions SHALL be gated by authorization
- **AND** chapter directory, relation filters, legend, and node resource panels SHALL remain local graph tools rather than platform navigation.

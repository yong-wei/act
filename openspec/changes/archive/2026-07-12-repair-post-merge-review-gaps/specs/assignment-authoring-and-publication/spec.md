# assignment-authoring-and-publication Specification

## ADDED Requirements

### Requirement: Inactive classes are excluded from assignment publication

Assignment publication SHALL reject inactive class audiences before any
revision or audience mutation.

#### Scenario: Administrator selects an inactive class

- **WHEN** an administrator requests publication for a class whose `isActive`
  state is false
- **THEN** the server SHALL reject publication before freezing the revision or
  creating audience rows
- **AND** the inactive class SHALL NOT receive the assignment.

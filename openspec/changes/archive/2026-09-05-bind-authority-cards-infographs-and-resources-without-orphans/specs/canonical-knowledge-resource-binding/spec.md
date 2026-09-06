## ADDED Requirements

### Requirement: Active teaching resources cannot remain orphans
The active Teaching Projection resource inventory MUST bind every resource to at least one current Canonical Object under an explicit teaching role. Bindings to retired, missing, or non-current objects do not satisfy this gate. Inspector projection MUST skip empty titles instead of showing identity-mismatch for the whole node, and the package MUST still fail closed until titles and bindings are complete.

#### Scenario: Inventory contains an unbound resource
- **WHEN** a resource row in the active projection has no current canonical binding
- **THEN** projection publication SHALL fail closed
- **AND** the inspector SHALL not treat every other node as identity-mismatched because of that orphan

#### Scenario: Bound resource lacks a title
- **WHEN** a bound resource has a canonical id but a null or blank title
- **THEN** the inspector SHALL NOT list it as available
- **AND** the completeness gate SHALL fail until a human-readable title exists

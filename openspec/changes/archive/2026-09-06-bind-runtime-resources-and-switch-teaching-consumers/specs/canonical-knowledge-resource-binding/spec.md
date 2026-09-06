## MODIFIED Requirements

### Requirement: Active teaching resources cannot remain orphans
The active Teaching Projection resource inventory MUST bind every in-scope runtime resource to at least one current Canonical Object under an explicit teaching role, unless the resource is recorded on the exception ledger with a closed reason. Bindings to retired, missing, or non-current objects do not satisfy this gate. Inspector projection MUST skip empty titles instead of showing identity-mismatch for the whole node, and the package MUST still fail closed until titles and bindings are complete for every non-ledger resource. The product denominator is the runtime file set, not the git-tracked fixture set.

#### Scenario: Inventory contains an unbound resource
- **WHEN** a resource row in the active projection has no current canonical binding and is not on the exception ledger
- **THEN** projection publication SHALL fail closed
- **AND** the inspector SHALL not treat every other node as identity-mismatched because of that orphan

#### Scenario: Bound resource lacks a title
- **WHEN** a bound resource has a canonical id but a null or blank title
- **THEN** the inspector SHALL NOT list it as available
- **AND** the completeness gate SHALL fail until a human-readable title exists

#### Scenario: Genuine leftover is ledgered
- **WHEN** a resource has no corresponding overlay core after exact identity and one-to-one crosswalk checks
- **THEN** it SHALL be written to the exception ledger with an explicit reason
- **AND** it SHALL NOT be published as BOUND

## ADDED Requirements

### Requirement: Task-formed simulations enter the binding inventory
Published Arena tasks, Odyssey task levels, and control-workbench catalog tasks MUST appear as simulation resources in the active Teaching Projection. Classroom simulations that encode a lesson unit MUST bind to that unit's overlay cores.

#### Scenario: Lesson-unit classroom simulation is bound
- **WHEN** a simulation resource id encodes a lesson unit that overlay `nodeUnits` maps to one or more cores
- **THEN** the restage SHALL bind that simulation to those cores with role PRACTICES or EXPLAINS

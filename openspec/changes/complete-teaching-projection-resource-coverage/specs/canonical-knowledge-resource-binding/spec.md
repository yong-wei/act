## MODIFIED Requirements

### Requirement: Active teaching resources cannot remain orphans
The active Teaching Projection resource inventory MUST bind every in-scope runtime resource to at least one current Canonical Object under an explicit teaching role, unless the resource is recorded on the exception ledger with a closed reason. Bindings to retired, missing, or non-current objects do not satisfy this gate. Inspector projection MUST skip empty titles instead of showing identity-mismatch for the whole node, and the package MUST still fail closed until titles and bindings are complete for every non-ledger resource. The product denominator is the runtime file set, not the git-tracked fixture set. The no-orphan denominator MUST include cards, infographs, lessons, steps, handouts, exercises, media, extraction-source textbooks, and all task-formed simulations. The exception ledger MUST close to zero entries or to explicit reviewed exemptions only; an unexamined backlog MUST NOT satisfy this gate.

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

#### Scenario: Newly covered type is unbound
- **WHEN** an infograph, lesson, or step resource in the runtime file set has no current canonical binding and no explicit exemption
- **THEN** projection publication SHALL fail closed
- **AND** the completeness gate SHALL report that type's uncovered count

#### Scenario: Ledger holds entries without explicit exemption
- **WHEN** the exception ledger contains entries that lack an explicit reviewed exemption
- **THEN** the coverage gate SHALL fail closed
- **AND** the ledger backlog SHALL NOT be treated as closed

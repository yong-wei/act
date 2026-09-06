## ADDED Requirements

### Requirement: Expanded fitness budgets are generated on demand
Architecture fitness SHALL generate its expanded budget ledger with the existing generator from the existing baseline, allowlist and measurement inputs. It SHALL NOT require a Git-tracked copy of the expanded ledger or its companion checksum file.

#### Scenario: Fitness runs without an exported ledger
- **WHEN** the existing architecture fitness command runs with no generated ledger on disk
- **THEN** it SHALL evaluate the same budget records and preserve the existing qualification and violation outcomes
- **AND** it SHALL NOT create a tracked generated file or replace baseline budgets with candidate measurements.

#### Scenario: An operator exports expanded budgets
- **WHEN** the existing write-ledger option is explicitly requested
- **THEN** it SHALL export the same generated records to an ignored artifact location
- **AND** later checks SHALL use the source inputs rather than trust that exported copy.

#### Scenario: A retained input is missing or mismatched
- **WHEN** a required baseline, allowlist or measurement input is missing or mismatched
- **THEN** the existing input validation SHALL fail
- **AND** a cached or exported ledger SHALL NOT bypass the failure.

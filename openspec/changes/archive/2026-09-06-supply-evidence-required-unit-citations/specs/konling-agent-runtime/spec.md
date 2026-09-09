## ADDED Requirements

### Requirement: Evidence-required answer units receive per-unit source allocation

Konling SHALL allocate at least one directly supporting source to every `evidence-required` section of the answer intent contract before generation, and SHALL pass the per-unit allocation with citation identity, display number, citation target, locator info and source revision into the generation context.

#### Scenario: Allocation covers all required sections

- **WHEN** an answer intent has `evidence-required` sections and retrieval returns eligible candidates
- **THEN** each required section SHALL be assigned at least one source that passes the direct-support relevance whitelist
- **AND** the prompt SHALL render the allocation as a per-unit mapping of section title to assigned citation numbers.

#### Scenario: One source backs multiple related units

- **WHEN** a single source is genuinely relevant to multiple required sections
- **THEN** the same citation number MAY appear in several per-unit mappings
- **AND** each unit's relevance SHALL be judged independently, with per-citation-target dedup preserved, instead of mechanically copying one citation across units.

#### Scenario: Retrieval budget scales with required units

- **WHEN** an answer requires per-unit evidence allocation
- **THEN** the allocation layer SHALL request retrieval candidates scaled to the required-section count
- **AND** the global `konling-answer` retrieval profile defaults SHALL remain unchanged for answers without evidence-required sections.

#### Scenario: Baseline arms keep no citation capability

- **WHEN** the plain or enhanced baseline path generates an answer
- **THEN** no citation allocation, mapping, or citation context SHALL be injected
- **AND** existing citation-free behavior SHALL be preserved.

### Requirement: Citation coverage gaps get one bounded repair pass

Konling SHALL measure post-generation coverage with the existing answer-unit scan and direct-support caliber, and SHALL run at most one bounded repair pass for unbound required units before fail-closed downgrade.

#### Scenario: Repair remaps alternate sources

- **WHEN** generated answers leave required units without a bound direct-support citation while alternate allocated sources remain
- **THEN** Konling SHALL rewrite the unbound unit lines once with the alternate citation numbers
- **AND** the repair round and outcome SHALL be recorded in the citation snapshot.

#### Scenario: Repair failure stays fail closed

- **WHEN** the bounded repair pass still cannot bind a valid source to a required unit
- **THEN** Konling SHALL keep the existing citation-gap downgrade and SHALL NOT fabricate or renumber citations to raise coverage.

#### Scenario: Fabricated numbers remain zero

- **WHEN** allocation, generation, and repair complete
- **THEN** unassigned or fabricated citation numbers in the final answer SHALL be zero under the existing whitelist enforcement.

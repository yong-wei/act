## ADDED Requirements

### Requirement: Learner-state producers obey the active knowledge authority selector
Every governed knowledge-scoped producer MUST resolve one active knowledge authority and write through the corresponding fixed-identity adapter.

#### Scenario: Pre-cutover producer writes
- **WHEN** Legacy remains the active production authority
- **THEN** the producer SHALL continue using the Legacy adapter and MUST NOT create candidate Canonical facts

#### Scenario: Post-cutover producer writes
- **WHEN** the cutover transaction activates the Canonical authority
- **THEN** the producer SHALL use the Canonical identity adapter and MUST NOT dual-write Legacy identity

### Requirement: Historical learner-state projections remain revision-bound
Learner-state serving and audit paths MUST preserve the original knowledge revision for historical facts and derived records.

#### Scenario: Historical and Canonical facts coexist
- **WHEN** a cumulative learner view contains facts from both eras
- **THEN** each fact SHALL remain attributable to its own namespace and revision without rewriting the historical source

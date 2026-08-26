## ADDED Requirements

### Requirement: Local authenticated knowledge-workspace QA uses managed three-role fixtures
The knowledge-workspace product-QA harness SHALL exercise authenticated student, teacher, and administrator sessions. When both the capture target and its `DATABASE_URL` are loopback-local, the harness SHALL idempotently provision the canonical three-role test fixtures and pass their credentials only to its capture child process; it SHALL not require credential environment variables from its caller. A non-loopback capture target or database MUST NOT receive managed fixture writes; it SHALL require explicitly supplied credentials for every required role. Neither browser evidence nor generated QA artifacts SHALL contain credential values. The 320px initial Active Authority capture SHALL expose at least 160 CSS pixels of the actual graph canvas in the first viewport; a one-pixel intersection or a later post-selection screenshot SHALL NOT satisfy this requirement.

#### Scenario: Local product QA runs without credential variables
- **WHEN** the capture target and configured database are both loopback-local and no `KNOWLEDGE_QA_*` credentials are supplied
- **THEN** the test harness SHALL provision the canonical student, teacher, and administrator fixtures idempotently and inject them only into its capture child process
- **AND** its capture child SHALL authenticate all three roles before recording product-QA evidence
- **AND** the initial mobile Active Authority evidence SHALL record the visible canvas height before any graph selection

#### Scenario: Non-local product QA is requested
- **WHEN** the capture target or database is not loopback-local
- **THEN** the test harness SHALL not create or update any managed fixture account
- **AND** missing or incomplete explicit credentials SHALL fail the capture before browser evidence is written

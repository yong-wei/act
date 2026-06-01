## ADDED Requirements

### Requirement: Validation commands only scan owned project surfaces
Release validation commands SHALL avoid scanning embedded sample repositories, vendored examples, or unrelated evaluation fixtures unless a command explicitly targets them.

#### Scenario: Lint validation runs
- **WHEN** the default lint command is executed
- **THEN** it SHALL scan project-owned application, script, config, and test files
- **AND** it SHALL exclude `evaluate/**/*` and other non-project sample repositories.

### Requirement: Standalone validation scripts resolve repository modules deterministically
Standalone validation scripts SHALL resolve repository modules from the repository root or a stable alias rather than from the script directory by accident.

#### Scenario: Model render policy validation runs
- **WHEN** `test:model-render-policy` is executed from the repository root
- **THEN** it SHALL import the intended `src/lib/model-render-policy` module
- **AND** it SHALL not fail with a path-derived `MODULE_NOT_FOUND` error.

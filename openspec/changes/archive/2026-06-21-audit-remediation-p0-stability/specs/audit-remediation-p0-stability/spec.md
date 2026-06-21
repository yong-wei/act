## ADDED Requirements

### Requirement: P0 audit failures must become recoverable product states
The system SHALL resolve every P0 finding listed in the full-system audit for registration, empty lesson launch, teacher projection, and teacher prep-pack access before the corresponding audit item can be marked remediated.

#### Scenario: Registration validation does not crash
- **WHEN** a user submits `/register` with a short password matching the audit reproduction
- **THEN** the page shows field-level password guidance and no React runtime error overlay

#### Scenario: Empty lesson cannot launch
- **WHEN** a teacher saves or starts a lesson plan with zero lesson items
- **THEN** the system blocks launch with a repairable product message and no live classroom shows `1 / 0` or `Waiting for content...`

#### Scenario: Teacher projection hides implementation placeholders
- **WHEN** audited teacher projection routes are opened for representative course templates
- **THEN** the content area does not expose `Not found` as visible teaching material

#### Scenario: Prep-pack route recovers from missing backing data
- **WHEN** `/teacher/prep-packs` or a class-scoped prep-pack deep link lacks a pack, migration, or class context
- **THEN** the page returns a product recovery state instead of a 500 page

### Requirement: P0 remediation must update the audit ledger
The system SHALL treat the Product Design audit report as the persistent quality ledger and update the relevant report or chapter entries after remediation passes verification.

#### Scenario: Audit item is marked fixed after evidence exists
- **WHEN** the P0 remediation has passing automated or browser evidence
- **THEN** `artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/report.md` and the relevant chapter entries record the fixed status, evidence path, date, and validating change id

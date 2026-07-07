## ADDED Requirements

### Requirement: Interactive and UI test fixtures match current component contracts
Interactive, classroom, assessment, and AppShell typecheck repair SHALL update stale test fixtures to current component contracts without masking UI regressions.

#### Scenario: Interactive UI fixture cluster is repaired
- **WHEN** the interactive/UI cleanup runs
- **THEN** TypeScript errors in the scoped interactive, classroom, assessment route-state, tracking, and AppShell governance tests SHALL be eliminated
- **AND** manifest option fields, teacher controls, DOM shims, route props, tracking mocks, and user-role literals SHALL remain contract-valid.

#### Scenario: Product UI behavior is out of scope
- **WHEN** this change repairs TypeScript fixtures
- **THEN** it SHALL NOT redesign UI behavior or alter product flows unless a typed component contract is proven incorrect.

## MODIFIED Requirements

### Requirement: Shell visual evidence covers navigation states
Commercial UI visual evidence SHALL cover expanded, collapsed, and mobile drawer navigation states when a primary workspace shell is changed.

#### Scenario: Workspace shell PR is reviewed
- **WHEN** a PR changes the shared workspace shell or Arena shell
- **THEN** visual evidence SHALL include desktop expanded navigation, desktop collapsed navigation, mobile drawer navigation, light theme, dark theme, and representative first-viewport task visibility
- **AND** collapsed navigation evidence SHALL prove actual rail width, content expansion, accessible route labels, active state, and absence of duplicated visible labels
- **AND** missing evidence for any changed shell state SHALL fail the relevant governance mode.

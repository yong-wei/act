## ADDED Requirements

### Requirement: Visual QA covers theme parity and floating controls
Commercial UI governance SHALL require representative screenshot evidence for light theme, dark theme, responsive layout, and floating action dock placement when primary route frames are changed.

#### Scenario: A primary shell migration is reviewed
- **WHEN** a PR changes AppShell, route navigation, floating action dock, homepage, login, Interactive Learning, simulation, Control Workbench, learner profile, teacher, admin, or knowledge graph UI
- **THEN** visual evidence SHALL include representative desktop and 320px mobile screenshots in both light and dark themes where the route supports theme switching
- **AND** the evidence SHALL show that Konling and management/settings controls do not overlap page content, local toolbars, or each other.

### Requirement: Background browser capture is an accepted review method
The system SHALL allow background Playwright or equivalent browser capture as the default visual verification method for local UI review.

#### Scenario: Visual QA runs locally
- **WHEN** a UI migration needs visual evidence
- **THEN** the reviewer MAY use background browser automation against the local dev server to capture route screenshots without depending on Codex window size
- **AND** the captured artifacts SHALL identify route, theme, viewport, authentication role, and timestamp or run id.

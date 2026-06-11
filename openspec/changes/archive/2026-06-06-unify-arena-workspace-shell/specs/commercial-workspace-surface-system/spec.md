## ADDED Requirements

### Requirement: Workspace shell supports collapsible navigation
The system SHALL provide a unified workspace shell pattern for dense student workspaces with desktop expanded navigation, desktop collapsed navigation, sticky breadcrumb header, personal-center account action, and mobile drawer navigation.

#### Scenario: Desktop workspace shell expands and collapses
- **WHEN** a student opens a migrated workspace on a desktop-width viewport
- **THEN** the left navigation SHALL be available in expanded and collapsed states
- **AND** the collapsed state SHALL preserve route navigation through icons, accessible names, focus order, and active route indication
- **AND** the main workspace area SHALL expand without horizontal overflow.

#### Scenario: Mobile workspace shell uses a drawer
- **WHEN** a student opens a migrated workspace at 320px width
- **THEN** global workspace navigation SHALL move into an explicit drawer or sheet control
- **AND** the primary task content SHALL remain reachable without reading through all navigation entries.

### Requirement: Workspace visual assets are centralized
The system SHALL keep generated or hand-authored visual-world assets for workspace identity in a centralized platform asset directory rather than page-local route folders.

#### Scenario: Arena visual assets are added
- **WHEN** Arena shell, entry, empty-state, or challenge-card visuals require images or domain illustrations
- **THEN** those assets SHALL be stored under a single platform visual-world directory for Arena
- **AND** page components SHALL reference those assets through a consistent path or manifest
- **AND** the assets SHALL NOT be scattered inside Arena route, component, or test fixture directories.

#### Scenario: Visual assets render with UI text
- **WHEN** a generated image or illustration is used in the workspace shell or Arena cards
- **THEN** the asset SHALL NOT contain rendered instructional text, labels, or numbers that are needed for comprehension
- **AND** readable text SHALL be rendered by the application UI.

### Requirement: Workspace identity avoids emoji symbols
The system SHALL use the platform icon system, shared status semantics, and centralized visual assets for premium workspace identity instead of emoji-style symbols.

#### Scenario: Workspace navigation and cards render
- **WHEN** a migrated workspace displays navigation, route identity, task status, empty states, or primary actions
- **THEN** the UI SHALL use consistent icons, text, status markers, or centralized visual assets
- **AND** it SHALL NOT use emoji as functional module symbols, status symbols, or premium visual identity.

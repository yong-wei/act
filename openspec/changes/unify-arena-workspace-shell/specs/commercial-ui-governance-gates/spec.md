## ADDED Requirements

### Requirement: Governance enforces centralized workspace assets
Commercial UI governance SHALL require primary workspace visual assets to be stored in registered platform visual-world directories with narrow ownership and route usage metadata.

#### Scenario: Workspace UI adds visual assets
- **WHEN** a PR adds or changes generated images, SVGs, thumbnails, textures, or illustrations for Arena or another primary workspace
- **THEN** review evidence SHALL identify the centralized asset directory, affected routes, intended usage, and fallback behavior
- **AND** page-local scattered asset folders SHALL fail governance unless a temporary exception names the owning migration and removal condition.

### Requirement: Governance rejects emoji-based premium identity
Commercial UI governance SHALL reject emoji as functional or premium identity symbols in migrated primary workspaces.

#### Scenario: Migrated workspace UI is reviewed
- **WHEN** a PR changes navigation, cards, status modules, empty states, or task-entry UI for a migrated primary workspace
- **THEN** review SHALL confirm that module identity and status signals use approved icons, text, status semantics, or centralized visual assets
- **AND** emoji SHALL NOT be used as route icons, status icons, module symbols, or decorative premium identifiers.

### Requirement: Shell visual evidence covers navigation states
Commercial UI visual evidence SHALL cover expanded, collapsed, and mobile drawer navigation states when a primary workspace shell is changed.

#### Scenario: Workspace shell PR is reviewed
- **WHEN** a PR changes the shared workspace shell or Arena shell
- **THEN** visual evidence SHALL include desktop expanded navigation, desktop collapsed navigation, mobile drawer navigation, light theme, dark theme, and representative first-viewport task visibility
- **AND** missing evidence for any changed shell state SHALL fail the relevant governance mode.

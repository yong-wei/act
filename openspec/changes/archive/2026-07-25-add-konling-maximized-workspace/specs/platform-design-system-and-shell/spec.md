## ADDED Requirements

### Requirement: Platform layers prevent shell controls from obscuring Konling
The platform shell SHALL assign registered layer ownership to account controls, Konling side and maximized surfaces, overlays, and the floating dock.

#### Scenario: Account menu and Konling are visible
- **WHEN** the profile or account control shares the viewport with Konling
- **THEN** the account layer SHALL NOT cover Konling's header controls, message content, composer, or action cards.

#### Scenario: Konling maximized workspace opens
- **WHEN** the full-screen assistant opens
- **THEN** it SHALL own the modal workspace layer, safe-area layout, and keyboard focus
- **AND** closing or restoring SHALL return focus to the control that changed the mode.

#### Scenario: Representative route is tested
- **WHEN** Konling is exercised at desktop and mobile widths on shell and immersive routes
- **THEN** the floating dock, account controls, page actions, and Konling controls SHALL remain reachable without collision.

## ADDED Requirements

### Requirement: Owned interactive controls expose semantic intent
Owned UI controls SHALL use semantic HTML or equivalent accessibility metadata for their action, label, and keyboard behavior.

#### Scenario: Button renders outside an intentional submit flow
- **WHEN** a button performs local UI navigation, toggling, deletion confirmation, dialog control, or other non-submit behavior
- **THEN** it SHALL declare an explicit `type="button"`
- **AND** the change SHALL NOT alter intentional form submit buttons.

#### Scenario: Form control renders with a visible label
- **WHEN** an input, select, textarea, or custom control has a visible label
- **THEN** the label SHALL be programmatically associated with the control
- **AND** icon-only or visually-hidden controls SHALL expose an accessible name.

#### Scenario: Clickable surface performs an action
- **WHEN** a visual surface handles click interaction
- **THEN** it SHALL either use a semantic interactive element or expose keyboard-equivalent behavior and role semantics.

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

### Requirement: Owned media surfaces expose caption semantics or explicit exceptions
Owned video and audio surfaces SHALL expose caption metadata when caption assets exist, or document temporary caption exceptions with owner and removal conditions when the current media contract cannot provide captions.

#### Scenario: Media surface has no caption asset field
- **WHEN** a media component renders a dynamic video or audio source whose resource contract does not expose caption URLs
- **THEN** the component SHALL provide a non-empty temporary caption track explaining the missing caption asset
- **AND** the code SHALL document the responsible owner and the removal condition for replacing the placeholder.

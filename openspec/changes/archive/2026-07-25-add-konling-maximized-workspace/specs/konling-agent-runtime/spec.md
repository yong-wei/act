## ADDED Requirements

### Requirement: Konling supports side and maximized presentation modes
Konling SHALL open in the existing side-panel mode by default and SHALL provide controls to maximize into a full-screen workspace and restore to the side panel.

#### Scenario: User maximizes Konling
- **WHEN** the user activates maximize from the side panel
- **THEN** the assistant SHALL animate into a full-screen workspace
- **AND** the workspace SHALL show the conversation library on the left and the active conversation on the right at desktop width.

#### Scenario: User restores the side panel
- **WHEN** the user activates restore
- **THEN** Konling SHALL return to the side-panel geometry
- **AND** the active conversation SHALL remain selected.

### Requirement: Presentation changes preserve conversation continuity
Changing Konling presentation mode SHALL preserve active conversation state.

#### Scenario: Mode changes during an active conversation
- **WHEN** the user maximizes or restores while messages, draft input, streaming output, scroll position, or focus state exist
- **THEN** those states SHALL remain associated with the same conversation
- **AND** the runtime SHALL NOT create a new session or duplicate the active response.

#### Scenario: Reduced motion is requested
- **WHEN** the user's system requests reduced motion
- **THEN** the mode transition SHALL avoid nonessential animation while preserving the same layout result.

### Requirement: Maximized Konling remains usable on mobile
The maximized assistant SHALL provide mobile access to both conversation history and the active conversation.

#### Scenario: Maximized mode renders on a narrow screen
- **WHEN** the viewport cannot fit the history rail and conversation together
- **THEN** history SHALL be available through a drawer or equivalent compact navigation
- **AND** the message list and composer SHALL remain reachable without horizontal page scrolling.

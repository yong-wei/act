## ADDED Requirements

### Requirement: Inspection does not implicitly navigate or truncate the current overview
Selecting an overview node SHALL disclose its bounded published neighborhood without truncating the already visible desktop overview to a smaller legacy limit. Detail visibility SHALL be independent from selection and disclosed scope. Closing details SHALL only close details; returning to an overview SHALL be an explicit navigation action. Disclosed relation visibility SHALL be reflected by the filter state.

#### Scenario: Select a node in a 153-node overview
- **WHEN** a learner selects a node and its neighborhood arrives
- **THEN** all previously visible overview nodes SHALL remain available at their prior positions
- **AND** the initial-entry loading mask SHALL not reappear or wait for an impossible node-count condition

#### Scenario: Close an inspected neighborhood
- **WHEN** the learner closes the detail panel
- **THEN** the selection, disclosed scope, coordinates and camera SHALL remain unchanged
- **AND** a separate return action SHALL restore the domain overview when requested

### Requirement: Konling follows the current graph selection
The Active workspace SHALL publish current node selection through the existing Konling context boundary. Opening Konling SHALL immediately show the selected node, and changing the selection while Konling is open SHALL update that context. Clearing selection or leaving the workspace SHALL remove stale node context.

#### Scenario: Open Konling and then select another node
- **WHEN** node A is selected before Konling opens and node B is subsequently selected
- **THEN** Konling SHALL first show A and then B without requiring reopening or an additional click

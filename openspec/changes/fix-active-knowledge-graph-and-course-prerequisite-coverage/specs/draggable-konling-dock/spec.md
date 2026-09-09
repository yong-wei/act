## ADDED Requirements

### Requirement: Konling dock position persists across the platform
The shared Konling dock SHALL support pointer dragging and persist its position across routes and reloads in the same browser. It SHALL remain within the visible viewport and offer a keyboard-accessible reset to its default position.

#### Scenario: Drag then navigate and reload
- **WHEN** a learner drags Konling, visits another page, and reloads
- **THEN** the dock SHALL restore the saved position, constrained to the current viewport
- **AND** dragging SHALL NOT open the assistant or scroll the underlying graph

#### Scenario: Pointer click remains available
- **WHEN** pointer movement does not cross the drag threshold
- **THEN** activation SHALL open the selected control exactly once

#### Scenario: Viewport becomes smaller
- **WHEN** a stored position falls outside a resized or rotated viewport
- **THEN** the entire dock SHALL remain visible and its menu SHALL open inside the available area

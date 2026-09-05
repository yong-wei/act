## MODIFIED Requirements

### Requirement: Ordinary active nodes remain under live force ownership
Ordinary domain and neighborhood nodes SHALL enter the shared Force Graph runtime as movable seeded nodes. Automatic layout code MUST NOT assign `fx`, `fy` or `fz` before the first accepted settlement milestone. After that milestone, visible nodes SHALL keep settled coordinates as pins until an explicit reflow, newly disclosed affected scope, or user unpin-all. User drag SHALL pin and move only the dragged node and MUST NOT release other nodes back to force ownership. Hover MUST NOT assign or clear force pins.

#### Scenario: Domain overview settles
- **WHEN** a bounded concept overview enters 2D or 3D
- **THEN** force ticks SHALL move at least one unpinned node and separate collisions before settlement
- **AND** the resulting coordinates SHALL remain within the configured time and viewport budgets
- **AND** after the settlement milestone those visible nodes SHALL no longer drift

#### Scenario: User drags one node
- **WHEN** the user drags a settled node
- **THEN** only that node SHALL move
- **AND** every other visible node SHALL keep its settled coordinates

#### Scenario: User pins and unpins a node
- **WHEN** the user drags a node to a fixed location and later removes the pin
- **THEN** only the explicit pin SHALL own that node's free motion while active
- **AND** unpinning SHALL return that node to force ownership without resetting unrelated nodes

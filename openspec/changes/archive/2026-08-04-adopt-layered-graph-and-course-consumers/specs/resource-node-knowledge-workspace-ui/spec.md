## MODIFIED Requirements

### Requirement: Knowledge workspace supports ResourceNode-aware exploration
The workspace MUST distinguish Engineering Authority nodes/relations from ACT teaching prerequisites and teaching resource bindings. Resource links, scope, projection identity, and fallback status SHALL be shown as separate evidence groups.

#### Scenario: Node has teaching resources
- **WHEN** a selected Canonical node has scoped bindings
- **THEN** the inspector SHALL show course/handout/step/textbook/card resources with role and projection provenance
- **AND** engineering relation details SHALL remain exact and separate

#### Scenario: Node is not projected to a course
- **WHEN** a valid Authority node has no binding in the current course scope
- **THEN** the workspace SHALL show `NOT_PROJECTED` for that scope
- **AND** it SHALL not imply an upstream graph defect

### Requirement: Partial ResourceNode coverage is explicit
Missing teaching resources or cards MUST be represented as scoped status, not as missing Canonical nodes. The workspace MAY use a Legacy/pinned fallback only when the status identifies the fallback identity.

#### Scenario: Optional card is absent
- **WHEN** a step Canonical ref has no active optional card
- **THEN** the drawer SHALL show the node summary or other linked resources
- **AND** it SHALL not display a node-not-found error

### Requirement: Knowledge workspace launches real learning resources
Course/resource actions MUST carry the active course scope and projection identity to the existing resource route, and a fallback action MUST preserve its explicit Legacy/pinned provenance.

#### Scenario: Resource action opens
- **WHEN** a learner opens a projected handout or interactive step
- **THEN** the target SHALL resolve through the existing course/resource registry
- **AND** the action SHALL not invent a route from an ActKG node ID

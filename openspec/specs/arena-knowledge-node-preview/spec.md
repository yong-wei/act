## Purpose
Define how Arena related knowledge references real knowledge graph nodes and presents previews.

## Requirements

### Requirement: Arena related knowledge uses real knowledge node ids
Arena challenge objects SHALL store related knowledge as references to real knowledge graph node ids.

#### Scenario: Related knowledge reference resolves
- **WHEN** an Arena challenge object declares a related knowledge item
- **THEN** the item SHALL include a `nodeId`
- **AND** the `nodeId` SHALL exist in `course-content/runtime/knowledge/graph/nodes.json`.

#### Scenario: Search still works by display label
- **WHEN** the Arena hall filters tasks by query text
- **THEN** related knowledge display labels SHALL remain searchable
- **AND** search SHALL NOT depend on raw node ids.

### Requirement: Related knowledge opens a preview panel
The challenge detail page SHALL let students open a knowledge preview from each related knowledge item.

#### Scenario: Preview opens from knowledge card
- **WHEN** a student clicks a related knowledge item on a challenge detail page
- **THEN** the page SHALL fetch `/api/knowledge/nodes/[id]`
- **AND** it SHALL display a preview containing node name, description, chapter, tags, and relation metadata when available.

### Requirement: Knowledge cards and infographs are shown when available
The knowledge preview SHALL surface the existing knowledge card and information graphic resources for the selected node.

#### Scenario: Knowledge card is available
- **WHEN** the selected node has a knowledge-card resource
- **THEN** the preview SHALL provide a way to open the existing knowledge card dialog.

#### Scenario: Infograph is available
- **WHEN** the selected node has an infograph resource
- **THEN** the preview SHALL render the infograph image or provide the same enlarged infograph view used by existing knowledge components.

### Requirement: Missing node data fails gracefully
The challenge detail page SHALL not render broken clickable knowledge items when a node id cannot be resolved.

#### Scenario: Node id is missing
- **WHEN** a related knowledge item references a node id that is absent from the runtime graph
- **THEN** automated validation SHALL fail
- **AND** the UI SHALL fall back to non-clickable text only if runtime data becomes unavailable after validation.

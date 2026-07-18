## ADDED Requirements

### Requirement: Knowledge graph progressive loading evidence is required
Commercial UI governance SHALL verify that the knowledge graph first render, expansion, and background loading behavior match the progressive graph-loading contract.

#### Scenario: Knowledge graph first-render evidence is captured
- **WHEN** `/knowledge` visual or browser evidence is produced
- **THEN** evidence SHALL show top-level collapsed graph roots visible before any full graph payload is requested, parsed, or completed
- **AND** evidence SHALL include root count, graph version, first-screen payload identity, and whether the full graph endpoint was avoided during first render.
- **AND** evidence SHALL cover 1440px, 1279px, 1100px, 1024px, and 320px viewports.

#### Scenario: Node expansion evidence is captured
- **WHEN** `/knowledge` expansion behavior is reviewed
- **THEN** evidence SHALL show a collapsed node exposing an expand action, a pending local loading state when data is missing, and an expanded node exposing a collapse action
- **AND** the evidence SHALL show that collapsing hides descendants without clearing the cache or losing selected-node context.
- **AND** the evidence SHALL show keyboard activation, `aria-expanded` or equivalent state, `aria-busy` or equivalent loading status, and focus continuity after asynchronous expansion.

#### Scenario: Filtered-empty expansion evidence is captured
- **WHEN** `/knowledge` expansion behavior is reviewed under a filter that hides all children for an expanded node
- **THEN** evidence SHALL show a visible local empty or filtered-out explanation
- **AND** the evidence SHALL distinguish the filtered-empty state from loading failure.

#### Scenario: Background loading evidence is captured
- **WHEN** progressive graph loading is reviewed
- **THEN** evidence SHALL show active-filter shards loading after first paint and remaining graph shards loading only after root rendering is usable
- **AND** evidence SHALL prove that panning, selection, local tools, and Konling entry remain usable while background loading proceeds.
- **AND** evidence SHALL include structured overlap or bounding-rectangle checks for opened local graph tools, selected-node inspector, expanded Konling, floating dock, and expansion loading state.
- **AND** evidence SHALL show focus return, dock avoidance, and selected-node context retention while background parsing and merging proceed.

### Requirement: Knowledge graph progressive loading has automated regression gates
Commercial UI governance SHALL reject regressions that return the knowledge graph to full-payload-first behavior.

#### Scenario: Regression test inspects network behavior
- **WHEN** automated tests run for `/knowledge`
- **THEN** they SHALL fail if first render requests, parses, or depends on `/api/knowledge/graph` full-payload behavior before root nodes are visible
- **AND** they SHALL verify that root, expansion, and shard requests have bounded payload identities and stable cache keys.

#### Scenario: Dense mode is inspected
- **WHEN** automated tests run dense or all-relation exploration for `/knowledge`
- **THEN** they SHALL fail if dense mode uses the full graph endpoint as the normal user-facing loading path
- **AND** they SHALL verify that missing dense data is loaded through remaining graph shards.

#### Scenario: Duplicate loading is detected
- **WHEN** the user changes filters, expands nodes, collapses nodes, and expands them again
- **THEN** governance checks SHALL fail or report a blocking issue if already loaded shards are fetched again without a graph-version change
- **AND** duplicate node or link objects SHALL NOT be accepted as a valid cache merge result.

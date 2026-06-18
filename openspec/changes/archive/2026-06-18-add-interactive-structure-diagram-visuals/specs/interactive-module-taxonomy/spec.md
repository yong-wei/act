## ADDED Requirements

### Requirement: Block diagram is a registered visual module
The interactive module taxonomy SHALL support `visual.blockDiagram` for control-system structure diagrams.

#### Scenario: Block diagram is authored
- **WHEN** a runtime manifest declares `kind: visual.blockDiagram`
- **THEN** the registry SHALL validate nodes, edges, labels, positions, interaction mode, and reveal metadata
- **AND** the renderer SHALL use the shared visual runtime rather than a lesson-private SVG or screenshot.

#### Scenario: Block diagram requires interaction
- **WHEN** a block diagram asks students to select, construct, diagnose, or compare a structure
- **THEN** a static image SHALL NOT satisfy the manifest contract
- **AND** validation SHALL require structured nodes and edges that can produce evidence.

### Requirement: Signal flow graph is a registered visual module
The interactive module taxonomy SHALL support `visual.signalFlowGraph` for signal-flow graph reading and Mason formula mapping.

#### Scenario: Signal flow graph is authored
- **WHEN** a runtime manifest declares `kind: visual.signalFlowGraph`
- **THEN** the registry SHALL validate nodes, directed branches, gain labels, path sets, loops, non-touching loop groups, and reveal plan metadata
- **AND** the renderer SHALL support shared path and loop highlighting.

#### Scenario: Mason formula is shown
- **WHEN** a signal-flow graph page displays Mason formula terms
- **THEN** each visible path or loop term SHALL be traceable to graph path ids or loop ids
- **AND** acceptance SHALL fail if a table of terms replaces required graph highlighting.

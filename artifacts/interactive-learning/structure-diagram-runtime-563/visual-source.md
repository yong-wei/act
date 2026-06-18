# Structure Diagram Runtime Visual Source

- Change: `add-interactive-structure-diagram-visuals`
- Issue: `#563`
- Route: `/review/structure-diagram-runtime-563`
- Components: `visual.blockDiagram`, `visual.signalFlowGraph`

The fixture renders a closed-loop block diagram and a matching signal-flow graph from native manifest payloads. It verifies semantic nodes, directed edges, forward paths, loops, Mason formula traceability, and teacher diagnostics without static image fallback.

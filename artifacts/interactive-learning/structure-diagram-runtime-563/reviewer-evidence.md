# Structure Diagram Reviewer Evidence

- Shared runtime renderer handles both `visual.blockDiagram` and `visual.signalFlowGraph`.
- Registry gate rejects missing graph ids, duplicate graph element ids, invalid endpoints, static-image-only interactive payloads, invalid reveal targets, and untraceable Mason terms.
- Evidence contract records selected nodes, paths, loops, constructed graph state, connection differences, teacher reveal state, feedback, and teaching labels.

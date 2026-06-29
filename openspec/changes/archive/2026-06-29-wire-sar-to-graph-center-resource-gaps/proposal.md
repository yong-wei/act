## Why

Graph Center already reports K/A/Q nodes, overlays, and resource coverage. Teachers and administrators need to see not only missing coverage counts, but also why candidate resources or evidence are associated with a node. SAR provides associated evidence and trace without automatically changing graph or resource bindings.

## What Changes

- Add associated retrieval detail to selected Graph Center nodes.
- Add a resource-gap candidate mode backed by SAR association trace.
- Mark candidate bindings as draft/suggested only.
- Preserve student/teacher/admin visibility boundaries.

## Impact

- Extends `structured-associative-retrieval`.
- Extends `graph-resource-coverage-overlay`.
- Depends on SAR projection and expansion.

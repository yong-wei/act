## ADDED Requirements

### Requirement: Formula labels share the force-owned semantic label layer
The shared 2D and 3D Force Graph runtime SHALL render active Formula expressions through the same semantic DOM label layer used for governed titles. Expression, bounded human context, accessibility and LOD SHALL remain one node-owned presentation.

#### Scenario: Formula is visible in 2D and 3D
- **WHEN** the same Formula node is materialized in either dimension
- **THEN** both dimensions SHALL render the same governed expression and accessible meaning
- **AND** switching dimension SHALL not fetch detail, change formula identity or create a second graph node

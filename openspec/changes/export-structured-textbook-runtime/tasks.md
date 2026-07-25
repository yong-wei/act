## 1. Runtime Contract

- [ ] 1.1 Define the versioned structure-unit, retrieval-window, fragment-anchor, navigation-index, and export-manifest schemas
- [ ] 1.2 Add declarative parser configurations for all six textbooks and the reference collection
- [ ] 1.3 Define deterministic identifiers from textbook edition and structural paths without a legacy mapping registry

## 2. Deterministic Export

- [ ] 2.1 Implement heading and numbering parsing that emits non-overlapping structure units with ancestor context
- [ ] 2.2 Implement formula, figure, and table anchors within their owning structure units
- [ ] 2.3 Generate overlapping retrieval windows whose segments retain their owning structure-unit identifiers
- [ ] 2.4 Generate hierarchical navigation and byte-offset content indexes for downstream retrieval and reading

## 3. Structure Review Loop

- [ ] 3.1 Detect oversized, undersized, empty, discontinuous, and unexpectedly nested structure units
- [ ] 3.2 Produce per-chapter distributed samples covering deepest units, boundaries, numbering sequences, and size extremes
- [ ] 3.3 Review detected anomalies and samples, then repair confirmed authoring-source defects or parser configurations
- [ ] 3.4 Re-export affected sources until deterministic structure checks pass without unresolved ambiguity

## 4. Temporary V2 Runtime

- [ ] 4.1 Export a non-production v2 runtime artifact for all seven source collections
- [ ] 4.2 Verify every structure unit, retrieval-window segment, navigation entry, and fragment anchor resolves within the same export
- [ ] 4.3 Record export counts, anomaly disposition, source hashes, and runtime schema version in the manifest
- [ ] 4.4 Add parser, identifier-stability, structure-boundary, and full-export regression tests

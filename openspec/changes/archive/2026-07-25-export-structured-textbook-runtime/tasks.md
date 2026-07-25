## 1. Runtime Contract

- [x] 1.1 Define the versioned structure-unit, retrieval-window, fragment-anchor, navigation-index, and export-manifest schemas
- [x] 1.2 Add declarative parser configurations for all six textbooks and the reference collection
- [x] 1.3 Define deterministic identifiers from textbook edition and structural paths without a legacy mapping registry

## 2. Deterministic Export

- [x] 2.1 Implement heading and numbering parsing that emits non-overlapping structure units with ancestor context
- [x] 2.2 Implement formula, figure, and table anchors within their owning structure units
- [x] 2.3 Generate overlapping retrieval windows whose segments retain their owning structure-unit identifiers
- [x] 2.4 Generate hierarchical navigation and byte-offset content indexes for downstream retrieval and reading

## 3. Structure Review Loop

- [x] 3.1 Detect oversized, undersized, empty, discontinuous, and unexpectedly nested structure units
- [x] 3.2 Produce per-chapter distributed samples covering deepest units, boundaries, numbering sequences, and size extremes
- [x] 3.3 Review detected anomalies and samples, then repair confirmed authoring-source defects or parser configurations
- [x] 3.4 Re-export affected sources until deterministic structure checks pass without unresolved ambiguity

## 4. Temporary V2 Runtime

- [x] 4.1 Export a non-production v2 runtime artifact for all seven source collections
- [x] 4.2 Verify every structure unit, retrieval-window segment, navigation entry, and fragment anchor resolves within the same export
- [x] 4.3 Record export counts, anomaly disposition, source hashes, and runtime schema version in the manifest
- [x] 4.4 Add parser, identifier-stability, structure-boundary, and full-export regression tests

## 5. Review Remediation

- [x] 5.1 Replace type-wide anomaly disposition with exact per-book anomaly and sample review ledgers
- [x] 5.2 Fail before runtime writes when relevant inputs are dirty or reviews remain unresolved
- [x] 5.3 Preserve duplicate natural fragment anchors with deterministic occurrence suffixes
- [x] 5.4 Parse Chinese worked examples and explicit solution/proof boundaries as minimal units
- [x] 5.5 Group numbering samples by parent, kind, and natural prefix and persist review evidence
- [x] 5.6 Add a reproducible JSON Schema validation CLI and regression coverage
- [x] 5.7 Generate and schema-validate the full written runtime from a clean committed revision

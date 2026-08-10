# ACT Teaching Prerequisites (authoring)

ACT-owned core-node denominator and teaching prerequisite publication for issue #1270.

- **Module**: `src/lib/teaching-projection/prerequisites/`
- **Contract**: `act-teaching-core-nodes/v1`, `act-teaching-prerequisite-edges/v1`, `act-teaching-prerequisite-publication/v1`
- **Runtime / staged output**: versioned under a local projection store (not Engineering Authority)

## Layout

| Path | Purpose |
|------|---------|
| `schemas/core-nodes.schema.json` | Core-node denominator schema |
| `schemas/prerequisite-edges.schema.json` | Direct ACT_TEACHING edge schema |
| `inventory/core-nodes.yaml` | Initial candidate core inventory |
| `inventory/edges.yaml` | Candidate teaching edges |
| `fixtures/` | Engineering / textbook / lesson candidate fixtures and valid publish seed |

## Publication rules

- Core nodes enter only via objectives, primary `COVERS`, prerequisite endpoints, or teacher curation.
- Published edges require `layer: ACT_TEACHING`, `relationType: PREREQUISITE`, strength, scope, evidence or curator rationale, and one author decision bound to the current Authority/Projection capture.
- Engineering relations, textbook order, and lesson order remain **candidates only**.
- REQUIRED graph must be acyclic and endpoint-closed; failures preserve the prior publication.

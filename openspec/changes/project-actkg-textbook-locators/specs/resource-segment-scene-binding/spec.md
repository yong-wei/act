## MODIFIED Requirements

### Requirement: Textbook sections and reviewed media projections bind to graph nodes
An ACT textbook section binding MUST reference public ActKG `SourceDocument` and `SourceAnchor` identities, exact locator metadata, the current Canonical ID, Authority release, and projection capture. The binding MUST preserve `EXPLAINS` as an ACT teaching role and MUST NOT rewrite upstream graph relations.

#### Scenario: One section explains multiple nodes
- **WHEN** one valid section locator lists multiple Canonical IDs
- **THEN** the builder SHALL emit one deterministic binding per Canonical ID
- **AND** all rows SHALL retain the same section identity and evidence

#### Scenario: Locator crosses captures
- **WHEN** the source document, anchor, or sidecar row belongs to another release/capture
- **THEN** the binding SHALL fail closed and remain out of the active projection

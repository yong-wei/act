## Purpose

Define Graph Center as a role-scoped action surface for graph nodes, goals, overlays, resource coverage, and governance diagnostics while keeping the canonical graph catalog read-only.
## Requirements
### Requirement: Retained evidence consumers omit retired graph actions
The system SHALL retain the evidence and resource coverage consumed by Konling and teacher K/A/Q trace without constructing or exposing retired Graph Center action arrays.

#### Scenario: Existing evidence consumers build graph context
- **WHEN** Konling or an authorized teacher requests the existing graph evidence context
- **THEN** resource coverage, learner and class overlays, SAR evidence and limitations SHALL retain their existing semantics
- **AND** the internal payload SHALL omit the retired action arrays and their route construction
- **AND** authorization, redaction and small-population suppression SHALL remain enforced.


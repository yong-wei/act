# canonical-knowledge-resource-binding Specification Delta

## ADDED Requirements

### Requirement: Formally bound resources are launchable citation targets for Konling
A resource that is formally bound in the active Teaching Projection SHALL be eligible to become a clickable Konling citation target. Its citation href MUST be derived from the same versioned and capture-coherent identity that governs the binding: textbook resources resolve through the version-bound textbook reader handle, database resources through the governed resource route, and registry resources through the governed launch or render target. A resource whose binding identity has drifted from the active release MUST degrade to a limited citation state rather than resolve to a stale target.

#### Scenario: Bound resource becomes a citation target
- **WHEN** a resource with a current formal binding in the active Teaching Projection is linked in a Konling answer context
- **THEN** the citation resolver SHALL derive its href from the resource identity kind under the active binding envelope
- **AND** the citation SHALL carry the resource's stable identity and binding version lineage

#### Scenario: Binding version drifts after the answer context was built
- **WHEN** a citation target's version-bound handle or registry revision no longer matches the active release at click time
- **THEN** the citation SHALL degrade to a limited or unavailable state
- **AND** it SHALL NOT navigate to a target captured under a superseded binding envelope

#### Scenario: Exception-ledger resource is not launchable
- **WHEN** a resource exists in the projection inventory only through an exception-ledger entry without a formal binding
- **THEN** it SHALL NOT be offered as a clickable Konling citation
- **AND** it MAY appear only as non-link grounding text when otherwise in scope

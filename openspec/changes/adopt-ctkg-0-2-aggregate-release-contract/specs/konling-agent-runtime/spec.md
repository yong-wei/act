## MODIFIED Requirements

### Requirement: Konling uses candidate Canonical page context
When Konling is invoked from the candidate graph, it MUST receive the aggregate ReleaseSet identity and projection digest, selected Canonical Object, graph filters, actual candidate coverage, release tier, and explicit teaching-semantics availability state.

#### Scenario: Selected aggregate object is explained
- **WHEN** the user asks about a selected Canonical Object in `control-theory-engineering-v0.2`
- **THEN** Konling SHALL use its Canonical ID, aggregate ReleaseSet, exact typed relations, and available public provenance rather than searching Legacy nodes by label

#### Scenario: Teaching semantics are unavailable
- **WHEN** the aggregate release does not yet provide prerequisite, containment, or related formal Teaching Projection semantics required by the request
- **THEN** Konling SHALL expose that limitation and SHALL NOT infer those relations from display order, Legacy graph, or resource similarity

#### Scenario: Historical candidate context is encountered
- **WHEN** a stored conversation turn references the prior root-locus ReleaseSet
- **THEN** the runtime SHALL retain that turn as history but SHALL bind a new candidate-graph turn to the current aggregate ReleaseSet without merging their objects or provenance

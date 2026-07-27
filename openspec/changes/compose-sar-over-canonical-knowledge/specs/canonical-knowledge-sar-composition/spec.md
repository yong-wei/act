## ADDED Requirements

### Requirement: SAR composes authority domains at query time
SAR MUST query AuthoritativeKnowledgeRepository and ACT KAQ, resource, path, and learner-state overlays through their public boundaries rather than copying them into one authoritative graph.

#### Scenario: Multi-domain query runs
- **WHEN** a query requires knowledge, resource, and learner context
- **THEN** SAR SHALL query the relevant sources and compose only the bounded candidate result

### Requirement: Cross-domain traversal uses explicit typed bindings
SAR MUST cross namespaces only through reviewed Canonical bindings and MUST enforce supported edge types, hop limits, scope, and candidate limits.

#### Scenario: Explicit binding exists
- **WHEN** a Canonical Object has a reviewed KAQ or resource binding within the requested scope
- **THEN** SAR MAY traverse that binding and preserve its type and provenance

#### Scenario: Only lexical similarity exists
- **WHEN** two objects have similar names but no explicit binding
- **THEN** SAR MUST NOT treat them as one identity or traverse between them

### Requirement: Every result retains authority provenance
Each SAR result node and edge MUST retain namespace, authority owner, source identity, and Release or Overlay version.

#### Scenario: Result combines multiple sources
- **WHEN** a candidate set contains ActKG, KAQ, resource, path, and learner-state items
- **THEN** each item SHALL remain attributable to its original authority and version

### Requirement: SAR results remain non-authoritative candidates
SAR composition results MUST be reconstructable query projections and MUST NOT be persisted as ActKG relations, ACT teaching relations, or a new mixed graph truth.

#### Scenario: Query completes
- **WHEN** SAR returns a composed candidate projection
- **THEN** no source graph or binding table SHALL be mutated by that result

### Requirement: Unsupported semantics are excluded
An object type or predicate that is stored but not explicitly supported by SAR MUST NOT participate in semantic traversal.

#### Scenario: Generic object appears
- **WHEN** the Repository returns a valid type without a SAR adapter
- **THEN** SAR MAY expose it as read-only context but SHALL NOT infer traversal behavior

### Requirement: Canonical SAR remains shadow before cutover
The SAR authority selector MUST keep formal production requests on the Legacy SAR path until the final downtime cutover activates all formal consumers together.

#### Scenario: Canonical composition is evaluated before cutover
- **WHEN** the Canonical SAR pipeline produces a candidate result while Legacy remains active
- **THEN** the result SHALL be recorded as shadow evidence and MUST NOT replace the production SAR response

#### Scenario: Final selector activates
- **WHEN** the final cutover transaction activates Canonical SAR
- **THEN** production requests SHALL use query-time Canonical composition without Legacy fallback

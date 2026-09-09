## MODIFIED Requirements

### Requirement: Every response carries an Authority envelope

Every public knowledge-surface response SHALL carry its contract version, surface identity, mode, role-safe scope, and exact Authority snapshot/release identity. A response containing teaching or resource content SHALL additionally carry the matching teaching and source-index identities and their applicable capture or content revisions. A source index MAY be the application RegistryIndex or the existing PublishedResourceFeatureIndex, identified by its actual contract. Published-resource responses SHALL include the course-publication projection, snapshot, scope and Runtime identity alongside the index digest; the domain-teaching seal SHALL remain distinct and SHALL be joined only through its validated course-projection sidecar.

#### Scenario: Engineering detail has no teaching block

- **WHEN** a valid active Engineering node/detail is requested without teaching/resource content
- **THEN** the response SHALL bind the selected Authority snapshot/release
- **AND** it MAY omit Teaching Projection/resource identities as not applicable
- **AND** it SHALL not invent a teaching identity.

#### Scenario: Teaching content is included

- **WHEN** a card, relation, textbook/media binding, or launch descriptor is returned
- **THEN** every included block SHALL match the selected composite envelope and its applicable teaching/source-index revision
- **AND** rows from another envelope SHALL not be joined or relabeled.

#### Scenario: Node resources use the published-resource index

- **WHEN** node bindings are resolved by PublishedResourceFeatureIndex
- **THEN** the index SHALL match the selected Authority and the course projection named by the domain-teaching sidecar
- **AND** each reference SHALL carry its exact resource, projection, snapshot and content version
- **AND** the source-index contract and digest SHALL identify that published index without inventing an application Git capture.

### Requirement: Resource launches use source-owned descriptors

A public response MAY include only a role-authorized, revision-matching source-owned launch descriptor with safe display metadata. It MUST NOT construct a route from a Canonical or ResourceNode identity or expose component paths, filesystem paths, object keys, signed URLs, raw bodies, hidden review data, or evaluation payloads. An existing published-resource reference SHALL be built by its owning reference builder from a validated published resource identity, and its owning reader SHALL revalidate that identity when opened.

#### Scenario: User launches a bound resource

- **WHEN** a user activates a descriptor from a knowledge surface
- **THEN** the existing source-owned launcher SHALL resolve the target and recheck role, scope, authorization, and revision
- **AND** the knowledge read contract SHALL not absorb the launcher's business logic.

#### Scenario: Descriptor is unauthorized or stale

- **WHEN** the descriptor is outside the current role/scope or its source/revision identity drifts
- **THEN** the server SHALL omit it or return a bounded unavailable action
- **AND** it SHALL not disclose the hidden target or construct a guessed URL.

#### Scenario: A node has multiple bindings for one resource

- **WHEN** one published resource has multiple teaching roles on the selected node
- **THEN** the inspector SHALL list that resource once with its stable resource identity
- **AND** it SHALL list every distinct bound resource without a silent item limit.

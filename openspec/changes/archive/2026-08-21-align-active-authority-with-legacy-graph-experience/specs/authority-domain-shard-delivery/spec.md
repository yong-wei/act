## ADDED Requirements

### Requirement: Node-detail shards include governed related content and launch descriptors
An active Authority node-detail shard SHALL project the selected semantic object, published one-hop neighbors, eligible Knowledge Card and infograph references, and role-authorized registered resource bindings in one bounded response. Every optional content block and binding MUST be resolved by stable identity against the shard envelope and MUST NOT be inferred from display text.

#### Scenario: Selected node has registered resources
- **WHEN** a role-authorized selected node has one or more governed course, handout, step, textbook, simulation, Arena, or feature-owned resource bindings
- **THEN** the detail shard SHALL return their human-facing title, typed binding role, resource kind, availability, and source-owned launch descriptor
- **AND** it SHALL not expose an internal filesystem path, registry implementation path, raw canonical ID, or guessed route

#### Scenario: Optional content identity drifts
- **WHEN** a Knowledge Card, infograph, or resource-binding manifest does not match the selected Authority and applicable teaching/resource projection identity
- **THEN** the mismatched optional block SHALL be omitted with a bounded availability state
- **AND** the base semantic detail and valid published relation summaries SHALL remain available

### Requirement: Detail launch descriptors preserve source ownership and authorization
Every returned resource launch descriptor SHALL identify an existing route, registry entry, or feature-owned launcher class without embedding the owned feature's business payload. The server SHALL apply current-role visibility before projection, and the client SHALL pass the descriptor to the existing launcher instead of constructing a target from the Authority node identity.

#### Scenario: Learner launches a mapped resource
- **WHEN** the learner activates a resource action from the active Authority inspector
- **THEN** the target SHALL resolve through the existing source-owned authorization and launch contract
- **AND** the knowledge workspace SHALL retain a return path without absorbing the launched feature's business logic

#### Scenario: Binding exists but role cannot access it
- **WHEN** the selected node has a governed binding outside the current role's visibility or availability
- **THEN** the public detail shard SHALL omit the unsafe descriptor or return a bounded unavailable action permitted for that role
- **AND** it SHALL not disclose the hidden target or policy reason

### Requirement: Detail shards distinguish mathematical content from prose
Trusted Formula expressions and governed knowledge-content math nodes SHALL be projected as explicit mathematical fields suitable for the LaTeX renderer. Ordinary names, explanations, resource titles, and relation sentences MUST remain text fields and MUST NOT be promoted to mathematical content by client-side guessing.

#### Scenario: Formula detail is projected
- **WHEN** the selected object has trusted Formula content
- **THEN** the detail shard SHALL distinguish the reviewed mathematical expression from localized explanatory prose
- **AND** both fields SHALL remain bound to the same selected object and shard envelope

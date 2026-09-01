## ADDED Requirements

### Requirement: Adaptive is not a product business owner

The implementation SHALL assign each adaptive business fact, state machine, persistence operation, and policy to Assessment, Personalization, Learning Record, or another declared domain owner; `src/features/adaptive` SHALL contain only explicitly ownerless presentation composition while it remains reachable.

#### Scenario: An adaptive module owns assessment behavior

- **WHEN** a module selects or scores an assessment item, reads attempt context, or projects assessment evidence
- **THEN** the module SHALL depend on the Assessment public/application boundary
- **AND** it SHALL not retain an adaptive-owned attempt, catalog, or evidence authority.

#### Scenario: An adaptive module owns path or learner behavior

- **WHEN** a module resolves learner state, discovers/ranks/repairs path nodes, records path state, or decides recommendation/intervention policy
- **THEN** the module SHALL depend on the corresponding Personalization public/application boundary or declared plugin/port
- **AND** it SHALL not create a parallel `adaptive` or `src/lib` business owner.

### Requirement: All remaining adaptive entrypoints have a current consumer and deletion disposition

The migration SHALL classify every production file under the current adaptive feature surface and every production `src/lib/adaptive-*` or `src/lib/adaptive-planning/*` entrypoint with its owner, production/test/tooling consumers, replacement, deletion condition, and rollback reference.

#### Scenario: An entrypoint has no production consumer

- **WHEN** the current exact-revision scan finds no production import, dynamic load, re-export, route reference, worker reference, or script-graph caller
- **THEN** the entrypoint SHALL be deleted or explicitly marked historical/tooling with a bounded reason
- **AND** it SHALL not remain as an undocumented compatibility facade.

#### Scenario: An entrypoint still has a production consumer

- **WHEN** any production consumer remains
- **THEN** retirement SHALL remain unresolved
- **AND** the implementation SHALL migrate that consumer before deleting or renaming the entrypoint.

### Requirement: Canonical consumers do not reintroduce adaptive business paths

After migration, product routes, workers, scripts, and tests SHALL use Assessment, Personalization, Learning Record, or owner-specific experience contracts and SHALL not import `src/lib` adaptive business internals or a top-level adaptive re-export.

#### Scenario: A path-advisor or learning-path caller is migrated

- **WHEN** a caller needs candidate batches, path options, journey state, correction, destination, execution, or explanation data
- **THEN** it SHALL call the canonical Personalization path boundary and preserve the current path revision/evidence semantics
- **AND** it SHALL not assemble a competing path or bypass hard eligibility and authorization.

#### Scenario: A profile or diagnosis caller is migrated

- **WHEN** a caller needs learner state or assessment diagnosis
- **THEN** it SHALL consume the canonical Personalization learner-state or Assessment read projection
- **AND** client hints, model narratives, passive browsing, or UI state SHALL not become authoritative evidence.

### Requirement: Retirement preserves durable state and high-consequence boundaries

Removing adaptive entrypoints SHALL preserve Assessment attempt identity and snapshots, Learning Record facts/outbox delivery, Personalization path history, authentication/authorization, privacy projections, and any historical table owned by another domain.

#### Scenario: A retained table has another current owner

- **WHEN** a legacy `Question`, `UserAnswer`, path, fact, or outbox table still serves a non-retired adapter
- **THEN** the table and adapter MAY remain with an explicit owner record
- **AND** the retired adaptive path SHALL not continue as a competing write authority.

#### Scenario: Retirement reaches a protected boundary

- **WHEN** a migration touches scoring, identity, privacy, durable writes, evidence delivery, or terminal validation
- **THEN** the existing domain validator and failure semantics SHALL remain authoritative
- **AND** the retirement SHALL not replace a hard boundary with a silent fallback.

### Requirement: Adaptive retirement is non-deploying and evidence-backed

The change SHALL record current-head import/call-graph evidence, deleted and retained paths, tests, metrics, and rollback without changing database state, runtime releases, production selectors, or external coordination.

#### Scenario: Zero-production-import proof passes

- **WHEN** all predecessor migrations pass and the exact revision proves zero production reachability for a retired path
- **THEN** the path MAY be deleted and the deprecation evidence updated
- **AND** the result SHALL not imply production activation or data deletion.

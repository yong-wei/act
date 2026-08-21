## ADDED Requirements

### Requirement: All rebuilt display projections bind to one pinned v0.22 composite envelope

The rebuilt domain display catalog, zh-CN display projection, and Teaching
Projection/prerequisite candidates MUST each record and validate the same
pinned composite release envelope: the `control-theory-engineering-v0.22`
Aggregate release and the Component Manifest admitted by change
`import-actkg-v022-composite-candidate`, including Integration v0.20 and
Chinese terminology component v0.5. Builders MUST NOT resolve a "latest"
release at runtime and MUST NOT mix components from different releases.

#### Scenario: All components bind consistently

- **WHEN** the catalog, label, and teaching builders each verify the identical
  admitted envelope identity before producing output
- **THEN** the rebuilt candidates SHALL be recorded with that shared envelope
  identity and remain jointly switchable in one later composite activation

#### Scenario: A component references another release

- **WHEN** any rebuild input resolves a component from a different release,
  a runtime "latest" lookup, or an unadmitted manifest
- **THEN** the rebuild MUST fail closed and produce no candidate output

### Requirement: The domain catalog rebuild replaces the stale v0.9 membership source

The rebuilt domain display catalog candidate MUST derive its domain entries,
reviewed order, and membership from the v0.22 domain catalog data of the bound
envelope, and MUST NOT reuse the v0.9-bound manually classified membership as
its source. The domain entry count MUST come from that data and MUST NOT be
hard-coded. The currently served production catalog MUST remain untouched
until a separate composite activation.

#### Scenario: The candidate catalog is rebuilt from v0.22 data

- **WHEN** the rebuild reads the bound envelope's domain catalog data
- **THEN** the candidate SHALL contain exactly the declared domains with their
  reviewed many-to-many memberships covering every published concept
- **AND** the production catalog binding SHALL remain on its current release

#### Scenario: The stale membership source leaks into the rebuild

- **WHEN** the rebuild attempts to source memberships from the v0.9-bound
  manual catalog or asserts a fixed expected domain count
- **THEN** candidate validation MUST fail closed

### Requirement: The zh-CN display projection is rebuilt from terminology component v0.5

The v0.22 zh-CN display projection MUST resolve labels only from the bound
envelope's Chinese terminology component v0.5 and the admitted runtime
Projection Profile, keyed by stable v0.22 entity ID and exact `zh-CN`.
`canonical_preferred` rows SHALL be primary labels, `alternative` rows SHALL be
aliases, and the admitted Projection `display_name` SHALL be the fallback. The
fail-closed display boundary MUST be preserved: unsafe or empty candidates
make the affected presentation unavailable with a bounded human message and
MUST NOT expose canonical IDs, relation IDs, release strings, hashes, paths,
or machine slugs.

#### Scenario: A v0.22 preferred row resolves

- **WHEN** a v0.22 entity has one validated `canonical_preferred` `zh-CN` row
  in terminology component v0.5
- **THEN** that label SHALL be the primary learner-facing display label

#### Scenario: No primary Chinese row exists

- **WHEN** a v0.22 entity has no admitted primary Chinese row
- **THEN** the resolver SHALL use the admitted Projection `display_name`
  without changing entity identity

#### Scenario: Every candidate label is unsafe

- **WHEN** the primary and fallback candidates for a v0.22 entity fail the
  human-readable label policy
- **THEN** the affected presentation response SHALL fail closed with a bounded
  human message and SHALL NOT reveal the rejected value or any internal ID

### Requirement: v0.22 candidates remain inactive with two-phase separation

All rebuilt v0.22 candidates MUST stay in candidate space: builders MUST write
only scoped content-addressed candidate roots, every receipt MUST record
`nonActivation: true`, and no qualification, activation, consumer, or
production selector may consume the candidates. Candidate auditability MUST
NOT be treated as production switchover; the composite activation is a
separate controlled change.

#### Scenario: Candidates are staged without activation

- **WHEN** the catalog, zh-CN, and teaching candidates are produced
- **THEN** all current production selector bytes SHALL remain unchanged and
  each receipt SHALL retain `nonActivation: true`

#### Scenario: A production surface requests candidate data

- **WHEN** a production selector or consumer attempts to read a v0.22
  candidate artifact before the composite activation
- **THEN** the request MUST be refused and the current production projection
  SHALL keep serving

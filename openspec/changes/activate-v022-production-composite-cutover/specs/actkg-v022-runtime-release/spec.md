## ADDED Requirements

### Requirement: Envelope selectors are configuration bound to one qualified composite release envelope

The ACT runtime MUST resolve Authority release, Projection Profile, Authority
domain shard/catalog, and label-overlay identities from configuration bound to
one named, qualified composite release envelope. The runtime MUST NOT compile
release or profile identities into source as constants and MUST NOT follow a
"latest" release by scanning or discovery.

#### Scenario: Hard-coded predecessor pins are removed

- **WHEN** the runtime release is built
- **THEN** no production code path SHALL depend on a compiled-in
  `ctr:release:control-theory-engineering-v0.18` release or profile constant,
  and the same identities SHALL resolve through the bound envelope
  configuration

#### Scenario: The bound envelope is unknown or partially resolved

- **WHEN** the configured envelope name is unqualified, or any of its declared
  component identities cannot be resolved
- **THEN** the runtime MUST fail closed at startup or readiness and MUST NOT
  fall back to another envelope or to per-component latest versions

### Requirement: Runtime publication freezes one gated application revision

The runtime release workflow MUST freeze one clean application revision, pass
lint, typecheck, test, and build gates on that revision, and bind the published
artifact's provenance to the frozen revision and the qualified v0.22 composite
release envelope identity.

#### Scenario: A release gate fails on the frozen revision

- **WHEN** any lint, typecheck, test, build, or provenance check fails
- **THEN** the runtime release MUST NOT be published or deployed

### Requirement: Publishing the runtime does not switch production data

The envelope-capable runtime MUST be deployable while production still serves
the previous envelope. Before, during, and after runtime deployment, the
Authority, Teaching Projection, prerequisite, Authority domain shard/catalog,
and shared consumer-activation selectors MUST retain their pre-deployment
identities.

#### Scenario: Runtime deployment succeeds

- **WHEN** the new runtime passes health and readiness checks
- **THEN** normal production reads SHALL still resolve the previous envelope's
  release set unchanged

#### Scenario: A deployment step alters a production selector

- **WHEN** any of the five selector identities differs from its recorded
  pre-deployment value
- **THEN** the deployment MUST fail, the prior runtime MUST be restored where
  possible, and the host MUST NOT be classified as activation-ready

### Requirement: The deployed runtime proves current and candidate paths separately

The deployed runtime MUST serve the current production envelope publicly and
prove controlled shadow reads of the staged qualified v0.22 envelope — domain
catalog, Chinese labels, and teaching references — without writing any shared
selector, and MUST seal a runtime-release receipt recording both results.

#### Scenario: Current behavior passes but a v0.22 shadow check fails

- **WHEN** production reads remain healthy but any v0.22 shadow check fails
- **THEN** the receipt SHALL record the blocker and production activation MUST
  remain unauthorized

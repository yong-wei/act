## ADDED Requirements

### Requirement: Qualification binds one locked v0.22 composite release envelope

The qualification MUST pin exactly one composite release envelope fixed by the
`control-theory-engineering-v0.22` Aggregate Component Manifest and MUST verify
manifest completeness and identity: Aggregate v0.22, Integration v0.20,
Chinese terminology component v0.5, Schema 0.3.0 whose hash equals the
already-integrated v0.18 Schema hash, the Projection Profile, the tag index,
and every remaining declared component. Components resolved outside the
manifest, or selected as separate "latest" versions at runtime, MUST be
rejected before any behavioral check runs. Expected object counts SHALL be
derived from the envelope itself rather than hard-coded, because v0.22 has no
local mirror at proposal time.

#### Scenario: A declared component is missing or resolves outside the manifest

- **WHEN** any component required by the Component Manifest is absent, or its
  resolved identity differs from the version the manifest declares
- **THEN** qualification MUST stop before selector and content checks and
  report the manifest violation

#### Scenario: Schema hash differs from the integrated v0.18 Schema

- **WHEN** the Schema 0.3.0 hash in the candidate envelope does not equal the
  Schema hash ACT recorded for v0.18
- **THEN** qualification MUST fail instead of assuming adapter compatibility

### Requirement: All five production selector candidates reference the same envelope

The qualification MUST audit the candidate values of all five production
selectors — Authority, Teaching Projection, prerequisites, Authority domain
shard/catalog, and shared consumer activation — and every selector candidate
MUST reference the same locked v0.22 composite release envelope. Any
mixed-version combination SHALL fail qualification as a whole; there MUST be
no per-selector partial pass.

#### Scenario: v0.22 Authority is combined with an older domain catalog

- **WHEN** the Authority selector candidate references the v0.22 envelope
  while the domain shard/catalog selector candidate still references v0.9 or
  v0.18
- **THEN** qualification MUST fail and identify the incoherent selector set

#### Scenario: All five selector candidates match the envelope

- **WHEN** Authority, Teaching Projection, prerequisites, Authority domain
  shard/catalog, and shared consumer activation candidates all reference the
  locked v0.22 envelope
- **THEN** the coherence gate SHALL pass and record each selector's audited
  identity as evidence

### Requirement: Domain membership, Chinese display, and teaching references are audited against the envelope

The qualification MUST verify that domain catalog membership is complete, with
many-to-many domain membership materialized exactly as the envelope's domain
catalog declares and no stale v0.9 members readable through the candidate
catalog. It MUST verify Chinese display coverage against the terminology v0.5
component, and MUST verify that every teaching projection reference resolves
to a v0.22 canonical object. Missing teaching coverage for v0.22 objects that
have no teaching relations SHALL be reported as a coverage gap and MUST NOT by
itself block qualification.

#### Scenario: A stale v0.9 member remains readable in the candidate catalog

- **WHEN** the candidate domain catalog exposes a member that belongs only to
  the v0.9 catalog and is not declared by the v0.22 envelope
- **THEN** the membership gate MUST fail and list the stale member

#### Scenario: Teaching references resolve but some objects lack teaching coverage

- **WHEN** every captured teaching projection reference resolves to a v0.22
  canonical object and the only remaining gaps are v0.22 objects without
  teaching relations
- **THEN** the teaching gate SHALL pass and report the coverage gap as
  non-blocking

### Requirement: Shard rebuild reproducibility and rollback evidence must be proven

The qualification MUST rebuild the Authority domain shard set at least twice
from the same locked envelope and the rebuilds MUST match. It MUST preserve a
snapshot of the previous production composite release envelope and MUST
demonstrate that this snapshot is restorable, so a failed later activation can
return to the prior production state.

#### Scenario: Two rebuilds from the same envelope diverge

- **WHEN** any material output of the two Authority domain shard rebuilds
  differs
- **THEN** qualification MUST fail and retain both rebuild identities for
  diagnosis

#### Scenario: Previous production envelope snapshot cannot be restored

- **WHEN** the preserved snapshot of the previous production composite release
  envelope fails its restoration proof
- **THEN** qualification MUST fail even if all forward-looking checks passed

### Requirement: Qualification success does not switch production

A passing qualification SHALL mark the v0.22 candidate as auditable only.
Qualification success alone MUST NOT move any production selector, MUST NOT
constitute the composite cutover, and MUST leave every production selector
equal to its pre-run value; production activation remains a separate,
explicitly controlled change.

#### Scenario: All qualification gates pass

- **WHEN** the envelope, selector coherence, membership, display, teaching,
  reproducibility, and rollback gates all pass and every production selector
  still equals its pre-run value
- **THEN** the verdict SHALL record the candidate as auditable and defer
  activation to the separate cutover change

#### Scenario: A production selector changed during the run

- **WHEN** any production selector no longer equals its pre-run value at
  verdict time
- **THEN** the qualification MUST be voided regardless of gate results and the
  deviation reported

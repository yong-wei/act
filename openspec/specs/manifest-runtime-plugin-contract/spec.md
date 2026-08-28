# manifest-runtime-plugin-contract Specification

## Purpose
TBD - created by archiving change introduce-manifest-runtime-plugin-contract. Update Purpose after archive.
## Requirements
### Requirement: Manifest plugins are typed by runtime responsibility

The manifest runtime SHALL define typed contracts for module, activity, and
layout/template plugins. Each plugin MUST declare a stable composite identity
containing its category, `module.kind`, non-empty `capabilityRef`, and contract
version, together with payload validation, role projection, rendering behavior,
evidence behavior, and missing-renderer behavior. Activity plugins MUST also
declare response behavior when applicable.

#### Scenario: A canonical content plugin is registered

- **WHEN** a plugin handles a canonical content module kind
- **THEN** its payload MUST be normalized by its declared schema before render
- **AND** the registry MUST expose its owner, composite identity, and role-safe
  projection.

#### Scenario: An activity plugin produces an answer

- **WHEN** an activity plugin accepts a student response
- **THEN** it MUST declare a canonical response kind and durable evidence
  classification
- **AND** the shared submission context MUST be able to associate the evidence
  with the manifest step/card.

#### Scenario: One module kind exposes separate capabilities

- **WHEN** `compute.panel` registers `static-surface-3d`, `control-workbench`,
  and `interactive-figure`
- **THEN** each capability MUST have a distinct stable `capabilityRef` and
  contract version
- **AND** each MUST own its schema, role projection, evidence, and
  missing-renderer contract rather than sharing a kind-level branch.

### Requirement: Registry composition is owned and conflict-safe

The runtime SHALL compose plugin sets from explicit owners and MUST reject
duplicate composite identities, unknown categories, empty or unknown capability
references, missing contract versions, or plugins that cannot be validated
without lesson-private knowledge.

#### Scenario: Two plugins claim one composite identity

- **WHEN** registry composition receives two claims for the same category,
  `module.kind`, `capabilityRef`, and contract version
- **THEN** composition MUST fail with both owners named
- **AND** rendering MUST NOT choose one by import order.

#### Scenario: Two capabilities share one module kind

- **WHEN** registry composition receives `compute.panel` plugins for two
  different non-empty capability references
- **THEN** composition MUST accept both as distinct entries
- **AND** lookup MUST select only the exact requested composite identity.

#### Scenario: A new course needs a renderer

- **WHEN** a course declares a registered module kind
- **THEN** the course MUST use the plugin registry and manifest data
- **AND** adding the course MUST NOT require a new branch in the central
  `content-renderers.tsx` switch.

### Requirement: The central runtime has a narrow responsibility

The central manifest runtime SHALL validate the manifest boundary, resolve the
exact plugin identity, establish session/submission context, collect declared
evidence, and emit the plugin contract's missing-renderer result. It MUST NOT
parse `capabilityRef`, directly import every domain renderer, or own
capability-specific payload interpretation or branches.

#### Scenario: A registered module renders

- **WHEN** a normalized manifest module resolves to a plugin
- **THEN** the center MUST pass the typed context to that plugin
- **AND** the center MUST NOT duplicate its payload or visual logic.

#### Scenario: The center receives a capability reference

- **WHEN** a manifest requests `compute.panel` with a capability reference
- **THEN** the center MUST pass the unparsed composite identity to registry
  lookup
- **AND** it MUST NOT split, interpret, or branch on the capability reference.

#### Scenario: A required capability has no plugin

- **WHEN** a required composite identity cannot be resolved
- **THEN** the runtime MUST emit an explicit machine-readable missing-renderer
  error/marker according to the typed contract/category policy
- **AND** it MUST NOT silently render a generic content card.

### Requirement: Role projection prevents cross-role leakage

Every plugin that receives role-sensitive data SHALL project a student or
teacher view before rendering. Student projection MUST exclude reference
answers, teacher-only diagnostics, and teacher controls; teacher projection MAY
include them only when authorized.

#### Scenario: A student renders an activity

- **WHEN** a student requests a module containing reference or diagnostic data
- **THEN** the plugin projection MUST remove those fields before render
- **AND** the resulting HTML/payload MUST not expose them.

#### Scenario: Teacher and student render the same module

- **WHEN** authorized teacher and student projections are rendered
- **THEN** each MUST use the same module identity and evidence contract
- **AND** only the explicitly permitted role fields may differ.

### Requirement: Missing and optional renderers fail safely

Required plugin failures SHALL be visible and block qualification of the
affected manifest. Optional media, knowledge-card, or enhancement failures MAY
degrade the presentation with an observable reason, but MUST NOT fabricate
content or alter the bundle/session identity.

#### Scenario: An optional enhancement is unavailable

- **WHEN** a valid module's optional media or knowledge-card plugin is missing
- **THEN** the base module MUST remain renderable
- **AND** the omission reason MUST be available to diagnostics.

#### Scenario: A required renderer throws or returns empty content

- **WHEN** a required plugin cannot render its normalized payload
- **THEN** the runtime MUST emit the explicit required-module error
- **AND** governance MUST record the lesson, step, module, and plugin kind.

### Requirement: Rendering and evidence extraction are separate

Plugin rendering MUST be side-effect free with respect to persistence. Evidence
extraction MAY return typed evidence for the shared submission path, but only a
registered activity response contract MAY produce `StudentStepResponse` or
LearningFact materialization input.

#### Scenario: A student views a visual module

- **WHEN** the module is viewed, focused, or revealed without submission
- **THEN** any event MUST retain its `InteractionLog` classification
- **AND** rendering MUST NOT create a durable submission or learning fact.

#### Scenario: An activity submits structured output

- **WHEN** a registered activity submits an answer or compute result
- **THEN** the plugin MUST return typed extra evidence through the shared
  submission context
- **AND** the output MUST retain step/module/attempt lineage.

### Requirement: The pilot migrates a real renderer and removes its central import

The implementation SHALL migrate the existing `compute.panel` capability
`static-surface-3d` to an owned plugin and SHALL remove its direct import and
business switch branch from the central renderer. A forwarding facade SHALL NOT
count as migration.

#### Scenario: The static-surface capability plugin is used

- **WHEN** a runtime manifest declares `compute.panel` with the
  `static-surface-3d` capability reference
- **THEN** the owned plugin MUST render it through the typed registry
- **AND** the central renderer's direct import count and capability-specific
  branch count MUST decrease to zero for the pilot path.

#### Scenario: Pilot behavior is compared

- **WHEN** the pilot is rendered in teacher and student browser projections
- **THEN** its visual, role, evidence, and optional fallback behavior MUST match
  the characterization receipt
- **AND** a missing required plugin MUST remain explicit.

#### Scenario: Capability registry negative and positive cases are tested

- **WHEN** registry tests submit a duplicate full key and distinct
  `compute.panel` capability references
- **THEN** the duplicate MUST be rejected with both owners named
- **AND** `static-surface-3d`, `control-workbench`, and `interactive-figure`
  MUST remain independently selectable.

### Requirement: Manifest, DB resource, and lesson-engine registries stay separate

The manifest plugin registry MUST NOT be merged with Prisma
`TeachingResource.registryId` or the lesson-engine resource renderers. The
lowercase `resource-renderer.tsx` remains the current resource path; the
uppercase legacy renderer is governed by its own retirement contract.

#### Scenario: A DB TeachingResource is consumed by a course

- **WHEN** a manifest module needs a registered DB resource
- **THEN** it MAY use an explicit public capability/adapter
- **AND** the resource registry entry MUST NOT become a manifest plugin claim.

#### Scenario: A legacy resource renderer remains in use

- **WHEN** an uppercase `ResourceRenderer.tsx` consumer still exists
- **THEN** the plugin migration MUST leave that consumer inventory visible
- **AND** it MUST NOT delete or disguise the legacy renderer as a manifest
  plugin migration.

### Requirement: Plugin migration has a closed denominator and deletion ledger

The implementation SHALL inventory all canonical/legacy module kinds, activity
and layout renderers, direct central imports, generated-slide adapters, role
projections, evidence extractors, and runtime-first manifests. Every migration
entry MUST name an owner, replacement, consumer count, deletion condition, and
unit/browser evidence.

#### Scenario: A central import is removed

- **WHEN** the pilot no longer imports a renderer from the center
- **THEN** the ledger MUST record the old import, replacement plugin, callers,
  and zero-consumer/deletion evidence
- **AND** the central switch MUST not retain a dead authoritative branch.

#### Scenario: A legacy alias remains during migration

- **WHEN** a historical module alias is still read for compatibility
- **THEN** it MUST be recorded as migration-only with a canonical target and
  deletion condition
- **AND** it MUST NOT authorize a new or migrated manifest.

### Requirement: Plugin verification includes domain and browser acceptance

The change SHALL pass typed composite-key registry, taxonomy/gate, role
projection, evidence, missing-renderer, generated-slide, central-import and
capability-parser, affected Interactive domain, typecheck, and browser tests.

#### Scenario: A new manifest uses a registered plugin

- **WHEN** the manifest is validated and rendered without modifying the center
- **THEN** the registry MUST resolve it and all declared role/evidence checks
  MUST pass
- **AND** strict OpenSpec validation and `git diff --check` MUST pass.

#### Scenario: A new manifest invents a kind

- **WHEN** a module kind is absent from the plugin/taxonomy registry
- **THEN** validation MUST fail with lesson, step, module, and kind
- **AND** a lesson-private renderer MUST NOT make it acceptable.


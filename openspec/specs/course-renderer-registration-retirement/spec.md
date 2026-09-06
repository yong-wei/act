# course-renderer-registration-retirement Specification

## Purpose

Define consolidation of reusable manifest renderer registration onto the
existing typed plugin registry and retirement of legacy renderer paths without
changing the manifest plugin contract or rendered behavior.
## Requirements
### Requirement: Reusable manifest capabilities have one registration owner

Every reusable manifest module, activity, and layout capability SHALL be
registered through the existing owned `ManifestPluginSet` and composed by
`composeManifestPluginRegistry`.  The DB/BOPPPS resource registry SHALL remain
separate and SHALL not be treated as a manifest plugin registry.

#### Scenario: A reusable capability is added

- **WHEN** a manifest declares a reusable capability
- **THEN** its owner SHALL register one exact composite plugin identity
- **AND** central rendering SHALL resolve that identity through the existing
  plugin registry.

#### Scenario: A capability exists in two registries

- **WHEN** the inventory finds a reusable capability in a plugin set and a
  central legacy map
- **THEN** the typed plugin registration SHALL be the sole global authority
- **AND** the duplicate legacy entry SHALL be removed or explicitly classified
  as a temporary migration artifact.

### Requirement: Exact lookup and missing-renderer policy are preserved

Central manifest rendering SHALL resolve category, module kind, capability
reference, and contract version using the existing plugin lookup semantics.
Duplicate keys, ambiguous versions, unknown categories, and declared missing
capabilities SHALL retain their explicit fail-closed behavior.

#### Scenario: Two versions are registered without a manifest version

- **WHEN** multiple versions of one capability are registered and the manifest
  omits `contractVersion`
- **THEN** lookup SHALL return the existing explicit ambiguous/missing result
- **AND** rendering SHALL not choose by registration order.

#### Scenario: A required capability is unregistered

- **WHEN** a manifest declares a required capability with no matching plugin
- **THEN** the renderer SHALL expose the declared missing-renderer contract
- **AND** it SHALL not fall through to a legacy implementation.

### Requirement: Role and evidence behavior remains plugin-owned

Registry consolidation SHALL preserve plugin payload validation, student and
teacher role projection, side-effect-free rendering, evidence classification,
response kind, and optional/required missing behavior.  Student projections
SHALL not expose reference answers, teacher diagnostics, or internal evidence
payloads.

#### Scenario: A student renders a teacher-capable module

- **WHEN** a registered module is rendered for a student
- **THEN** the plugin SHALL project the student-safe payload before rendering
- **AND** teacher-only controls and answer-bearing fields SHALL remain absent.

#### Scenario: An activity is submitted

- **WHEN** a registered activity produces a response
- **THEN** it SHALL retain its canonical response kind and existing durable
  submission/evidence classification
- **AND** rendering itself SHALL not write evidence.

### Requirement: Course-local registries remain bounded and non-shadowing

An `InteractiveModuleRegistry` retained for a genuinely course-owned module
SHALL have an explicit owner rationale and SHALL not shadow a declared global
plugin identity or act as a central fallback for a declared capability.

#### Scenario: A course-owned module remains local

- **WHEN** a module requires course-specific state and has no reusable plugin
  capability
- **THEN** its local registry MAY remain in the course module
- **AND** the inventory SHALL record why it is not a global registration.

#### Scenario: A local registry shadows a plugin

- **WHEN** a course-local entry matches a declared reusable capability
- **THEN** qualification SHALL fail
- **AND** the entry SHALL be migrated or removed before retirement.

### Requirement: Legacy renderer paths are deleted only at zero callers

After reusable capabilities and central consumers use the typed registry, old central renderer branches and compatibility entrypoints SHALL be removed when no required production, dynamic or bundle caller needs them. Tests that exercise supported behavior SHALL remain; tests that only preserve a retired implementation SHALL be removed or updated rather than requiring that implementation to survive. No permanent forwarding facade or second global registry SHALL remain. Existing focused tests and the change description SHALL document the result without requiring a separate retirement ledger.

#### Scenario: The legacy inventory is empty

- **WHEN** all required old-renderer callers use existing replacements or no longer exist
- **THEN** the old branches and entrypoints SHALL be deleted
- **AND** existing focused tests SHALL verify the supported replacement behavior.

#### Scenario: A hidden caller remains

- **WHEN** a route, supported dynamic input, bundle or test representing a current user behavior still needs the old renderer
- **THEN** that renderer SHALL be retained or its caller migrated before deletion
- **AND** unrelated unused branches SHALL remain independently removable.

#### Scenario: Legacy taxonomy remains useful without render handlers

- **WHEN** a legacy kind is still needed for input normalization, rejection or a course payload discriminator
- **THEN** that metadata SHALL remain even when its unused central handler is deleted
- **AND** missing plugin identities SHALL retain the existing explicit missing-renderer behavior.

### Requirement: Registration retirement is behavior-qualified

The change SHALL compare pre- and post-migration rendered output and diagnostic
markers for ordinary, activity, compute, visual, layout, role-projected,
missing, optional, and versioned cases.  Evidence SHALL bind to one source
revision before C14 simplification begins.

#### Scenario: Registry migration is reviewed

- **WHEN** the consolidated registry is proposed for qualification
- **THEN** focused plugin, module-gate, role, evidence, and missing-renderer
  tests SHALL pass
- **AND** any unapproved behavior difference SHALL block legacy deletion.


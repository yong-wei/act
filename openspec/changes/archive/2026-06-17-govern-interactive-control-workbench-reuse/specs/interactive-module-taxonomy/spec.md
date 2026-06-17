## ADDED Requirements

### Requirement: Control analysis capabilities are shared compute capabilities
Interactive course manifests SHALL reference registered shared control workbench capabilities for control analysis panels.

#### Scenario: Course declares a shared control workbench capability
- **WHEN** a runtime manifest module has `kind: compute.panel`
- **AND** its capability is `control-workbench`, `control-linked-comparison`, `control-root-locus-design-map`, `control-frequency-reading-workbench`, `nonlinear-analysis-workbench`, or `training-workbench`
- **THEN** the module registry gate SHALL resolve it through a shared capability registry
- **AND** the runtime SHALL render through the shared control workbench or shared control analysis panels.

#### Scenario: Course uses a generic control analysis carrier
- **WHEN** a new or migrated course declares a control-analysis surface through `interactive-figure`, a lesson-private module kind, or a course-local registry entry
- **THEN** validation SHALL fail
- **AND** the error SHALL name the registered shared capability that should be used instead.

### Requirement: Course-private duplicate control panels are forbidden
Interactive course implementations SHALL NOT duplicate control workbench panels that already exist in the shared control system resources.

#### Scenario: Lesson-private control panel is introduced
- **WHEN** a change adds or modifies code under `src/features/interactive/unit-*`
- **AND** that code implements a time-domain, Bode, Nyquist, root-locus, performance, Rust/WASM request, compute fallback, or equivalent control analysis panel
- **THEN** the implementation gate SHALL fail unless a documented migration exception is present
- **AND** the exception SHALL identify the owning issue, expiry, and removal condition.

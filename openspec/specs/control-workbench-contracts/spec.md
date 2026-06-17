# control-workbench-contracts Specification

## Purpose
TBD - created by archiving change control-workbench-contracts. Update Purpose after archive.
## Requirements
### Requirement: Contracts live in a client-safe workbench contract layer
The system SHALL define comprehensive control workbench shared contracts under `src/features/control-workbench/contracts/` and keep them safe for both client and server imports.

#### Scenario: Contract files avoid runtime-only dependencies
- **WHEN** a contract file is imported from a client component or a server module
- **THEN** it SHALL NOT import React components, Prisma clients, API routes, persistence stores, browser workers, or chart implementations.

#### Scenario: Contract index exports shared types
- **WHEN** another module imports from the contract layer
- **THEN** it SHALL be able to access session context, target, nominal model, signal, view, method, layout, controller draft, and artifact bridge contracts from a stable contract entrypoint.

### Requirement: Workbench session context describes challenge, assignment, explore, and Odyssey modes
The contract layer SHALL define a `WorkbenchSessionContext` that represents challenge-bound, assignment-bound, free-explore, and Odyssey workbench sessions without requiring UI implementation.

#### Scenario: Challenge session carries Arena context
- **WHEN** a workbench session is challenge-bound
- **THEN** the context SHALL be able to carry Arena task id, task, object, metric profile, leaderboard policy, allowed methods, allowed views, default preset, official target, working model, and submission policy.

#### Scenario: Assignment session preserves publication context
- **WHEN** a workbench session is assignment-bound
- **THEN** the context SHALL be able to carry `publicationId`, `classId`, and `seasonId` without requiring a submission panel implementation.

#### Scenario: Free-explore session has no official target
- **WHEN** a workbench session is free-explore
- **THEN** `officialTarget` SHALL be nullable
- **AND** official submission policy SHALL represent that leaderboard submission is not allowed.

### Requirement: Official target and working model are separate
The contract layer SHALL define separate contracts for `WorkbenchPlantTarget` and `NominalModelArtifact`.

#### Scenario: White-box target can expose transfer function
- **WHEN** a white-box transfer-function object is represented as a workbench target
- **THEN** the target SHALL be able to include numerator, denominator, display text, and LaTeX expression.

#### Scenario: Black-box target does not expose transfer function
- **WHEN** a black-box object is represented as a workbench target
- **THEN** the target SHALL identify visibility and model type without requiring transfer-function coefficients.

#### Scenario: Nominal model records provenance
- **WHEN** a student creates a nominal model from an experiment dataset
- **THEN** the nominal model artifact SHALL be able to record source object id, source dataset hash, model type, representation, validation metrics, and creation time.

### Requirement: Workbench signals are source-aware
The contract layer SHALL define `WorkbenchSignal` and `WorkbenchSignalKind` so views can distinguish reference, outputs, errors, controls, disturbances, and constraints.

#### Scenario: Experiment signal is distinguishable from official target signal
- **WHEN** a view receives a signal generated from a black-box experiment
- **THEN** the signal SHALL be able to mark its source as `experiment`
- **AND** it SHALL NOT need to claim that it came from the official target model.

#### Scenario: Constraint signals can be represented
- **WHEN** a predictive or constrained control view needs upper or lower bounds
- **THEN** the signal contract SHALL support constraint upper and lower signal kinds.

### Requirement: View and layout contracts support presets without UI coupling
The contract layer SHALL define view identifiers, view configuration, layout presets, and method panel identifiers without depending on React.

#### Scenario: Classic preset can describe four views
- **WHEN** a classic white-box preset is described by contracts
- **THEN** it SHALL be able to include time-domain, Bode, root-locus, and Nyquist view configs.

#### Scenario: Black-box preset can describe identification view
- **WHEN** a black-box preset is described by contracts
- **THEN** it SHALL be able to include identification, metric summary, and control effort or response comparison views.

### Requirement: ControllerDraft is distinct from official ControllerArtifact
The contract layer SHALL define `ControllerDraft` as editable workbench state and define an artifact bridge contract for converting valid drafts into Arena `ControllerArtifact` objects.

#### Scenario: Draft can be dirty and partial
- **WHEN** a student edits controller parameters in the workbench
- **THEN** the draft SHALL be able to represent method, source, parameters, dirty state, and validation status without being an official artifact.

#### Scenario: Official submission requires bridge result
- **WHEN** a workbench submits to Arena official evaluation
- **THEN** the contract SHALL require a successful artifact bridge result containing a `ControllerArtifact`
- **AND** failed bridge results SHALL carry a Chinese reason suitable for display.

### Requirement: Contracts include experiment and submission policy
The contract layer SHALL define policy contracts for experiment access and official submission eligibility.

#### Scenario: Black-box challenge has experiment policy
- **WHEN** a black-box challenge session is represented
- **THEN** the context SHALL be able to describe signal types, sample limits, budget limits, and whether persisted experiment datasets are required.

#### Scenario: Explore mode cannot officially submit
- **WHEN** a free-explore session is represented
- **THEN** its submission policy SHALL indicate that official evaluation and leaderboard insertion are disabled.

### Requirement: Control workbench supports course embedding contracts
The shared control workbench SHALL expose a course embedding contract that can be used by interactive lesson runtime without importing lesson-private components.

#### Scenario: Course runtime embeds the workbench
- **WHEN** an interactive course manifest requests a shared control workbench capability
- **THEN** the workbench contract SHALL accept lesson id, step id, role, release state, initial parameters, allowed panels, theme, and response contract metadata
- **AND** it SHALL return renderable state without requiring the course to reimplement panel internals.

#### Scenario: Course changes parameters
- **WHEN** a student changes workbench parameters inside an interactive lesson
- **THEN** the shared workbench SHALL expose a structured parameter snapshot suitable for interactive submission evidence
- **AND** the snapshot SHALL identify panel ids and teaching-relevant parameter names without exposing implementation-only field names in visible UI.

### Requirement: Course embedded workbench adapts to light and dark themes
The shared control workbench SHALL preserve readable chart, legend, handle, annotation, and fallback states in both light and dark interactive course themes.

#### Scenario: Theme changes during a lesson
- **WHEN** a course page renders a shared workbench capability in light or dark theme
- **THEN** axes, grid lines, curves, legends, handles, labels, warnings, and fallback content SHALL meet the same readability contract
- **AND** the implementation acceptance artifact SHALL include student and teacher screenshots for both themes.


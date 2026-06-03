## ADDED Requirements

### Requirement: Tailwind source detection is limited to frontend business source
The project SHALL configure Tailwind CSS source detection as an explicit allowlist of frontend business source roots.

#### Scenario: Tailwind scans application code
- **WHEN** the CSS entrypoint is processed during development or production build
- **THEN** Tailwind SHALL scan App Router pages, shared components, feature modules, reusable frontend resources, and UI helper modules imported by those surfaces
- **AND** it SHALL NOT scan repository system, agent, OpenSpec, memory, documentation, evaluation fixture, log, generated, or build-output directories.

#### Scenario: UI code imports class factories
- **WHEN** a scanned component or page imports a repository module that returns Tailwind class strings for runtime UI styling
- **THEN** that module SHALL be included in the explicit Tailwind source boundary
- **AND** representative utilities from that module SHALL be present after CSS generation.

#### Scenario: Agent skill symlinks exist in the repository
- **WHEN** `.agents/skills/*` contains symlinks to machine-local skill directories
- **THEN** those symlinks SHALL remain usable by agent workflows
- **AND** Tailwind/Turbopack SHALL NOT follow them while compiling page CSS.

### Requirement: Frontend source-boundary changes are verified at runtime
The project SHALL verify source-boundary changes with both build-time and browser-level checks.

#### Scenario: Source boundary is changed
- **WHEN** a change modifies Tailwind source detection, frontend CSS entrypoints, or local tool-directory scan exclusions
- **THEN** the change SHALL run default tests, unit tests, production build, and local startup
- **AND** `/login`, `/interactive-learning`, and `/api/readyz` SHALL return successful responses during local verification.

#### Scenario: Turbopack reports a filesystem-root path error
- **WHEN** Turbopack reports a filesystem-root escape or external symlink path while compiling `src/app/globals.css`
- **THEN** the issue SHALL be treated as a source-boundary defect
- **AND** the fix SHALL narrow Tailwind source detection rather than adding ad hoc exceptions for individual system directories.

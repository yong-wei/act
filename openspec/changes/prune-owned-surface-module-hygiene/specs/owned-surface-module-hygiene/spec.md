## ADDED Requirements

### Requirement: Module hygiene cleanup is graph-backed
Owned-surface module hygiene remediation SHALL verify unused exports and files before removal.

#### Scenario: Export is reported unused
- **WHEN** React Doctor reports an owned export as unused
- **THEN** the implementation SHALL verify import graph, route conventions, registry usage, and test references before removing or privatizing the export.

#### Scenario: File is reported unused
- **WHEN** React Doctor reports an owned file as unused
- **THEN** the implementation SHALL prove the file is not an App Router convention file, framework-required configuration file, generated-style entrypoint, stylesheet or runtime side-effect entrypoint, registry entrypoint, dynamic import target, test fixture, or documented public API before deletion.

### Requirement: Component export boundaries remain explicit
Component files SHALL keep reusable non-component helpers in stable module boundaries when splitting improves maintainability.

#### Scenario: Component file exports non-component values
- **WHEN** a component file is remediated for `only-export-components`
- **THEN** reusable non-component values SHALL move to an appropriate helper module or remain with a documented exception.

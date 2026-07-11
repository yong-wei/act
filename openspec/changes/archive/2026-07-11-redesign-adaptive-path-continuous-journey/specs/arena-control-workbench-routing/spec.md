## ADDED Requirements

### Requirement: Arena workspace routing preserves adaptive path context
Arena workspace routing SHALL preserve a valid adaptive path launch context when moving from a concrete challenge to Control Odyssey or the unified control workbench.

#### Scenario: Path-bound challenge opens the unified workbench
- **WHEN** `getArenaWorkspaceHref` builds a supported workbench URL for a path-bound challenge
- **THEN** the URL SHALL retain the Arena task and preset together with normalized path source, goal, path, node, intent, return, and resource-type values
- **AND** path values SHALL not overwrite or discard publication values.

#### Scenario: Path-bound challenge opens Control Odyssey
- **WHEN** the challenge object or workspace mode uses Control Odyssey
- **THEN** the dedicated Odyssey route SHALL receive the same normalized path context and Arena task identity.

### Requirement: Arena workbenches expose governed journey continuation
An Arena-bound workbench opened from an adaptive path SHALL show the shared journey control and enable continuation only from server-owned result state.

#### Scenario: Arena completion is accepted
- **WHEN** a governed Arena submission or policy-allowed preview result is bound to the current path node and the server returns a ready next action
- **THEN** the workbench SHALL enable the named next-node action without requiring an intermediate return to the path center
- **AND** `返回学习路径` SHALL remain available.

#### Scenario: Arena evidence is invalid or incomplete
- **WHEN** the Arena result is invalid, belongs to another task, lacks required simulation evidence, or remains pending
- **THEN** the workbench SHALL not enable the next path node
- **AND** the journey control SHALL show the server-provided blocked, remediation, or synchronization state without exposing hidden evaluation details.

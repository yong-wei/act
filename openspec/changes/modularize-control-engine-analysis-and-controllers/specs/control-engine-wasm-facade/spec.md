## ADDED Requirements

### Requirement: Control-engine analysis and controllers have independent internal ownership
The Rust control-engine SHALL keep analysis and controller implementation responsibilities in independently testable internal modules, while `lib.rs` remains the stable facade-facing decode, dispatch and export boundary. Internal modularization SHALL remove the original implementation from the root module rather than adding a wrapper chain.

#### Scenario: Analysis implementation is reorganized
- **WHEN** an analysis function moves from `lib.rs` into the analysis module
- **THEN** supported request/response JSON, model ids, units, errors, non-finite rejection and declared tolerance SHALL remain unchanged
- **AND** the facade SHALL call the module directly without a second numerical implementation.

#### Scenario: Controller implementation is reorganized
- **WHEN** PID or structure-controller application moves into the controller module
- **THEN** parameter bounds, hard constraints, units and controller output semantics SHALL remain unchanged
- **AND** the old root implementation and redundant forwarding wrapper SHALL be removed.

### Requirement: Analysis/controller modularization preserves the existing WASM facade
Internal module changes SHALL preserve the existing generated WASM export names, versioned client/worker/server facade contract and runtime identity. A public ABI or Artifact/Run contract change SHALL require a separate versioned change.

#### Scenario: Facade requests a supported analysis
- **WHEN** the client, worker or server facade submits an existing analysis/controller request
- **THEN** the request SHALL resolve through the same supported capability and result envelope
- **AND** no consumer SHALL import generated modules directly or use a TypeScript numerical fallback.

#### Scenario: Non-finite or invalid controller input occurs
- **WHEN** analysis/controller input violates an existing numerical boundary or produces a non-finite value
- **THEN** the same bounded error/invalid result SHALL be returned
- **AND** the modularization SHALL not coerce, default or silently accept it.

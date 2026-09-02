## ADDED Requirements

### Requirement: Control-engine simulation and metrics have independent internal ownership
The Rust control-engine SHALL keep simulation state stepping/trace assembly and metrics derivation in independently testable internal modules, while `lib.rs` remains the facade-facing decode, dispatch and export boundary. Moduleization SHALL remove the original implementation from the root module and SHALL NOT add a forwarding wrapper chain.

#### Scenario: Simulation implementation is reorganized
- **WHEN** an existing simulation model or trace assembly function moves from `lib.rs` into the simulation module
- **THEN** model ids, fixed-step behavior, units, sample cadence, trace identity and result JSON SHALL remain unchanged
- **AND** the facade SHALL invoke the module without a TypeScript numerical fallback.

#### Scenario: Metrics implementation is reorganized
- **WHEN** summary metrics move from `lib.rs` into the metrics module
- **THEN** metric definitions, ordering, finite-value checks, hard-constraint handling and declared tolerance SHALL remain unchanged
- **AND** Arena evaluator task scoring SHALL remain outside the shared metrics module.

### Requirement: Simulation/metrics failures remain fail-closed
Internal moduleization SHALL preserve controlled unavailable/invalid/error behavior for non-finite output, timeout, missing runtime and hard-constraint failure. It SHALL not create empty, zero-filled, stale or heuristic results.

#### Scenario: Simulation runtime is unavailable
- **WHEN** the WASM runtime is not ready, times out or returns a non-finite value
- **THEN** the client/worker or server facade SHALL return its existing bounded failure state
- **AND** no official score, evidence-bearing run, preview persistence or leaderboard result SHALL be derived from the failure.

#### Scenario: Trace and metrics are valid
- **WHEN** a supported simulation produces a finite trace under the declared fixed-step and sampling contract
- **THEN** the metrics module SHALL derive the same summary within the declared tolerance
- **AND** replay/checksum and preview/official visibility identities SHALL remain intact.

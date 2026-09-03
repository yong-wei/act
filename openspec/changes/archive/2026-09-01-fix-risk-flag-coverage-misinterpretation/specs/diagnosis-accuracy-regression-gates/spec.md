# diagnosis-accuracy-regression-gates Delta

## MODIFIED Requirements

### Requirement: Versioned diagnosis benchmark scenarios with explicit ground truth

The system SHALL maintain a versioned diagnosis benchmark set covering at least nine scenario classes (healthy class, single weak node, multiple weak nodes, subgroup risk, stratified risk, assignment-assessment conflict, thirty-percent data missing, attribution pressure, and sparse risk flags with cross-source conflict), where every scenario carries an explicit scenario version, a fixed random seed, the true set of weak knowledge nodes, the primary weak node, data-coverage state, and the allowed diagnosis-conclusion boundary. The benchmark SHALL be generated deterministically from construction parameters and SHALL NOT contain real student identities, raw answers, or private conversations. The sparse-risk-flags scenario SHALL combine complete data coverage, risk flags for only a subset of students, and a genuine cross-source conflict, and its allowed-conclusion boundary SHALL record that the report must not present the risk-flag hit count as evidence-coverage insufficiency while the conflict may still lower confidence.

#### Scenario: Deterministic regeneration

- **WHEN** the same scenario version and seed are used to generate the governed input and ground truth twice
- **THEN** the generated data SHALL be identical across runs
- **AND** the injected weak-node set SHALL equal the scenario's declared true weak nodes.

#### Scenario: Coverage and conflict configuration

- **WHEN** a scenario declares partial data coverage or an assignment-assessment conflict
- **THEN** the generated governed input SHALL reflect that coverage gap or conflict deterministically
- **AND** the scenario's allowed-conclusion boundary SHALL record that the report must downgrade confidence and state limitations.

#### Scenario: Sparse risk flags are not a coverage gap

- **WHEN** the sparse-risk-flags scenario generates risk flags for only a subset of students with otherwise complete coverage
- **THEN** the ground truth SHALL require that no limitation interprets the risk-flag count as risk-evidence coverage
- **AND** a genuine cross-source conflict MAY still bound the report's confidence below `high`.

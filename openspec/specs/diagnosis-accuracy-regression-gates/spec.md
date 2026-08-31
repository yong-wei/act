# diagnosis-accuracy-regression-gates Specification

## Purpose
TBD - created by archiving change add-diagnosis-accuracy-regression-gates. Update Purpose after archive.
## Requirements
### Requirement: Versioned diagnosis benchmark scenarios with explicit ground truth

The system SHALL maintain a versioned diagnosis benchmark set covering at least eight scenario classes (healthy class, single weak node, multiple weak nodes, subgroup risk, stratified risk, assignment-assessment conflict, thirty-percent data missing, and attribution pressure), where every scenario carries an explicit scenario version, a fixed random seed, the true set of weak knowledge nodes, the primary weak node, data-coverage state, and the allowed diagnosis-conclusion boundary. The benchmark SHALL be generated deterministically from construction parameters and SHALL NOT contain real student identities, raw answers, or private conversations.

#### Scenario: Deterministic regeneration

- **WHEN** the same scenario version and seed are used to generate the governed input and ground truth twice
- **THEN** the generated data SHALL be identical across runs
- **AND** the injected weak-node set SHALL equal the scenario's declared true weak nodes.

#### Scenario: Coverage and conflict configuration

- **WHEN** a scenario declares partial data coverage or an assignment-assessment conflict
- **THEN** the generated governed input SHALL reflect that coverage gap or conflict deterministically
- **AND** the scenario's allowed-conclusion boundary SHALL record that the report must downgrade confidence and state limitations.

### Requirement: Layered evaluation runner with auditable outputs

The system SHALL provide a benchmark runner with two execution modes: a deterministic fixture mode that validates metric computation, threshold judgment, and report handling without contacting external services, and a live mode that calls the real provider at least three replicates per scenario for manual or scheduled evaluation of candidate model, prompt, or release changes. Every run SHALL be identified by a single run ID and SHALL write JSON and CSV detail plus a summary under that run ID, recording scenario versions, seeds, provider, model, prompt, schema, generator and projection versions, and the code revision; outputs of different runs SHALL NOT overwrite each other. Replicate records SHALL keep the ground truth, raw model output, parsed result, and per-replicate metrics under the same run ID.

#### Scenario: Fixture mode in regular verification

- **WHEN** the deterministic fixture evaluation runs as part of regular verification
- **THEN** it SHALL complete without network access and SHALL assert metric values, threshold judgments, and the failure-detail path against known inputs.

#### Scenario: Live mode requires explicit opt-in

- **WHEN** regular verification or an ordinary commit flow executes
- **THEN** the live provider evaluation SHALL NOT run automatically
- **AND** external service fluctuations SHALL NOT turn into unstable gates for ordinary commits.

### Requirement: Accuracy and governance metrics with threshold gates

The evaluation SHALL compute and record node-level precision, recall, and F1, macro and micro F1, exact weak-set match rate, primary weak-node hit rate, healthy-scenario node-level false-positive rate, Simplified-Chinese compliance rate, evidence-reference validity rate, knowledge-node attribution validity rate, resource-coverage judgment accuracy, numeric-claim evidence support, and across-replicate mean, dispersion, and worst-case results plus generation success rate and duration. The governance metrics SHALL reuse the production validation functions (language gate, evidence-reference gate, attribution gate, and calibration gate) rather than re-implementing their semantics. A run SHALL fail its threshold gate when micro precision or recall is below 80%, macro F1 is below 80%, exact match rate is below 75%, primary hit rate is below 85%, healthy-scenario false-positive rate exceeds 10%, any compliance rate is below 100%, or resource-coverage accuracy is below 95%, and the failure output SHALL list the failing scenarios, replicate numbers, expected ground truth, and actual output.

#### Scenario: Threshold failure is diagnosable

- **WHEN** a run violates any threshold
- **THEN** the runner SHALL exit non-zero in gate mode and emit a per-scenario, per-replicate failure listing with expected and actual values.

#### Scenario: Overdiagnosis regression anchor

- **WHEN** the fixture evaluation replays a provider output that reports a relatively-lowest but normal node as weak on a healthy class (the pre-#1728 behavior)
- **THEN** the production calibration gate SHALL reject that output and the evaluation SHALL record the replicate as a calibration rejection rather than a false positive
- **AND** the same output SHALL fail the benchmark when run against the pre-calibration gate semantics.

### Requirement: Benchmark operation documentation

The system SHALL document how to add a new benchmark scenario, update ground truth, run the fixture evaluation, run the live provider evaluation, and interpret the run outputs and thresholds.

#### Scenario: Adding a scenario

- **WHEN** a maintainer follows the documented steps to add a scenario or update ground truth
- **THEN** the new scenario SHALL carry a distinct scenario version and seed
- **AND** the fixture evaluation SHALL pick it up without runner code changes.


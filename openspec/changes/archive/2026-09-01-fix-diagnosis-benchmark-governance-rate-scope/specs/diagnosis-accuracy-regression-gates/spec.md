## MODIFIED Requirements

### Requirement: Accuracy and governance metrics with threshold gates

The evaluation SHALL compute and record node-level precision, recall, and F1, macro and micro F1, exact weak-set match rate, primary weak-node hit rate, healthy-scenario node-level false-positive rate, Simplified-Chinese compliance rate, evidence-reference validity rate, knowledge-node attribution validity rate, resource-coverage judgment accuracy, numeric-claim evidence support, and across-replicate mean, dispersion, and worst-case results plus generation success rate and duration. The governance metrics SHALL reuse the production validation functions (language gate, evidence-reference gate, attribution gate, and calibration gate) rather than re-implementing their semantics, and SHALL measure compliance over successful replicates only (`status === 'ok'`), pooled across all scenarios by replicate rather than by binarized scenario rates: a replicate rejected by the governance gates is evidence that the gates work, is already counted by the generation success rate, and SHALL NOT additionally depress the governance compliance rates; scenarios with no successful replicate SHALL record governance rates of 1, and a run in which any scenario has no successful replicate SHALL fail the threshold gate. A run SHALL fail its threshold gate when micro precision or recall is below 80%, macro F1 is below 80%, exact match rate is below 75%, primary hit rate is below 85%, healthy-scenario false-positive rate exceeds 10%, any compliance rate over successful replicates is below 100%, or resource-coverage accuracy is below 95%, and the failure output SHALL list the failing scenarios, replicate numbers, expected ground truth, and actual output.

#### Scenario: Threshold failure is diagnosable

- **WHEN** a run violates any threshold
- **THEN** the runner SHALL exit non-zero in gate mode and emit a per-scenario, per-replicate failure listing with expected and actual values.

#### Scenario: Governance rejection does not depress compliance rates

- **WHEN** a replicate is rejected by the language, attribution, or calibration gate
- **THEN** the pooled governance compliance rates SHALL exclude it from their denominator
- **AND** the generation success rate SHALL continue to count it as unsuccessful while the rejection reason remains auditable in the replicate record.

#### Scenario: Fully unavailable scenario fails the gate

- **WHEN** a scenario completes with no successful replicate (every attempt generation-failed or governance-rejected)
- **THEN** the run SHALL fail its threshold gate with an explicit scenario successful-replicate floor failure
- **AND** SHALL NOT pass merely because accuracy metrics are null and pooled governance rates default to 1.

#### Scenario: Overdiagnosis regression anchor

- **WHEN** the fixture evaluation replays a provider output that reports a relatively-lowest but normal node as weak on a healthy class (the pre-#1728 behavior)
- **THEN** the production calibration gate SHALL reject that output and the evaluation SHALL record the replicate as a calibration rejection rather than a false positive
- **AND** the same output SHALL fail the benchmark when run against the pre-calibration gate semantics.

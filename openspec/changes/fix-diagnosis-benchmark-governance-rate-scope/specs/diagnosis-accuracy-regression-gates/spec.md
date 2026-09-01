## MODIFIED Requirements

### Requirement: Accuracy and governance metrics with threshold gates

The evaluation SHALL compute and record node-level precision, recall, and F1, macro and micro F1, exact weak-set match rate, primary weak-node hit rate, healthy-scenario node-level false-positive rate, Simplified-Chinese compliance rate, evidence-reference validity rate, knowledge-node attribution validity rate, resource-coverage judgment accuracy, numeric-claim evidence support, and across-replicate mean, dispersion, and worst-case results plus generation success rate and duration. The governance metrics SHALL reuse the production validation functions (language gate, evidence-reference gate, attribution gate, and calibration gate) rather than re-implementing their semantics, and SHALL measure compliance over successful replicates only (`status === 'ok'`): a replicate rejected by the governance gates is evidence that the gates work, is already counted by the generation success rate, and SHALL NOT additionally depress the governance compliance rates; scenarios with no successful replicate SHALL record governance rates of 1. A run SHALL fail its threshold gate when micro precision or recall is below 80%, macro F1 is below 80%, exact match rate is below 75%, primary hit rate is below 85%, healthy-scenario false-positive rate exceeds 10%, any compliance rate over successful replicates is below 100%, or resource-coverage accuracy is below 95%, and the failure output SHALL list the failing scenarios, replicate numbers, expected ground truth, and actual output.

#### Scenario: Threshold failure is diagnosable

- **WHEN** a run violates any threshold
- **THEN** the runner SHALL exit non-zero in gate mode and emit a per-scenario, per-replicate failure listing with expected and actual values.

#### Scenario: Governance rejection does not depress compliance rates

- **WHEN** a replicate is rejected by the language, attribution, or calibration gate
- **THEN** the governance compliance rates SHALL exclude it from their denominator
- **AND** the generation success rate SHALL continue to count it as unsuccessful while the rejection reason remains auditable in the replicate record.

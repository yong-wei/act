## Tasks

- [x] 1. Define the SAR live evaluation report contract.
  - Include query set, baseline comparison, metrics, feedback records, limitations, and privacy boundary.

- [x] 2. Implement report generation from persisted traces and diagnostics.
  - Use governed SAR trace data and ordinary retrieval baseline data.
  - Use official Arena records for official Arena score, validity, ranking, attempt policy, and evaluation metrics.

- [x] 3. Add evaluation records and export/render evidence.
  - Include at least two target-user feedback records or structured test records.

- [x] 4. Preserve Arena official evaluation source authority.
  - Label LearningFact, SAR trace, KAQ writeback, and learner evidence projections as auxiliary learning context only.

- [x] 5. Validate the change.
  - Run `rtk openspec validate produce-sar-live-evaluation-report --strict`.
  - Run targeted SAR evaluation, export, and privacy tests.

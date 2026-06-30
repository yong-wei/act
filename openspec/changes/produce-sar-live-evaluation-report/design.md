## Design

The live evaluation report should transform SAR from a deterministic fixture into auditable evaluation evidence. It should use persisted query traces and diagnostics, not ad hoc screenshots or one-off console output.

## Report Contents

The report should include representative query set, use cases, role scope, SAR-assisted candidate refs, ordinary retrieval baseline refs, multi-hop hit judgment, verified citation rate, Source Pack handoff, privacy rejection counts, candidate adoption/rejection, and limitations.

At least two records should come from target-user feedback or structured test sessions. If true classroom users are unavailable, structured test records must state actor role, task, expected evidence, observed result, and limitation.

## Output Boundary

The report may be an administrator page, export artifact, or data-governance report payload. It must not present SAR candidate refs as verified citations and must not expose restricted raw content.

Arena metrics in the report must preserve official authority boundaries. Official score, validity, ranking, attempt policy, and evaluation metrics must come from persisted `ArenaSubmission` or official evaluation run records. `LearningFact`, SAR trace, KAQ writeback, and learner evidence projections may explain learning context or adoption, but must be labeled as auxiliary learning evidence rather than official Arena outcomes.

## Verification Strategy

- Unit tests for metric calculation and baseline comparison.
- Tests proving Arena official metrics are sourced from ArenaSubmission or official evaluation run records.
- Export/render tests for forbidden raw content.
- Evidence artifact checked into the appropriate governance artifact path if implementation produces a static report.
- OpenSpec strict validation.

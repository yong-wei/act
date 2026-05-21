## Why

Legacy or missing classroom submit envelopes can still be materialized as LearningFact rows with default competency contribution. That can pollute student competency snapshots by treating weak evidence as equal to rich objective submissions.

## What Changes

- Add profile contribution policy based on evidence quality.
- Keep low-quality facts available for reports and audit while preventing them from advancing competency scores as rich evidence.
- Write profileWeight or skipProfileContribution metadata into contextJson.evidenceGovernance.
- Preserve official Arena evaluation evidence as high-quality only when it is server-side official evidence.

## Capabilities

### New Capabilities

- `learning-fact-quality-weight`

### Modified Capabilities

- None.

## Impact

- src/lib/data-governance/learning-fact-materialization.ts
- src/lib/data-governance/competency-engine.ts
- data-governance tests

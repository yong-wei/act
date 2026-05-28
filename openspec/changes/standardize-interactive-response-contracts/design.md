## Context

The shared activity renderer already handles most activity-card pages through one `StudentCards` renderer, but the manifest surface still allows many interaction and response aliases. The existing objective scorer already supports structural partial credit for multi-select, ordering, and matching; this change makes the response vocabulary line up with that scorer and with durable submission evidence.

## Canonical Response Kinds

Use these response kinds for migrated and new lessons:

- `choice.single`
- `choice.binary`
- `choice.multi`
- `text.short`
- `text.long`
- `text.structured`
- `parameter.set`
- `ordering.sequence`
- `matching.pairs`
- `table.builder`
- `simulation.result`
- `training.result`

Historical aliases such as `single_choice`, `binary_choice`, `multi_choice`, `multi_select`, `fill_text`, `text`, `short_response`, `short_text`, `observation_text`, `drag_sort`, `card_sort`, `drag_match`, `triple_match`, and `match` should normalize to these canonical kinds during migration.

## Scoring Policy

- Multi-choice scoring identifies correct hits, missed correct options, extra wrong options, and duplicate submitted options.
- Ordering scoring reports correct positions and partial position or sequence credit.
- Matching scoring compares prompt-side item to answer-side option after normalizing pair order.
- Pair syntax and slot-order syntax must both be supported while legacy manifests are still being migrated.
- Unsupported scoring must be explicit; do not store an apparent zero for an unscoreable subjective answer.

## Non-Goals

- Do not redesign the visual activity card UI in this change.
- Do not migrate all lessons in this change.
- Do not invent per-course scoring rules.

## Verification

- Add response-normalization tests for every alias family.
- Add scoring tests for multi-choice partial credit, ordering partial credit, pair-order-independent matching, duplicate matching conflicts, and legacy slot-order matching.
- Run `npm run test:course-data-quality-gates` and focused manifest telemetry tests.
- Run `openspec validate standardize-interactive-response-contracts --strict`.

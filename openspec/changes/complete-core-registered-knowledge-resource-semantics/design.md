## Semantic Review Protocol

The implementing agent must inspect each selected resource and assign fields based on resource meaning. The agent must not stop merely because a field is marked `needs-human-review`, `semantic-review-required`, or similar. In this project, that label means an implementing agent performs semantic review and an independent reviewer checks the evidence.

Scripts may be used only to:

- enumerate stable workqueue items
- show current missing fields
- validate that completed fields satisfy the helper
- produce before/after summaries

Scripts must not auto-fill K/A/Q mappings, graph refs, path disposition, path stage, evidence policy, or review rationale as accepted completion.

## Batch Boundary

In scope:

- registered resource records
- knowledge cards
- knowledge infographs
- their direct citation targets and launch targets

Out of scope:

- runtime lesson step/media families
- textbook/reference search-document rows
- assessment item semantic review

Ambiguous resources should be classified with reviewed limitation or exclusion rationale rather than promoted to path-plannable.

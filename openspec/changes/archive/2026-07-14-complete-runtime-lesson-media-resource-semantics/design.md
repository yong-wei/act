## Semantic Review Protocol

The implementing agent must inspect runtime manifests, parent lesson context, route availability, media metadata, transcript/description anchors where present, and graph/LearningGoal fit. The presence of `semantic-review-required` or `needs-human-review` means the implementing agent performs the review. It is not a reason to stop.

Helper scripts may select queues and verify before/after counts. They must not bulk-generate accepted graph refs, K/A/Q mappings, path stages, or review rationale.

## Batch Boundary

In scope:

- runtime lesson steps and planning units
- runtime lesson modules
- runtime lesson media
- slides, audio, video, PDFs, and handouts
- parent links between fragments and executable lesson steps

Out of scope:

- textbook/reference section and chunk review
- assessment item semantics
- planner loader changes

Each resource must end with a reviewed disposition. If a module or asset is not independently launchable, it should be linked to a parent PlanningUnit or classified with a reviewed support/exclusion rationale.

LearningGoal baseline artifacts are regenerated from the current audit and promotion contract on every run. Existing baseline artifacts may be compared for stable resource identity, but their historical `pathEligible` or `pathEligibleResourceIds` values are never restored. A resource whose current audit row has `pathEligibility.current=false` remains outside the baseline PathNode set until its explicit promotion gate passes.

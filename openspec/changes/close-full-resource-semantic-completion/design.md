## Closure Criteria

The final closure should run against the current integration branch after dependency changes are complete.

Required zero or reviewed-limitation states:

- missing path-planning disposition
- unreviewed semantic fields
- invalid path promotions
- missing graph/K/A/Q bindings for path-plannable resources
- missing parent PlanningUnit links for embedded/supporting resources
- missing exclusion rationale
- missing evidence-lineage policy for mastery-affecting or checkpoint resources
- missing citation addressability for citation-ready resources

All nine path-ready LearningGoals must have all-goal diagnostics that either produce meaningful governed paths or report a specific reviewed blocker. Cosmetic multi-path variants are not acceptable.

## Agent Boundary

This issue may repair small residual records discovered by closure checks. It must not absorb another large unbounded semantic review batch. If a new large family appears, the agent should create or request a new scoped change rather than marking the closure complete.

## Verification Strategy

- Full helper and ResourceNode audit.
- Full-resource path-readiness gate.
- All-LearningGoal path diagnostics.
- Citation resolver/RAG checks for selected path and support resources at the resource metadata and path-explanation layer. Konling answer relevance filtering remains covered by the dedicated Konling citation-relevance change.
- New-resource completeness gate without baseline-only loopholes for current resources.

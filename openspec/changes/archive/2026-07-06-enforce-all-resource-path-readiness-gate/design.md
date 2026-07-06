## Design

The final gate should answer four questions:

1. Has every existing resource been discovered?
2. Does every resource have a reviewed path-planning disposition?
3. Can every registered LearningGoal generate executable paths using governed resources?
4. Can planner explanations and Konling answers cite selected or supporting resources with verified citation metadata?

## Gate Inputs

- data-completeness helper JSON;
- ResourceNode registry audit;
- runtime lesson/textbook/reference resource catalogs;
- reviewed assessment item catalog;
- RAG corpus and citation resolver;
- backend registered LearningGoal list;
- targeted path-generation diagnostics.
- helper summarized evidence: layer totals, resource family totals, unaccounted count, invalid promotion count, unreviewed semantic count, evidence-lineage blockers, follow-up buckets, and Yang Fan fixture blockers.

## Success Criteria

The gate should not require every resource to be path-plannable. It should require every resource to be accounted for. A resource is accounted for when it is path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale with reviewed metadata.

For every registered LearningGoal, path generation should produce a usable path or a narrowly explained content gap. Once this change is complete, gaps should be exceptional and actionable, not the default state for most resources.

## Why

The helper reports path readiness and learner fixture readiness are blocked not only by resource metadata, but also by broken source-event lineage: missing EventDictionary mappings, missing attempt keys, missing client event ids, stale feature caches, and path executions without evidence references. Path planning can select resources only if their execution and evidence behavior are governed.

## What Changes

- Complete evidence-lineage readiness for all core, long-form, and assessment/practice resources intended to affect path state, mastery, checkpoint outcomes, or learner personalization.
- Add EventDictionary mappings and source-event attribution for resource events needed by path planning.
- Require helper-driven before/after evidence-lineage validation.
- Keep learner fixture generation blocked until resource evidence contracts and source lineage are sufficient.

## Impact

- Extends course data-quality gates, ResourceNode evidence contracts, and learner-state readiness.
- May update event dictionaries, instrumentation mappings, fixture preconditions, and evidence materialization tests.
- Does not create Yang Fan fixture data directly.

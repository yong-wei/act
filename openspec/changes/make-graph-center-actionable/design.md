## Action Model

Graph Center actions should be derived from selected graph node, active role, active overlay mode, selected LearningGoal, coverage state, and authorization.

Action families:

- student: start or continue path, inspect recommended resources, review personal evidence, ask Konling with graph context;
- teacher: inspect class weak node, open affected population summary, generate or review prep-pack draft, inspect resource coverage gaps;
- admin: inspect binding/citation/path-audit diagnostics, review stale overlay/version limitations.

## UI Contract

Actions should appear in node detail and non-canvas fallback views. They must have explicit text labels and disabled/degraded reasons. Color-only affordances are not sufficient.

Mobile behavior should use the existing drawer/list fallback rather than relying on canvas hit testing.

## Routing

Action targets should use server-owned route params and stable ids:

- LearningGoal id for path entry;
- graph domain and node id for graph context;
- ResourceNode ids for path-eligible resources;
- citation refs for source inspection;
- diagnosis/prep-pack ids or query scopes for teacher actions.

Graph Center must not construct unsafe URLs from model output or raw resource content.

## Boundaries

This change creates action entry points and payload contracts. It does not implement ranking, CP-SAT path repair, evidence writeback, graph editing, or prep-pack generation internals.

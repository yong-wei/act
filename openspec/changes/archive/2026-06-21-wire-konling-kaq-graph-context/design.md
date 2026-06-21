## Context Shape

Konling graph context should be an assembled server-owned payload. It may be built from page context, selected LearningGoal, expanded subgraph, current path round, learner/class overlay, resource coverage, verified citation candidates, and artifact version refs.

The context is not a prompt-only blob. It is a structured contract that the runtime and tests can inspect.

## Contract

The context should include:

- `learningGoal`: id, title, version, objective boundary, policy family, terminal validation policy.
- `selectedGraphNodeIds`: nodes relevant to the current page, path node, or user question.
- `expandedSubgraph`: K/A/Q node ids, prerequisite policy, checkpoint suggestions, terminal validation candidates, limitations.
- `learnerOverlay` and `classOverlay`: authorized state summaries, confidence, evidence windows, limitations.
- `resourceCoverage`: linked/path/citation/terminal counts and missing coverage classes.
- `pathArtifact`: current path option, current node, selected/rejected alternatives, execution and validation state.
- `citationRefs` and `evidenceRefs`: server-owned refs that citation verification can resolve.
- `versionRefs`: LearningGoal, graph catalog, resource registry/projection, overlay, path, and planner versions where available.
- `missingGrounding`: explicit limitations when a required context class is unavailable.

## Runtime Rules

Konling may use graph context to explain:

- why a path was generated;
- why a resource was recommended;
- which graph node or capability target is currently weak;
- why a validation or evidence state is tentative;
- what action is available next.

Konling must not:

- expand user permissions from client hints;
- infer mastery from teacher targets alone;
- treat unverified citations as proof;
- write learner overlay state directly from prose output;
- hide missing graph, resource, path, or citation context when making personalized claims.

## Degraded States

If graph context is incomplete, the runtime should return a degraded context with `missingGrounding` rather than falling back to authoritative generic advice. Generic course help can still be answered from ordinary high-authority content retrieval, but personalized graph/path claims must declare the missing classes.

## Boundaries

Evidence writeback is handled by `govern-kaq-evidence-writeback`. Resource ranking is handled by `resource-learner-matching-ranker`. This change only wires the assistant context contract and runtime consumption boundary.

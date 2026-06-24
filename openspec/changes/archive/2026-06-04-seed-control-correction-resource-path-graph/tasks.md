## 1. Seed Graph

- [x] 1.1 Create a versioned control-correction ResourceNode seed set.
- [x] 1.2 Include knowledge, exercise, simulation, Arena, reflection, and AI-intervention node types.
- [x] 1.3 Define prerequisites, alternatives, remedial edges, terminal edges, estimated time, knowledge coverage, and ability impact metadata.
- [x] 1.4 Define evidence instrumentation for every path-eligible node.

## 2. Registry Audit

- [x] 2.1 Extend or configure the registry audit for control-correction seed data.
- [x] 2.2 Mark nodes without verified launch target, evidence hook, knowledge mapping, or privacy policy as not path-eligible.
- [x] 2.3 Add fixtures for valid and invalid seed nodes.

## 3. Verification

- [x] 3.1 Add tests that the graph produces a feasible seeded path under a 90-minute budget.
- [x] 3.2 Add tests that terminal simulation and Arena nodes are discoverable by the planner.
- [x] 3.3 Add tests that invalid seed nodes never appear in generated candidate paths.
- [x] 3.4 Run `rtk openspec validate seed-control-correction-resource-path-graph --strict`.
- [x] 3.5 Run the focused ResourceNode registry and planner fixture tests.

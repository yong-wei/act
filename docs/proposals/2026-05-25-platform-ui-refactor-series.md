# Platform UI Refactor Series

This note records the execution order for the OpenSpec UI refactor series derived from `docs/ui-refactor-report-pro.md`. It assumes the active simulation, adaptive, ResourceNode, teacher-management, and governance changes will land.

## Series Order

1. `unify-platform-design-system-and-shell`
   - Establish semantic tokens, AppShell contracts, shared primitives, feature flags, and repository ownership boundaries.
   - Downstream UI changes must not move business logic into shared primitives.

2. `standardize-platform-status-and-evidence-ui`
   - Establish common status language for confidence, privacy, source coverage, readiness, replay, official/preview boundaries, and fallback states.
   - Can start after the foundation contract is available.

3. `normalize-role-navigation-and-entrypoints`
   - Migrate homepage, login, student dashboard, profile/cockpit actions, and mobile drawer behavior to the unified role navigation model.
   - Depends on the foundation shell and consumes feature flags for future routes.

4. `establish-platform-data-center-ui`
   - Split presentation-mode `/data-center` from admin governance data-center views while sharing chart and status primitives.
   - Depends on foundation, navigation, and shared status contracts.

5. `converge-resource-node-knowledge-workspace-ui`
   - Convert the knowledge graph into a ResourceNode-aware workspace without taking ownership of resource implementations.
   - Wait for `register-path-plannable-resource-nodes` before enabling ResourceNode panels beyond feature-flagged placeholders.

6. `unify-simulation-arena-workbench-experience-shells`
   - Unify Simulation Hub, scene pages, Arena, challenge detail, and Workbench experience shells.
   - Consumes the active virtual-simulation refactor series and must preserve DB BOPPPS course launch, `ResourceRenderer`, `InteractiveProvider`, `BaseWidgetProps`, and registry config merge behavior.

7. `converge-adaptive-learning-center-ui`
   - Consolidate `/ai`, `/ai/copilot`, `/assessment/adaptive-practice`, and profile recommendations into one student adaptive center.
   - Wait for learner-state, assessment, ResourceNode, path MVP, and Konling runtime contracts before enabling full views.

8. `build-teacher-admin-governance-workspaces-ui`
   - Provide teacher/admin governance workspace shells, status display, redaction, and action placement.
   - Consumes `teacher-resource-node-management`; it does not reimplement ResourceNode edit rules or own teacher homepage redesign.

9. `add-adaptive-experiment-operations-ui`
   - Define Stage 2 experiment, bandit, memory audit, and teacher bulk-operation surfaces.
   - Must wait for Stage 1 adaptive center, teacher governance, privacy, evaluation, and optimization experiment prerequisites.

## Cross-Series Gates

- Every change must pass `rtk proxy npx openspec validate <change-id> --strict`.
- UI implementation changes must include focused source/unit tests for contracts and browser checks for affected routes.
- Route migrations must keep legacy routes working until the replacement has equivalent tests.
- Presentation views must retain demo/real/partial/stale/restricted source markers.
- Course-launched resources must remain registry-driven and must not bypass the lesson engine.

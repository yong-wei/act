## 1. Journey Contract And Server State

- [x] 1.1 Define the authorized adaptive-path journey view, next-action states, and shared builders for current progress, return target, ready next node, blocked result, and completed path.
- [x] 1.2 Add an owner-validated journey read endpoint and return the recomputed journey view from new and idempotently replayed execution completion writes.
- [x] 1.3 Add API and unit coverage for ready, blocked, pending-result, path-complete, unauthorized, and replayed journey states.

## 2. Arena Target Integrity

- [x] 2.1 Enforce concrete `arena-task:<taskId>` identity and `/arena/challenges/<taskId>` launch targets in ResourceNode, fixture, and restored-path validation.
- [x] 2.2 Repair the Yang Fan diagnostic fixture and add deterministic repair-or-block behavior for persisted generic Arena targets.
- [x] 2.3 Add registry, fixture, restore, and route tests that reject `/arena` or knowledge-node placeholders as executable Arena path nodes.

## 3. Shared Path Journey Controls

- [x] 3.1 Implement the shared path journey hook and accessible journey control for return, current progress, next-node, pending-result, blocked, and path-complete states.
- [x] 3.2 Integrate the control with generic interactive resources, interactive lessons, knowledge cards, textbook sections, slides, and other governed platform-owned course/media targets without changing non-path navigation.
- [x] 3.3 Keep adaptive assessments, checkpoints, reflections, Konling, and equivalent AI-intervention nodes inside the owning path-center journey or integrate the control on any platform-owned route they launch.
- [x] 3.4 Implement the external-resource fallback that keeps the path center available, refreshes authoritative state on return, and advances only from governed explicit-access/completion evidence without a second start action.
- [x] 3.5 Integrate the control with simulation and control-workbench shells while keeping completion evidence resource-owned and server-validated.

## 4. Compact Path Execution Workspace

- [x] 4.1 Extract a compact path timeline and node component with adaptive connectors, single-node inline expansion, and node-attached start/skip/review/continue/evidence actions.
- [x] 4.2 Add a centralized accessible resource-type visual map and keep execution-state cues independent from type color.
- [x] 4.3 Reorder the `path-execution` workspace around a compact progress summary and journey, demote repeated secondary modules, and repair the shared module header at 320px and above.

## 5. Arena Path Journey

- [ ] 5.1 Parse and validate adaptive path context on concrete Arena challenge routes, render journey controls, and avoid treating detail views as completion.
- [ ] 5.2 Preserve normalized path and publication parameters through `getArenaWorkspaceHref` into Control Odyssey or the unified control workbench.
- [ ] 5.3 Bind Arena next-step enablement to the server-owned Arena result and terminal-validation state without exposing hidden evaluation details.

## 6. Verification And Visual Acceptance

- [ ] 6.1 Add a node-type support-matrix test plus interaction coverage for node focus, inline actions, completion-to-next navigation, blocked results, final-node completion, external fallback, and non-path compatibility.
- [ ] 6.2 Add Arena end-to-end coverage from a path node through concrete challenge and workbench while retaining return and next-step context.
- [ ] 6.3 Capture and inspect 1440px, 375px, and 320px execution states in light and dark themes, then run typecheck, targeted unit/API tests, Playwright, and strict OpenSpec validation.

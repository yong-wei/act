## Context

The current routing helper sends black-box tasks to `/simulations/cruise`, block-diagram tasks to `/interactive-learning/lesson-05`, MPC tasks to a lesson route, and default white-box tasks to `/interactive-learning/multi-representation-linkage`. The target architecture is different: Arena is the official evaluation and evidence layer, while the comprehensive control workbench is the default design and submission environment.

This change is intentionally last in the series. It should wait until the unified workbench route exists and the Arena backend/reporting work is stable, because switching links before the target route is ready would create broken student paths.

## Goals / Non-Goals

**Goals:**
- Make `getArenaWorkspaceHref` route most Arena tasks to `/interactive-learning/control-workbench`.
- Preserve Control Odyssey's dedicated route.
- Pass `arenaTask`, `publicationId`, and preset parameters correctly.
- Update student-facing entry copy to `进入控制工作台`.
- Keep old direct entry routes usable for bookmarked or lesson-local links.

**Non-Goals:**
- No implementation of the unified workbench shell.
- No black-box evaluator or report changes.
- No migration of Control Odyssey into the unified workbench.
- No deletion of legacy route components.

## Decisions

- Route by exception rather than by every `workspaceMode`.
  Rationale: the new default is comprehensive control workbench; Control Odyssey is the only first-stage exception.

- Use `preset: task.workspaceMode` in the control-workbench URL.
  Rationale: the workbench can choose its layout and method panels from task context while preserving the original task's recommended workspace mode.

- Keep legacy direct pages rendering in the first integration pass.
  Rationale: removing or redirecting old pages at the same time as the default route switch increases regression risk; direct route compatibility can be tightened later.

- Keep `publicationId` as a plain query parameter.
  Rationale: `/api/arena/evaluate` and submission history already use `publicationId`; the route helper should pass it through without inventing new assignment context syntax.

- Do not expose internal workspace mode names as primary call-to-action text.
  Rationale: students should see a stable product concept, while task details can still show recommended methods and preset context.

## Risks / Trade-offs

- [Risk] The target control-workbench route may not exist when this change is applied. → Mitigation: make route existence and basic page render a precondition in tasks and tests.
- [Risk] Publication context could be dropped during route construction. → Mitigation: add route-helper tests for `publicationId` and extra params.
- [Risk] Legacy tests may still assert old workspace labels. → Mitigation: update tests to verify the new unified label while retaining task method and preset display.
- [Risk] Control Odyssey could be accidentally routed away from its bridge. → Mitigation: add explicit tests for object source and `workspaceMode === control-odyssey`.

## Migration Plan

1. Confirm `/interactive-learning/control-workbench` exists and accepts `arenaTask` query context.
2. Update `getArenaWorkspaceHref` to default to control workbench with preset params.
3. Update student-facing entry copy on hall and challenge detail surfaces.
4. Keep legacy route components in place for direct access.
5. Update and run routing and entry UI tests.

## Open Questions

- Whether legacy `/interactive-learning/multi-representation-linkage?arenaTask=...` should later redirect to the unified workbench after the first integration pass proves stable.
- Whether `preset` values should remain raw `WorkspaceMode` ids or be mapped to the existing `WorkbenchPresetId` ids in a later contract refinement.

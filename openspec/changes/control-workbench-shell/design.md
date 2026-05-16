## Context

Current Arena routing is task-first, but `workspace-routing.ts` still sends each `workspaceMode` to a different product surface. `resolveArenaWorkbenchContext` already returns the task, object, metrics, leaderboard policy, capabilities, allowed methods, and return URL. The missing boundary is a workbench-level session object that can describe both challenge-bound and free-explore sessions without leaking official target details to the wrong view.

## Goals / Non-Goals

**Goals:**
- Establish the unified workbench route and shell without migrating every existing workbench.
- Make challenge mode and free-explore mode explicit.
- Separate `officialTarget` from `workingModel`, especially for future black-box work.
- Preserve fail-closed behavior for missing or incompatible challenge context.

**Non-Goals:**
- No full migration of multi-representation, black-box, composite, MPC, or Odyssey workflows in this change.
- No new official evaluator or leaderboard implementation.
- No database model for saved workbench sessions yet.

## Decisions

- Create `src/features/control-workbench` outside `src/features/arena`.
  Rationale: Arena remains the evaluation and leaderboard domain; the workbench is the design surface consuming Arena context. Putting all UI under Arena would make the evaluation domain harder to keep layer-safe.

- Use a `WorkbenchSessionContext` wrapper rather than expanding `ArenaWorkbenchContext` directly.
  Rationale: Arena context is task policy; workbench context adds route mode, layout preset, official target, working model, and submission policy. This keeps existing Arena tests stable.

- Treat invalid `arenaTask` as a blocking error.
  Rationale: Existing Arena specs already forbid silently falling back to a default model. A wrong task should never produce charts or submissions for the wrong plant.

- Keep the shell presentational in phase one.
  Rationale: The first change must be low risk and create the host for later presets. It should not move numerical logic yet.

## Risks / Trade-offs

- [Risk] The shell may duplicate some multi-representation header information at first.
  → Mitigation: keep duplicated UI small and delete it when the classic preset migrates.

- [Risk] A broad context type can become a dumping ground.
  → Mitigation: keep `WorkbenchSessionContext` limited to routing, policy, target/working model, layout, and submission eligibility.

- [Risk] Free-explore mode may look like it can submit.
  → Mitigation: encode `submissionPolicy.canSubmitOfficial = false` and render a clear Chinese status.

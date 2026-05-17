## Context

The unified control workbench route and shell already exist, and Arena routes supported non-Odyssey tasks to that route. Free exploration still enters the legacy multi-representation page from `/interactive-learning/cross-domain-exploration`, and the classic four-view preset currently refuses to render unless the session is challenge-bound with a `taskId`.

The first foundation change should make the shared workbench usable for free exploration without absorbing the later UI work for collapsible object selection, parameter drawer repair, or chart option fixes.

## Goals / Non-Goals

**Goals:**

- Make “综合仿真工作台” the visible product name for the unified workbench entry and shell.
- Route cross-domain free exploration to the unified control workbench with the classic four-view preset.
- Give free-explore sessions a selected white-box object and nominal transfer-function working model.
- Let the classic four-view preset render with a configured free-explore model as well as with Arena challenge context.
- Keep Arena challenge routing and legacy multi-representation direct route behavior compatible.

**Non-Goals:**

- Do not redesign the object selector UI.
- Do not fix parameter drawer layout or active-state colors.
- Do not alter chart range, legend, root-locus, or Nyquist behavior.
- Do not change official Arena evaluation, submission, or leaderboard semantics.

## Decisions

1. Free exploration uses `origin/integration` as the Buddy base branch and a default white-box object from the existing Arena object catalog.
   - Rationale: the object catalog already carries model, range, seed, and visibility metadata. Reusing it avoids creating a second object registry.
   - Alternative considered: inventing a separate free-explore object list. That would immediately duplicate object truth and conflict with the later object selector change.

2. `ExploreWorkbenchSessionContext` carries the selected object and working model, while `officialTarget` remains `null`.
   - Rationale: free exploration needs a model to render panels, but it must remain outside official evaluation and leaderboard semantics.
   - Alternative considered: creating a synthetic Arena task for free exploration. That would blur official challenge and local exploration semantics.

3. The classic preset accepts any session with a transfer-function working model and the four required views.
   - Rationale: the preset requirement is a usable SISO LTI model, not the existence of an Arena task.
   - Alternative considered: keeping `taskId` as a hard gate and forwarding a hidden Arena task id. That would make free exploration appear challenge-bound.

4. The embedded multi-representation client receives a configured plant model for free-explore sessions.
   - Rationale: the existing chart client already supports non-Arena mode; passing the plant model lets it use the selected object without changing official Arena paths.
   - Alternative considered: replacing the chart client in this change. That is too large and belongs to later panel refactoring.

## Risks / Trade-offs

- Free-explore object selection is still minimal in this change. → Mitigation: support an `objectId` route parameter and default object now; leave full collapsible selector UI to the dedicated object-selector issue.
- The classic preset still embeds the legacy multi-representation client. → Mitigation: rename the surrounding workbench and route surface now, while preserving the legacy route as compatibility.
- Source-based tests in this area are brittle. → Mitigation: add direct resolver assertions for session semantics and keep source assertions focused on routing and mount gates.

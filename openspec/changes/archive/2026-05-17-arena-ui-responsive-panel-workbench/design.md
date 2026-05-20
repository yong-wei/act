## Context

Arena currently has four coupled problems. The student shell still carries a dark fixed left navigation in light mode, the hall layout spends too much vertical and horizontal space before showing challenge cards, challenge detail and workbench pages still use several white backgrounds in dark mode, and the control workbench assumes one global configuration per view type instead of independent panel instances.

The official Arena submit path is also failing from the student surface with `Arena evaluation failed`. That failure must be reproduced from a real student login before changing evaluator or persistence code, because the root cause may be API payload shape, auth/session context, evaluator semantics, persistence, or UI error handling.

## Goals / Non-Goals

**Goals:**

- Make Arena hall and challenge detail navigation match the homepage entry model: four left entries and a fixed personal-center entry on the right.
- Make Arena hall and challenge detail pages theme-correct in light and dark modes.
- Increase Arena hall density by using equal-height title/search regions and two-column challenge cards on desktop.
- Replace the workbench's single global view configuration model with responsive panel instances.
- Keep each panel's configuration local to that panel, including multiple panels of the same type.
- Change Nyquist configuration to single selection, matching the root-locus interaction model.
- Reproduce and repair the official evaluation failure with a student account and browser evidence.

**Non-Goals:**

- Do not redesign the homepage beyond matching its established entry pattern.
- Do not change Arena scoring policy, leaderboard ranking semantics, or challenge authoring data unless the official evaluation failure requires a narrow compatibility fix.
- Do not remove legacy direct workbench routes.
- Do not introduce a database migration unless debugging proves the failure is a persistence contract mismatch.

## Decisions

1. Keep Arena routing stable and change the rendered experience after route resolution.
   - Rationale: existing specs already route supported non-Odyssey tasks to `/interactive-learning/control-workbench`; changing routes would create unnecessary compatibility risk.
   - Alternative considered: create a new challenge-workbench route. This would duplicate routing and submission logic without solving the layout or panel state issue.

2. Model the workbench surface as ordered panel instances instead of `viewId -> config`.
   - The panel state should have an instance identity and view identity, for example `id`, `viewId`, `title`, `selectedOptions`, and `settings`.
   - Rationale: the requested behavior allows multiple panels of the same view type. A map keyed only by `viewId` cannot represent two Bode panels with different options.
   - Alternative considered: keep the map and add duplicated synthetic view ids. That would leak layout concerns into view definitions and make allowed view metadata harder to reason about.

3. Derive default panel layouts from the current challenge or preset, then let students add and remove only allowed panel types.
   - Rationale: challenge modes need useful defaults, but the page must remain constrained by the data available in the current session.
   - Alternative considered: allow all view types everywhere. That would reintroduce unavailable chart states and placeholder data.

4. Move view controls into each panel header behind a configuration button.
   - Rationale: deleting the outer shell removes the only place where view configuration currently lives. The configuration must travel with the panel it controls.
   - Time-domain, Bode, and root-locus option behavior should be preserved. Nyquist should become single selection to avoid ambiguous overlay interpretation.

5. Treat official evaluation as a browser-debugged student flow, not only an API unit problem.
   - Rationale: the reported failure appears after clicking the student submit control. The acceptance evidence must include UI, request payload, response, and persistence outcome from a student session.
   - Alternative considered: patch `/api/arena/evaluate` from code inspection only. That risks fixing the wrong layer and leaving the student flow broken.

## Risks / Trade-offs

- Panel instance migration may break existing default presets if the old config map is removed too early. Mitigation: keep a compatibility adapter from current preset/view config into initial panel instances.
- Multiple same-type panels can increase render cost for charts. Mitigation: make add/remove explicit, keep defaults conservative, and avoid rendering hidden panels.
- Theme fixes can regress contrast in one mode while improving the other. Mitigation: verify light and dark Arena hall, detail, and workbench states in browser screenshots.
- Official evaluation failure may be data-dependent. Mitigation: reproduce with the documented student account and one supported white-box challenge before applying a fix.

## Migration Plan

1. Update Arena shell, hall, and detail UI without changing route contracts.
2. Introduce the panel-instance state shape behind the existing workbench entry route.
3. Move view configuration controls from the deleted shell area into panel headers.
4. Change Nyquist option handling to single selection and verify chart rendering still receives valid data.
5. Reproduce and repair the student official evaluation failure.
6. Run lint, tests, build, and browser visual/interaction checks before opening the integration PR.

## Open Questions

- Whether panel layout persistence should remain browser-session only or become durable per user is out of scope for this change unless a current persistence mechanism already exists.
- Whether mobile should allow manual panel ordering by drag-and-drop is out of scope; responsive stacking and add/remove controls are sufficient for this change.

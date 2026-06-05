## 1. Workspace Shell

- [ ] 1.1 Define mission-workspace layout rules for context strip, command bar, instrument area, evidence rail, support drawer, and bottom controls.
- [ ] 1.2 Apply the shell to Control Workbench and preserve return targets.
- [ ] 1.3 Apply the shell to representative Arena challenge, simulation, and lesson runtime routes.
- [ ] 1.4 Apply or explicitly except classroom student player, independent lesson runtime, course-launched simulation, Arena-launched Workbench, and course-launched Workbench routes in the route ledger.
- [ ] 1.5 Verify `ControlWorkbenchShell`, `ArenaPageShell`, simulation routes, lesson runtime routes, and `simulation-arena-workbench` experience shell contracts preserve launch provenance and task identity.

## 2. Mobile Structure

- [ ] 2.1 Move object selection, method boundaries, and panel setup into mobile sheets or drawers.
- [ ] 2.2 Ensure Control Workbench mobile first viewport shows object, current step, and one primary view entry.
- [ ] 2.3 Verify floating dock safe area and local tool controls do not collide.
- [ ] 2.4 Verify 320px workspace evidence keeps primary instrument/canvas visible before long explanations or secondary configuration.

## 3. Verification

- [ ] 3.1 Run workspace route and panel geometry tests.
- [ ] 3.2 Capture 1440px and 320px light/dark screenshots for representative workspace routes.
- [ ] 3.3 Verify one existing `course-content/runtime/lessons/*/interactive-manifest.json` lesson consumes runtime truth and preserves step navigation, activity submission, telemetry summary, teacher insight, and teacher controls.
- [ ] 3.4 Verify Arena to Workbench to submission to return target to evidence rail remains connected.
- [ ] 3.5 Run `rtk openspec validate redesign-immersive-learning-workspaces --strict`.

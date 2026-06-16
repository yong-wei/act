## 1. Generation Panel

- [ ] 1.1 Replace static generation summaries with a desktop panel and mobile sheet.
- [ ] 1.2 Implement editable controls for goal, time budget, difficulty rhythm, resource preferences, checkpoint density, external resources, and natural-language intent.
- [ ] 1.3 Ensure the shared Konling floating dock remains separate from the generation panel.

## 2. Request and Tool Wiring

- [ ] 2.1 Build the structured path-generation request from panel values.
- [ ] 2.2 Pass panel values to the governed planner or Konling path-advisor tool.
- [ ] 2.3 Persist auditable request metadata without leaking raw internal fields to the student UI.

## 3. Option Comparison

- [ ] 3.1 Render three comparable path option slots with resource mix, readiness, checkpoints, expected result, and risk note.
- [ ] 3.2 Wire select, adjust, reject, and explanation actions to governed path activity.
- [ ] 3.3 Preserve alternatives after selection.

## 4. Validation

- [ ] 4.1 Add tests proving edited parameters reach the generation request.
- [ ] 4.2 Capture desktop and mobile screenshots against the approved visual sources.
- [ ] 4.3 Verify the textarea is editable and no internal engineering strings are visible.
- [ ] 4.4 Run `rtk openspec validate redesign-adaptive-path-generation-panel --strict`.

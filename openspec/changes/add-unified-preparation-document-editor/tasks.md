## 1. Editor foundation

- [ ] 1.1 Evaluate maintained React editor dependencies against Markdown, tables, formulas, code, accessibility, serialization, and bundle impact, and record the selected dependency.
- [ ] 1.2 Add the project-owned editor adapter and canonical lesson, course-basis, and courseware integration serializers.
- [ ] 1.3 Implement full-screen layout, structure navigation, save state, autosave, explicit save, conflict-safe exit, and restoration of the originating task and accordion position.
- [ ] 1.4 Add the narrow-screen document-first layout with structure and suggestion drawers, accessible save status, and no horizontal page scrolling.

## 2. Domain integration

- [ ] 2.1 Map six fixed BOPPPS stages and editable ordered internal steps to the existing lesson schema.
- [ ] 2.2 Replace paused-outline and generated-draft browser prompt or raw-object editing with the unified editor.
- [ ] 2.3 Integrate editable course-basis versions and frozen-version successor creation.
- [ ] 2.4 Add positioned AI suggestions with accept and ignore states that do not approve the lesson.
- [ ] 2.5 Integrate smart-courseware editing through the shared adapter without moving courseware validation, manifest, preview, or publication ownership.

## 3. Verification

- [ ] 3.1 Add round-trip fixtures for headings, tables, formulas, code, lists, BOPPPS stages, and nested timing.
- [ ] 3.2 Test autosave, explicit save, revision conflicts, failed saves, exit protection, and reopening.
- [ ] 3.3 Test AI suggestion accept and ignore plus unchanged teacher-approval state.
- [ ] 3.4 Run typecheck, editor unit tests, and desktop and narrow-screen browser tests for lesson, course-basis, and courseware editing and return navigation.

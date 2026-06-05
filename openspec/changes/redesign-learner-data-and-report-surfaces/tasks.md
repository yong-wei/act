## 1. Learner Record

- [ ] 1.1 Redesign dashboard/profile surfaces around current path, next action, confidence, and record summary.
- [ ] 1.2 Redesign growth and evidence timeline surfaces with shared evidence/status roles.
- [ ] 1.3 Redesign adaptive practice entry states for stable, generate, empty, and low-evidence conditions.
- [ ] 1.4 Verify dashboard, profile, growth, evidence, and adaptive practice routes update the route ledger with owning change, archetype, navigation layers, shell status, mobile behavior, dock behavior, and light/dark evidence.
- [ ] 1.5 Verify `/dashboard` and `/profile` replace welcome/stat/card-grid priority with current path, next action, evidence confidence, and missing-source priority.

## 2. Mobile And States

- [ ] 2.1 Add mobile-first structure for path, evidence, timeline, and next-action sections.
- [ ] 2.2 Ensure loading, empty, degraded, feature-flagged, low-confidence, and missing-evidence states inherit the theme templates.
- [ ] 2.3 Preserve privacy filtering and role-specific source visibility.
- [ ] 2.4 Preserve evidence source filtering for student, teacher, and admin/reviewer contexts.

## 3. Verification

- [ ] 3.1 Run focused learner/adaptive/evidence UI tests.
- [ ] 3.2 Capture 1440px and 320px light/dark screenshots for representative learner routes.
- [ ] 3.3 Verify interactive lesson submission, Arena official/preview result, and adaptive practice submission can appear in learner record or evidence timeline with confidence, freshness, missing-source, and next-action state.
- [ ] 3.4 Run `rtk openspec validate redesign-learner-data-and-report-surfaces --strict`.

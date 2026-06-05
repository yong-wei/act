## 1. Teacher Operations

- [ ] 1.1 Redesign teacher home around active classes, pending work, recent lessons, and analytics availability.
- [ ] 1.2 Apply continuous teacher navigation to classes, lesson plans, resources, history, and analytics routes.
- [ ] 1.3 Replace passive feature-flagged placeholders with honest next-action states.
- [ ] 1.4 Verify teacher routes update the route ledger with owning change, archetype, navigation layers, shell status, mobile behavior, dock behavior, and light/dark evidence.
- [ ] 1.5 Verify teacher journey from class to lesson plan to resource or ResourceNode to classroom launch to student evidence to history, analytics, and report entry.
- [ ] 1.6 Preserve teacher controls, telemetry summaries, and teacher insight visibility for interactive lesson and classroom flows.

## 2. Admin Governance

- [ ] 2.1 Redesign admin home around risk, pending actions, and governance/system channels.
- [ ] 2.2 Apply continuous admin navigation to users, states, config, and data-governance routes.
- [ ] 2.3 Align tables, filters, metric panels, save/reset actions, and risk states.
- [ ] 2.4 Verify admin journey from user/config change to governance status refresh, source coverage or session quality status, repair action, restricted-state explanation, and redacted report/export entry.
- [ ] 2.5 Ensure `/admin/data-governance` ownership is separate from `/data-center` and report-ledger snapshots in the route ledger.

## 3. Verification

- [ ] 3.1 Run teacher/admin operations tests.
- [ ] 3.2 Capture 1440px and 320px light/dark screenshots for representative teacher and admin routes.
- [ ] 3.3 Verify teacher/admin home first viewport answers "what needs attention now" before directory navigation.
- [ ] 3.4 Run `rtk openspec validate redesign-operations-and-report-surfaces --strict`.

## 1. Role Navigation and Route Access

- [ ] 1.1 Register `/data-center` only for teacher and administrator navigation groups in the central role navigation model.
- [ ] 1.2 Remove any data-center presentation fallback that adds `/data-center` when role navigation omits it.
- [ ] 1.3 Update `/data-center` route role handling so students, unknown roles, and unauthorized users cannot render the data-center workspace.
- [ ] 1.4 Route authenticated students to `/profile/evidence` by default, allow only explicit non-data-center contextual return targets to override it, and preserve login callback behavior for unauthenticated users.
- [ ] 1.5 Rewrite student review, progress, and evidence actions that point to Data Center so they target learner-record routes.

## 2. Demo Data Source Label Setting

- [ ] 2.1 Add a persisted platform setting for whether data-center UI shows visible demo-data source labels, defaulting to disabled.
- [ ] 2.2 Add the setting to administrator configuration with save/reset feedback.
- [ ] 2.3 Wire `DataCenterSourceMarker` or equivalent source marker rendering to the setting.
- [ ] 2.4 Ensure disabling the label does not remove internal provenance, source family, exclusion reason, or administrator audit visibility.

## 3. Verification

- [ ] 3.1 Add role-navigation tests proving students do not see `/data-center` while teacher/admin roles do.
- [ ] 3.2 Add direct-route tests for student denial or redirect from `/data-center`.
- [ ] 3.3 Add student entry tests proving review/evidence destinations do not target `/data-center`.
- [ ] 3.4 Add component tests proving data-center UI does not restore hidden entries through local fallback navigation.
- [ ] 3.5 Add admin setting tests for default-off and enabled demo-label behavior.
- [ ] 3.6 Add DOM or browser evidence for ordinary data-center UI with demo labels disabled and enabled, while administrator audit provenance remains visible.
- [ ] 3.7 Run `rtk openspec validate restrict-data-center-to-operations-roles --strict`.

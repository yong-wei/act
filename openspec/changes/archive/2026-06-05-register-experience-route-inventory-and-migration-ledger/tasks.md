## 1. Inventory

- [x] 1.1 Build or extend primary route inventory with archetype, role scope, auth state, theme support, navigation layers, and dock behavior.
- [x] 1.2 Add migration ledger fields for owning change, exception reason, exception expiry/removal condition, and screenshot profile.
- [x] 1.3 Assign ownership for `/data-center`, `/knowledge`, `/admin/data-governance`, learner record routes, teacher routes, admin routes, and report surfaces.
- [x] 1.4 Assign or except `/classroom/student/[sessionId]`, course private student/player routes, `/teacher/arena`, `/teacher/classes/[classId]/analytics-v2`, `/teacher/classes/[classId]/students/[studentId]`, `/ai`, and `/ai/copilot`.
- [x] 1.5 Register report-ledger route or component inventory for classroom, Arena, learner, governance, and data-center report/snapshot surfaces.

## 2. Enforcement

- [x] 2.1 Add tests that detect missing primary route inventory entries.
- [x] 2.2 Add tests that detect duplicate owning changes for the same route.
- [x] 2.3 Expose inventory inputs to commercial UI governance.
- [x] 2.4 Add tests that detect route inventory and visual QA matrix drift for `/arena`, `/assessment/adaptive-practice`, `/profile`, and `/data-center`.

## 3. Verification

- [x] 3.1 Run route inventory tests.
- [x] 3.2 Verify every downstream page-family change can only claim routes listed under its owning change or an explicit temporary exception.
- [x] 3.3 Run `rtk openspec validate register-experience-route-inventory-and-migration-ledger --strict`.

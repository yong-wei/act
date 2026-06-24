## ADDED Requirements

### Requirement: Operations create and edit descendants preserve source context
Teacher and administrator operations create/edit descendants SHALL preserve source-aware breadcrumbs and return targets across dashboard, list, clone, class-detail, create-to-edit, and direct-edit flows.

#### Scenario: Teacher creates or edits lesson plans from operations sources
- **WHEN** a teacher opens `/teacher/lesson-plans/new` or `/teacher/lesson-plans/[id]/edit` from `/teacher`, `/teacher/lesson-plans`, `/teacher/preset-lessons`, `/teacher/classes/[classId]`, a new-to-edit transition, a clone-to-edit transition, or a direct edit entry
- **THEN** the create/edit destination SHALL preserve the teacher operations shell, source-aware breadcrumb trail, role context, and object context where available
- **AND** the return target SHALL resolve to the launching source route or a registered source-scoped exception with desktop and mobile evidence.

#### Scenario: Administrator creates or edits lesson plans from management sources
- **WHEN** an administrator opens `/admin/lesson-plans/new` or `/admin/lesson-plans/[id]/edit` from `/admin/lesson-plans`, a new-to-edit transition, or a direct edit entry
- **THEN** the create/edit destination SHALL preserve the admin console shell, source-aware breadcrumb trail, role context, and object context where available
- **AND** the return target SHALL resolve to the administrator lesson-plan source route or a registered source-scoped exception with desktop and mobile evidence.

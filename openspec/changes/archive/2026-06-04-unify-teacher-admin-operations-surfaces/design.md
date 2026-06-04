## Context

Teacher pages need to become teaching operations tools rather than entry-card collections. Admin pages already have clear domains, but users, settings, model management, usage statistics, and governance require one console frame and consistent information density.

## Goals / Non-Goals

**Goals:**

- Define teacher operations shell for class health, resources, lesson plans, history, and student/class analytics.
- Define admin console shell for users, model/settings, system settings, usage, and governance.
- Align metrics, filters, tables, risk labels, and actions.

**Non-Goals:**

- Rewriting ResourceNode editing rules.
- Changing teacher/admin authorization.
- Implementing new model-provider backend behavior.

## Decisions

### Decision 1: Teacher pages organize around operational objects

Classes, students, resources, lesson plans, and classroom history should be first-class operational objects with overview, risk, status, and actions.

### Decision 2: Admin pages use a management console frame

Admin users, models, system configuration, data governance, and usage statistics should share domain navigation and status/action placement.

### Decision 3: Dense operations pages need restrained hierarchy

Metrics, tables, filters, and risk queues need scan-friendly density rather than large decorative panels.

## Validation

- `rtk openspec validate unify-teacher-admin-operations-surfaces --strict`
- Visual QA for teacher dashboard/classes/resources and admin dashboard/users/config/governance in light and dark themes.
- Role authorization smoke checks for teacher and admin routes.

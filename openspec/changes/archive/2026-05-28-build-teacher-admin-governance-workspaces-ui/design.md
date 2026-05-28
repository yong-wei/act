## Context

Teacher and admin pages already have useful dashboards but separate visual systems and incomplete future governance roles. ResourceNode management and evidence governance will create new teacher/admin responsibilities that need one UI language.

## Goals / Non-Goals

Goals:

- Provide teacher governance UI around the existing `teacher-resource-node-management` capability, including shell, status display, redaction, warning summaries, and action placement for authorized single-node review or edits.
- Provide admin/data-center UI for source coverage, readiness, missing context, privacy status, replay/confidence, and evaluation-event health.
- Align governance views with shared status primitives.

Non-goals:

- No implementation of ResourceNode backend, evidence materialization, or privacy services.
- No redefinition of the `teacher-resource-node-management` capability or its permitted edit rules.
- No teacher homepage/dashboard redesign; that remains owned by a dedicated dashboard change or the current teacher dashboard implementation track.
- No Stage 2 bulk resource operations unless the dedicated experiment/operations change has landed.
- No disclosure of restricted payloads.

## Decisions

### Teacher UI manages eligible resources, not raw internals

Teachers can inspect ResourceNode status and invoke authorized single-node management actions supplied by `teacher-resource-node-management`, but this UI change owns only the governance shell, status presentation, role scoping, and redaction. It cannot see hidden official evaluation internals, private learner evidence, raw answers, raw traces, or private memory.

### Admin data center separates demo and governance modes

Admin/data-center surfaces should distinguish presentation metrics from governance readiness and audit details.

## Risks

- Governance dashboards can become dense and hard to act on. Views must preserve actionable warning summaries and drilldown.
- Incorrect role scoping can leak private data. Tests must cover restricted fields.

## Verification

- Permission and redaction tests for teacher/admin views.
- Source coverage and readiness rendering tests.
- Browser checks for teacher and admin governance workspaces once implemented.

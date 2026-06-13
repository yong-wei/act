# XH-202620 Competition Baseline Ledger

This ledger defines the deterministic competition path for the automatic-control intelligent teaching assistant baseline. It uses the existing intelligent teaching assistant demo package and keeps real learner evidence out of the seed/reset contract.

## Demo Accounts

| Role | Stable Id | Display Name | Boundary |
| --- | --- | --- | --- |
| teacher | `demo-teacher-ita` | Competition Demo Teacher | Grading, class insight, prep-pack, and effect-report surfaces |
| administrator | `demo-admin-ita` | Competition Demo Administrator | Provenance and system policy inspection through operations-only surfaces |
| student | `demo-ita-student-alpha` | Competition Demo Student Alpha | Learner record, adaptive path, and feedback surfaces |

## Baseline Records

| Record | Type | Data Origin |
| --- | --- | --- |
| `demo-ita-class` | class | synthetic-demo |
| `assignment-control-report` | assignment | synthetic-demo |
| `snapshot-diagnosis-alpha` | diagnosis-snapshot | synthetic-demo |
| `path-alpha-main` | path-plan | synthetic-demo |
| `konling-diagnosis` | konling-session | synthetic-demo |
| `prep-pack-demo-ita` | prep-pack | synthetic-demo |
| `overlay-prep-pack-demo-ita` | prep-pack-overlay | synthetic-demo |
| `effect-report-demo-ita-export` | effect-report-export | synthetic-demo |

## Deterministic Route Ledger

| Role | Route Or API | Surface Status | Expected Evidence |
| --- | --- | --- | --- |
| teacher | `/teacher/grading-workbench?demo=1` | implemented | Document grading workbench and `grading-alpha-draft` |
| student | `/assessment/document-feedback?demo=1` | implemented | Student feedback surface and cited rubric feedback |
| student | `/profile/evidence` | implemented | Learner-record evidence surface; students do not use `/data-center` |
| student | `/assessment/adaptive-practice?goal=control-correction` | implemented | Control-correction adaptive path with `path-alpha-main` |
| teacher | `/teacher/classes/demo-ita-class` | placeholder | Prep-pack action slot backed by `prep-pack-demo-ita` |
| teacher | `/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true` | api-only | Source-backed effect-report payload with synthetic metric caveats |
| administrator | `/data-center` | implemented | Operations-only provenance and source-quality inspection |

## Temporary And API-Only Surfaces

| Surface | Status | Removal Owner |
| --- | --- | --- |
| `/teacher/classes/demo-ita-class` prep-pack action slot | placeholder | `productize-learning-path-prep-pack` |
| `/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true` | api-only | `polish-competition-surfaces-report` |
| `AI_PROVIDER_ENABLED`, `KONLING_SERVER_MODE_CONTEXT_SECRET`, `DOCUMENT_RUBRIC_GRADING_ENABLED` | feature-flagged | `harden-assistant-evidence-loop` |

## Seed And Reset Contract

- Seed command: `rtk npm run test:competition-baseline`
- Reset/rollback command: `rtk npm run test:intelligent-teaching-assistant-demo -- --rollback-check`
- Idempotency key: `intelligent-teaching-assistant-demo-2026-06-05`
- Duplicate check: installing `installIntelligentTeachingAssistantDemoFixtures` twice produces the same record set and unique ids.
- Cleanup selectors include `demoPackage=intelligent-teaching-assistant` and `syntheticOnly=true` safeguards.

## Acceptance Procedure

1. Run `rtk npm run test:competition-baseline`.
2. Run `rtk npm run test:intelligent-teaching-assistant-demo`.
3. Run `rtk openspec validate competition-demo-baseline --strict`.
4. Confirm the student path stays on `/profile/evidence`, `/assessment/adaptive-practice?goal=control-correction`, and `/assessment/document-feedback?demo=1`; `/data-center` is administrator-only in this baseline.

For a live Next.js target, run `rtk npm run test:competition-baseline` with `INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL`, `INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE`, `INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE`, and `COMPETITION_BASELINE_ADMIN_AUTH_COOKIE` set. Without an external target, the command uses a local controlled HTTP fixture to verify the same route, API, role-boundary, and synthetic-data checks.

Downstream active changes should depend on the archived `competition-demo-baseline` specification. Any remaining proposal prose that names the original baseline change should be updated inside that proposal's owning change, not by broadening this baseline PR across unrelated active change directories.

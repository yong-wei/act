# Competition Assets Manifest

This manifest is the final submission package for the automatic-control intelligent teaching assistant demo. It uses only `synthetic-demo` records and does not claim measured classroom outcomes.

## Demo Accounts

| Role | Stable Id | Primary Route | Boundary |
| --- | --- | --- | --- |
| teacher | `demo-teacher-ita` | `/teacher/grading-workbench?demo=1` | grading, class diagnosis, prep-pack review, and effect-report export |
| student | `demo-ita-student-alpha` | `/profile/evidence` | learner evidence, diagnosis, adaptive path, feedback, Arena, and simulation rehearsal |
| administrator | `demo-admin-ita` | `/data-center` | provenance, source quality, provider policy, and operations-only settings |

## Route Order

| Step | Actor | Route Or API | Evidence Marker |
| --- | --- | --- | --- |
| 1 | student | `/` | competition entry and route order |
| 2 | teacher | `/teacher/grading-workbench?demo=1` | `grading-alpha-draft` |
| 3 | student | `/assessment/document-feedback?demo=1` | cited rubric feedback |
| 4 | student | `/profile/evidence` | learner-record evidence; student navigation excludes `/data-center` |
| 5 | student | `/profile/growth` | diagnosis and growth evidence |
| 6 | student | `/assessment/adaptive-practice?goal=control-correction` | `path-alpha-main` and terminal validation |
| 7 | teacher | `/teacher/prep-packs` | `prep-pack-demo-ita` review and overlay lifecycle |
| 8 | teacher | `/teacher/classes/demo-ita-class/analytics-v2` | class diagnosis and governance summary |
| 9 | teacher | `/teacher/classes/demo-ita-class/students/demo-ita-student-beta` | individual student evidence drilldown |
| 10 | teacher | `/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true` | source-backed synthetic effect report |
| 11 | administrator | `/data-center` | provenance and source-quality inspection |
| 12 | administrator | `/admin/data-governance` | governed data and provider-policy inspection |
| 13 | student | `/arena` | Arena workspace shell |
| 14 | student | `/arena/challenges/task-second-order-lead-pid` | official challenge detail |
| 15 | student | `/interactive-learning/control-workbench` | simulation workbench rehearsal |

## Screenshot Ledger

All screenshot and browser-evidence references are centralized in `artifacts/commercial-ui/evidence.json`. The acceptance script requires 1440px and 320px evidence for every non-API route in the route order. Routes that support both themes use light and dark evidence; light-only surfaces remain explicitly recorded as light theme evidence.

| Surface | 1440px | 320px | Theme Coverage | Evidence |
| --- | --- | --- | --- | --- |
| entry | required | required | light/dark where supported | `artifacts/commercial-ui/evidence.json` |
| grading and feedback | required | required | light where supported | `artifacts/commercial-ui/evidence.json` |
| learner diagnosis and path | required | required | light/dark where supported | `artifacts/commercial-ui/evidence.json` |
| teacher prep-pack and class insight | required | required | light/dark where supported | `artifacts/commercial-ui/evidence.json` |
| administrator operations | required | required | light/dark where supported | `artifacts/commercial-ui/evidence.json` |
| Arena and simulation | required | required | light/dark where supported | `artifacts/commercial-ui/evidence.json` |

## Visual Theme Exceptions

| Evidence Href | Theme Scope | Reason |
| --- | --- | --- |
| /teacher/grading-workbench | light-only | Shared report-ledger shell evidence covers dark behavior; this row records the competition grading content state. |
| /assessment/document-feedback | light-only | Shared report-ledger shell evidence covers dark behavior; this row records the competition student feedback state. |
| /profile/evidence | light-only | Shared learner report shell evidence covers dark behavior; this row records the competition learner evidence state. |
| /profile/growth | light-only | Shared learner report shell evidence covers dark behavior; this row records the competition diagnosis growth state. |
| /teacher/prep-packs | light-only | Shared report-ledger shell evidence covers dark behavior; this row records the competition prep-pack lifecycle state. |
| /teacher/classes/[classId]/students/[studentId] | light-only | Shared teacher report shell evidence covers dark behavior; this row records the competition student drilldown state. |

## Three-Minute Demo Script

| Time | Scene | Narration |
| --- | --- | --- |
| 0:00-0:20 | entry | The platform opens as one automatic-control teaching workflow, not a collection of disconnected tools. |
| 0:20-0:45 | teacher grading workbench | The teacher reviews AI-generated rubric feedback with citations, edits criteria, and keeps writeback as a reviewed action. |
| 0:45-1:05 | student feedback | The student sees cited feedback and can trace what evidence informed each comment. |
| 1:05-1:30 | learner evidence and diagnosis | The learner record and growth surface show governed diagnosis evidence instead of sending students to operations data. |
| 1:30-1:55 | adaptive path | Diagnosis evidence produces a path choice with selection history and terminal validation. |
| 1:55-2:15 | teacher prep-pack review | Class diagnosis becomes a reviewable prep-pack overlay that can be activated, rolled back, archived, and audited. |
| 2:15-2:35 | effect report export | The reviewer sees source-backed metrics for grading, path adoption, prep-pack activation, citation coverage, and usage coverage. |
| 2:35-2:50 | Arena and simulation | The student rehearses in the workbench and then enters the Arena challenge boundary. |
| 2:50-3:00 | fallback | If the live target is unavailable, the deterministic acceptance script verifies the same route, API, role, and synthetic-data checks. |

## Model And Provider Note

The demo supports OpenAI-compatible provider configuration through the existing provider runtime. The package stores only environment secret references, requires tools, streaming, and citation support, and does not claim support for any runtime path that has not landed in this repository.

## Privacy Note

All competition records use `synthetic-demo` data origin. Real classroom evidence is excluded from the fixture package unless a future import record includes consent or authorization reference, privacy review reference, and separation from synthetic fixture identifiers. Effect-report metrics include source references, exclusions, caveats, confidence, sample size, and data-origin marker.

## Fallback Steps

1. Run `rtk npm run test:competition-baseline` for route, API, role-boundary, visual-evidence, and synthetic-data checks.
2. Run `rtk npm run test:intelligent-teaching-assistant-demo` for fixture, API, provider, privacy, and citation checks.
3. Run `rtk npm run test:commercial-ui-governance` for route ledger and visual evidence gates.
4. Run `rtk openspec validate competition-demo-baseline --strict` to verify the archived competition baseline spec.
5. If the external video repository is unavailable, submit this manifest plus the checked-in browser evidence manifest and mark video capture as skipped.

## Submission Checklist

| Item | Status |
| --- | --- |
| route ledger covers teacher, student, administrator, grading, diagnosis, path, prep-pack, effect-report, simulation or Arena, and entry surfaces | ready |
| effect-report export is source-backed and synthetic-only | ready |
| screenshots or documented evidence cover 1440px and 320px surfaces | ready |
| model note avoids unsupported runtime claims | ready |
| privacy note separates real and synthetic evidence | ready |
| fallback commands are rerunnable from this repository | ready |

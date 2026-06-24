# XH-202620 Competition Capability Map

This map freezes the automatic-control intelligent teaching assistant baseline for the XH-202620 competition story. It is scoped to synthetic demo data and does not claim measured classroom outcomes.

## Final Capability Map

| Capability | Status | Competition Need | Baseline Evidence | Reviewer Surface |
| --- | --- | --- | --- | --- |
| diagnosis-to-path | implemented | Diagnose learner state and recommend a learning path | `snapshot-diagnosis-alpha`, `path-alpha-main`, `demo-ita-student-alpha` | `/profile/evidence`, `/profile/growth`, `/assessment/adaptive-practice?goal=control-correction` |
| document-grading | implemented | AI-assisted report grading with teacher review and cited feedback | `grading-alpha-draft`, `approval-grading-beta-approved`, `assignment-control-report` | `/teacher/grading-workbench?demo=1`, `/assessment/document-feedback?demo=1` |
| konling-explanation | implemented | Konling explains diagnosis, path, resources, grading, class summary, and prep-pack context | `konling-diagnosis`, `konling-path`, `konling-grading`, `konling-prep` | `/profile/evidence`, `/teacher/classes/demo-ita-class/analytics-v2` |
| teacher-prep-pack | implemented | Teacher receives a prep-pack action generated from student evidence | `prep-pack-demo-ita`, `overlay-prep-pack-demo-ita` | `/teacher/prep-packs` |
| effect-report | implemented | Reviewer sees a source-backed effect report with metric methodology | `effect-report-demo-ita-export` | `/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true` |
| simulation-arena-validation | implemented | Reviewer sees simulation and Arena validation boundaries | `path-alpha-main`, `task-second-order-lead-pid` | `/arena`, `/arena/challenges/task-second-order-lead-pid`, `/interactive-learning/control-workbench` |

## Data Origin

Every baseline record uses `synthetic-demo` origin metadata and `intelligent-teaching-assistant` source package identity. The frozen records include diagnosis, grading, path, Konling, prep-pack, overlay, and effect-report payloads.

## Acceptance Commands

- `rtk npm run test:competition-baseline`
- `rtk npm run test:intelligent-teaching-assistant-demo`
- `rtk npm run test:commercial-ui-governance`
- `rtk openspec validate competition-demo-baseline --strict`

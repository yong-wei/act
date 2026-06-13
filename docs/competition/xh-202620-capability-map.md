# XH-202620 Competition Capability Map

This map freezes the automatic-control intelligent teaching assistant baseline for the XH-202620 competition story. It is scoped to synthetic demo data and does not claim production learning gains.

## Implemented

| Capability | Competition Need | Baseline Evidence | Reviewer Surface |
| --- | --- | --- | --- |
| diagnosis-to-path | Diagnose learner state and recommend a learning path | `snapshot-diagnosis-alpha`, `path-alpha-main`, `demo-ita-student-alpha` | `/profile/evidence`, `/assessment/adaptive-practice?goal=control-correction` |

## Partial

| Capability | Competition Need | Baseline Evidence | Current Boundary | Follow-up Change |
| --- | --- | --- | --- | --- |
| document-grading | AI-assisted report grading with teacher review and cited feedback | `grading-alpha-draft`, `approval-grading-beta-approved`, `assignment-control-report` | Grading and feedback fixtures are present; final professional workbench polish is still separate. | `professionalize-document-grading` |
| konling-explanation | Konling explains diagnosis, path, resources, grading, class summary, and prep-pack context | `konling-diagnosis`, `konling-path`, `konling-grading`, `konling-prep` | Mode coverage and citations exist; evidence loop hardening remains separate. | `harden-assistant-evidence-loop` |
| teacher-prep-pack | Teacher receives a prep-pack action generated from student evidence | `prep-pack-demo-ita`, `overlay-prep-pack-demo-ita` | Fixture and overlay contract exist; productionized learning-path prep-pack surface remains separate. | `productize-learning-path-prep-pack` |

## Planned

| Capability | Competition Need | Baseline Evidence | Current Boundary | Follow-up Change |
| --- | --- | --- | --- | --- |
| effect-report | Reviewer sees a source-backed effect report with metric methodology | `effect-report-demo-ita-export` | API export and synthetic metric contract exist; final visible report surface remains separate. | `polish-competition-surfaces-report` |

## Data Origin

Every baseline record uses `synthetic-demo` origin metadata and `intelligent-teaching-assistant` source package identity. The frozen records include diagnosis, grading, path, Konling, prep-pack, overlay, and effect-report payloads.

## Acceptance Commands

- `rtk npm run test:competition-baseline`
- `rtk npm run test:intelligent-teaching-assistant-demo`
- `rtk openspec validate competition-demo-baseline --strict`

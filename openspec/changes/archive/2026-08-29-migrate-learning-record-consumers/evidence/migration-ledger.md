# Migration ledger

| Consumer / helper | Mode after this change | Replacement | Retirement gate |
| --- | --- | --- | --- |
| Student competency-snapshot route | current student port | `readStudentEvidencePort` | n/a |
| Profile portrait | current student port | `readStudentEvidencePort` | n/a |
| Profile `interactionLog` activity | **retained** (profile activity, not LR current read) | none in this change | delete only after a profile-activity port exists and callers are zero |
| Teacher class insights / heatmap | teacher class port + small-sample aggregates | `readTeacherClassEvidencePort` | n/a |
| Teacher student insights portrait | teacher student port | `readTeacherStudentEvidencePort` | n/a |
| Teacher student insights LearningFact / submissions / reports | **retained drilldown** | explicit drilldown, not current scores | keep; not a raw page aggregator for portrait scores |
| Arena `LearningFact` on class insights | **retained** Arena domain | Arena summary | out of scope |
| `resolveFencedAdaptivePortrait` | Personalization/AI consumer authorization then current pointer | `readAuthorizedCumulativePortrait` | n/a |
| ground-evidence-copilot | existing `resolveEvidenceCopilotContext` / `readLearnerState` | no copied permission resolver | n/a |
| smart-prep / smart-lesson class portrait | teacher class port | `readTeacherClassEvidencePort` | n/a |
| `listEvidenceTimeline` | governed timeline drilldown | keep | not a current-projection reader |
| Interactive events InteractionLog | course runtime persistence | keep | not LR consumer aggregation |
| Admin data-governance InteractionLog | audit | keep | operator purpose/revision receipt already required by ingestion |
| `interactive-evidence-scoring-recompute` | migration/recompute | keep | migration purpose |
| Session-report InteractionLog summaries | reports | keep | report alignment; not deleted here |

## Deletion proof (task 3.5)

No Learning Record **page-level raw evidence aggregator** reached zero required callers. Direct `readCurrentCumulativePortrait` / `readCurrentCumulativeClassPortrait` production callers listed in characterization were migrated. Remaining InteractionLog uses are activity, course runtime, audit, or reports.

## Denominator

Producer (#1584 current pointer) → consumer ports (this change) → worker/backfill unchanged. Reports that still read InteractionLog are recorded above and are not treated as current-projection sources.

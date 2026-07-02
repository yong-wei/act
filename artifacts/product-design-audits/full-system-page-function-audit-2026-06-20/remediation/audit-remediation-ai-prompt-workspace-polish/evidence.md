# AI Prompt Workspace Polish Evidence

## Scope

- Change: `audit-remediation-ai-prompt-workspace-polish`
- Issue: #677
- Routes checked:
  - `/evaluation/prompt-assessment?source=issue677&autodemo=1`
  - `/ai/copilot?context=portfolio-reflection&source=issue677`
  - `/ai?task=report-feedback&source=issue677`
  - `/profile/portfolio?category=reflection&intent=create&source=issue677`

## Remediation Summary

- Prompt evaluation, Copilot reflection, AI workshop report-feedback, and portfolio reflection now declare page-local AI task surfaces with `data-ai-local-task-surface`, `data-ai-task-focus-mode="local-first"`, and local primary task input/action markers.
- Global AI remains available through the shared dock, but `GlobalAIFloatingButton` detects local-first AI task surfaces and registers the global entry as a secondary tool.
- Candidate contracts now carry source, assignment, intent, output target, and explicit-save-or-submit promotion policy.
- Copilot reflection/evidence modes use task-specific quick questions instead of generic simulation questions.
- Portfolio prompt-design empty state now routes to `/evaluation/prompt-assessment` instead of the generic `/evaluation` path.
- Portfolio reflection candidates can be marked as a local draft or discarded without writing to the learning portfolio.
- Prompt history, AI workshop candidates, Copilot reflection drafts, and portfolio reflection preview preserve source, assignment, intent, and output-target context.
- Portfolio reflection preview treats `assignment` as reflection task context unless the route is an explicit `intent=collect` feedback collection flow, so reflection candidates are not displaced by an unknown feedback-task panel.

## Finding Coverage

- Covered from earlier audit records:
  - `chapters/43-function-state-flows-batch35.md`: 188 mobile Prompt/Copilot dock clearance.
  - `chapters/55-function-state-flows-batch47.md`: 299 Prompt local input priority.
  - `chapters/57-function-state-flows-batch49.md`: 322 Prompt autodemo local input priority.
  - `chapters/62-function-state-flows-batch54.md`: 384 Prompt autodemo/history workspace, 386 Copilot visible context boundary.
  - `chapters/63-function-state-flows-batch55.md`: 398 Prompt history local task entry, AI workshop report-feedback candidate state, Copilot reflection candidate state, portfolio reflection candidate state.
- Inherited as already closed by `audit-remediation-ai-task-boundaries`:
  - `chapters/42-function-state-flows-batch34.md`: 172 Global AI focus containment.
  - `chapters/50-function-state-flows-batch42.md`: 247 AI send button naming, 253 visible internal context in Global AI first screen.

## Browser Evidence

- JSON: `browser-evidence.json`
- Screenshots:
  - `screenshots/prompt-assessment-1440.png`
  - `screenshots/prompt-assessment-390.png`
  - `screenshots/copilot-reflection-1440.png`
  - `screenshots/copilot-reflection-390.png`
  - `screenshots/ai-workshop-report-feedback-1440.png`
  - `screenshots/ai-workshop-report-feedback-390.png`
  - `screenshots/portfolio-reflection-preview-1440.png`
  - `screenshots/portfolio-reflection-preview-390.png`

Browser checks recorded:

| Route | Viewport | Local surface | Local overlaps dock | Local before dock |
| --- | ---: | --- | --- | --- |
| `/evaluation/prompt-assessment?source=issue677&assignment=report-control-design&intent=prompt-history-review&autodemo=1` | 1440x950 | `prompt-evaluation` | false | true |
| `/evaluation/prompt-assessment?source=issue677&assignment=report-control-design&intent=prompt-history-review&autodemo=1` | 390x844 | `prompt-evaluation` | false | true |
| `/ai/copilot?context=portfolio-reflection&source=issue677&assignment=ai-collaboration&intent=reflection-review` | 1440x950 | `copilot-portfolio-reflection` | false | true |
| `/ai/copilot?context=portfolio-reflection&source=issue677&assignment=ai-collaboration&intent=reflection-review` | 390x844 | `copilot-portfolio-reflection` | false | true |
| `/ai?task=report-feedback&source=issue677&assignment=report-control-design&intent=report-feedback-review` | 1440x950 | `ai-workshop` | false | true |
| `/ai?task=report-feedback&source=issue677&assignment=report-control-design&intent=report-feedback-review` | 390x844 | `ai-workshop` | false | true |
| `/profile/portfolio?category=reflection&intent=create&source=issue677&assignment=ai-collaboration&taskIntent=reflection-review` | 1440x950 | `portfolio-reflection` | false | true |
| `/profile/portfolio?category=reflection&intent=create&source=issue677&assignment=ai-collaboration&taskIntent=reflection-review` | 390x844 | `portfolio-reflection` | false | true |

All browser checks ran as authenticated student `demo` and confirmed the relevant source/assignment/intent text was visible where expected. The portfolio reflection checks also assert that `未知反馈任务`, `反馈任务不存在`, and `请先登录` are absent.

## Verification

- `rtk npm run test:unit -- src/lib/__tests__/ai-task-boundary-contracts.test.ts src/lib/__tests__/ai-task-boundary-ui-source.test.ts src/lib/__tests__/student-feedback-task-contract.test.ts src/lib/__tests__/student-feedback-task-ui-source.test.ts`
  - Result: 4 files passed, 32 tests passed.
- `rtk npm run lint`
  - Result: passed with `--max-warnings=0`.
- `rtk openspec validate audit-remediation-ai-prompt-workspace-polish --strict`
  - Result: passed.

## Exclusions

- No adaptive path generation, Graph Center actions, Konling graph context, KAQ writeback, provider/model admin governance, or resource metadata behavior was changed.
- Candidate preview states remain local UI state. They do not create LearningFact, profile evidence, portfolio artifacts, or teacher-visible records without a later explicit save/submit/publish integration.

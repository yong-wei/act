## 1. Resume Defaults

- [ ] 1.1 Make `/assessment/adaptive-practice` restore the authenticated student's latest active path before showing cold-start generation when no explicit path deep link is present.
- [ ] 1.2 Add a completed-path summary state when the latest path is completed and no active path exists.
- [ ] 1.3 Keep regenerate, switch-path, and goal-selection actions as secondary actions when a current or completed path is available.
- [ ] 1.4 Handle stale or missing learner-state path context by falling back to authorized `LearningPath` persistence.

## 2. Completion Write-Back

- [ ] 2.1 Add a shared completion bridge for path-launched simple interactive resources that currently only complete locally.
- [ ] 2.2 Ensure simple resource completions write `/api/learning-paths/[id]/execute` with `status=completed` and a stable idempotency key.
- [ ] 2.3 Ensure adaptive assessment, simulation, workbench, and Arena nodes bind typed outcome references before dependent nodes advance.
- [ ] 2.4 Verify review, continued-interaction, return-to-skipped, and retry activity do not double-count original completion.

## 3. Validation

- [ ] 3.1 Run `rtk openspec validate restore-adaptive-path-resume-completion-state --strict`.
- [ ] 3.2 Add tests for active-path no-parameter resume and completed-path summary.
- [ ] 3.3 Add tests for simple interactive resource completion write-back and complex-node pending-result behavior.
- [ ] 3.4 Run an end-to-end check for select path, complete a representative precheck, return/re-enter, and see completed node plus next current node.

## Tasks

- [ ] Task 1: Run full-resource closure diagnostics.
  Covers: AC-1
  Acceptance: Helper, ResourceNode audit, LearningGoal stage matrix, and path diagnostics produce a current closure snapshot.
  Evidence: Generated JSON/Markdown summaries.
  Reviewer Check: Confirm counts reconcile with inventory totals and no family is silently dropped.

- [ ] Task 2: Repair small residual uncovered records.
  Covers: AC-2
  Acceptance: Small residual records receive reviewed disposition/metadata or concrete blocker rationale; large new families are not hidden inside this closure.
  Evidence: Metadata diff and before/after helper output.
  Reviewer Check: Confirm residual repairs follow semantic review rules.

- [ ] Task 3: Verify all current resources are accounted for.
  Covers: AC-3
  Acceptance: Full-resource gate reports zero unexplained disposition, semantic-review, parent-link, invalid-promotion, and exclusion-rationale blockers.
  Evidence: Full-resource readiness gate output.
  Reviewer Check: Confirm all discovered current resources are accounted for.

- [ ] Task 4: Verify all path-ready LearningGoals generate governed paths.
  Covers: AC-4
  Acceptance: Every registered path-ready LearningGoal can generate meaningful governed path options or reports a specific reviewed blocker; no cosmetic identical multi-path bundle is accepted.
  Evidence: All-goal path diagnostic output.
  Reviewer Check: Confirm paths include reviewed resources across relevant families where resources exist.

- [ ] Task 5: Verify resource citation and path-rationale addressability.
  Covers: AC-5
  Acceptance: Selected and supporting resources in generated paths and path explanations resolve through reviewed citation metadata or reviewed limitation state.
  Evidence: Citation resolver/RAG checks.
  Reviewer Check: Confirm resource metadata citations are clickable or limitation-marked; answer-level Konling relevance is left to its dedicated change.

- [ ] Task 6: Tighten gates after closure.
  Covers: AC-6
  Acceptance: New-resource gate and full-resource gate fail on any current or future unreviewed resource debt unless explicitly baseline-reviewed as an external blocker.
  Evidence: Gate tests and direct gate command output.
  Reviewer Check: Confirm the gate no longer allows new silent resource debt.

- [ ] Task 7: Run validation.
  Covers: AC-7
  Acceptance: OpenSpec validation, issue-body validation, helper checks, all-goal diagnostics, citation checks, and typecheck pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence.

## Validation

- [ ] Run `rtk openspec validate close-full-resource-semantic-completion --strict`.
- [ ] Run full-resource helper, ResourceNode audit, all-goal path diagnostics, and citation checks.
- [ ] Run targeted tests plus `rtk npx tsc --noEmit --pretty false`.
- [ ] Run issue-body validation before GitHub issue creation.
